// Au démarrage : premier lancement, puis rattrapage de ce qui s'est passé pendant une coupure.

import { SnowflakeUtil } from 'discord.js';
import { REJECT_EMOJI } from './handlers.js';
import { DAY_MS, dayOf, monthStart, weekStart } from './time.js';

// Les ❌ ajoutées ou retirées et les messages supprimés sont rattrapés sur cette période.
const RECONCILE_MS = 7 * DAY_MS;

function bySnowflake(a, b) {
  const diff = BigInt(a.id) - BigInt(b.id);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export async function startup(ctx, handlers, jobs) {
  const { db, channels } = ctx;
  const now = Date.now();

  // Premier lancement : on part de zéro, les anciens messages de #flex-resultats ne comptent pas.
  if (db.getMeta('launch_day') === null) {
    const latest = await channels.results.messages.fetch({ limit: 1 });
    db.setMeta('results_cursor', latest.first()?.id ?? SnowflakeUtil.generate({ timestamp: now }).toString());
    db.setMeta('last_daily_day', dayOf(now));
    db.setMeta('last_week_boundary', weekStart(now));
    db.setMeta('last_month_boundary', monthStart(now));
    db.setMeta('launch_day', dayOf(now));
    console.log('[PlugBot] Premier lancement : le suivi commence maintenant.');
  }

  await catchUpNewMessages(ctx, handlers);
  await reconcileRecent(ctx, handlers, now - RECONCILE_MS);
  await jobs.checkTeamReleases(dayOf(now));
}

// Compte les résultats postés pendant que le bot était éteint.
async function catchUpNewMessages({ db, channels }, handlers) {
  for (;;) {
    const batch = await channels.results.messages.fetch({ after: db.getMeta('results_cursor'), limit: 100 });
    if (batch.size === 0) return;
    for (const message of [...batch.values()].sort(bySnowflake)) await handlers.onNewMessage(message);
    if (batch.size < 100) return;
  }
}

// Vérifie les résultats récents : ❌ posée ou retirée, ou message supprimé pendant la coupure.
async function reconcileRecent({ config, db, channels }, handlers, since) {
  const messages = new Map();
  let before;
  for (;;) {
    const batch = await channels.results.messages.fetch({ limit: 100, ...(before && { before }) });
    if (batch.size === 0) break;
    const sorted = [...batch.values()].sort(bySnowflake);
    for (const message of sorted) messages.set(message.id, message);
    before = sorted[0].id;
    if (batch.size < 100 || sorted[0].createdTimestamp < since) break;
  }

  for (const showup of db.showupsSince(since)) {
    const message = messages.get(showup.message_id);
    if (!message) {
      await handlers.markDeleted(showup.message_id);
      continue;
    }
    const rejection = message.reactions.cache.find((reaction) => reaction.emoji.name === REJECT_EMOJI);
    const users = rejection ? await rejection.users.fetch() : null;
    const adminId = users?.find((user) => config.adminIds.has(user.id))?.id ?? null;
    if (showup.status === 'valid' && adminId) await handlers.reject(showup.message_id, adminId);
    if (showup.status === 'rejected' && !adminId) await handlers.restore(showup.message_id, showup.changed_by);
  }
}
