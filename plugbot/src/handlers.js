// Réactions aux événements du salon #résultats : nouveau résultat, ❌ d'un admin, message supprimé.

import {
  deletedMessage,
  prisonExitMessage,
  removedMessage,
  restoredMessage,
  showupMessage,
  splitMessage,
} from './messages.js';
import { isProof, weeklyLeaderboard } from './stats.js';
import { weekRange } from './time.js';

export const PENDING_EMOJI = '❗';
export const REJECT_EMOJI = '❌';

function isNewer(id, than) {
  return than === null || BigInt(id) > BigInt(than);
}

// Envoie un texte en le découpant si besoin. Sans liste, tous les membres mentionnés sont notifiés.
export async function send(channel, content, notifiedUserIds) {
  const allowedMentions = notifiedUserIds ? { users: notifiedUserIds } : { parse: ['users'] };
  for (const part of splitMessage(content)) {
    await channel.send({ content: part, allowedMentions });
  }
}

export function createHandlers(ctx) {
  const { config, db, tracker, guild, channels } = ctx;

  async function findMember(userId) {
    return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
  }

  async function syncStreakRole(member, chain) {
    const roleId = config.roles.streak;
    if (!roleId) return;
    const wanted = chain >= config.streakRoleDays && tracker.isTracked(member);
    const has = member.roles.cache.has(roleId);
    try {
      if (wanted && !has) await member.roles.add(roleId, 'Chaîne de show-up');
      if (!wanted && has) await member.roles.remove(roleId, 'Chaîne de show-up brisée');
    } catch (error) {
      console.error(`[PlugBot] Impossible de modifier le rôle de chaîne de ${member.user.tag} :`, error.message);
    }
  }

  // Après un changement de points : sortie de prison éventuelle et rôle de chaîne.
  async function settle(userId) {
    const member = await findMember(userId);
    if (!member) return;
    const row = tracker.snapshot(new Map([[member.id, member]]), Date.now()).get(member.id);
    if (!row?.prison.inPrison && db.getPrisonLevel(userId) !== null) {
      db.removePrison(userId);
      await send(channels.prison, prisonExitMessage(userId), [userId]);
    }
    await syncStreakRole(member, row?.chain ?? 0);
  }

  async function onNewMessage(message) {
    if (message.guildId !== config.guildId || message.channelId !== config.channels.results) return;
    if (isNewer(message.id, db.getMeta('results_cursor'))) db.setMeta('results_cursor', message.id);
    if (message.author.bot || !message.attachments.some(isProof)) return;

    const member = await findMember(message.author.id);
    if (!member || !tracker.isTracked(member)) return;
    if (!db.addShowup(message.id, member.id, message.createdTimestamp)) return;

    await message.react(PENDING_EMOJI).catch((error) => console.error('[PlugBot] Réaction ❗ impossible :', error.message));

    const rows = tracker.snapshot(guild.members.cache, Date.now());
    const row = rows.get(member.id);
    const rank = weeklyLeaderboard([...rows.values()], row.category).findIndex((entry) => entry.userId === member.id) + 1;
    await send(channels.showup, showupMessage({ ...row, rank }), [member.id]);
    await settle(member.id);
  }

  async function reject(messageId, adminId) {
    const showup = db.getShowup(messageId);
    if (showup?.status !== 'valid') return;
    db.setStatus(messageId, 'rejected', adminId);
    const totals = db.userTotals(showup.user_id, weekRange(Date.now()));
    await send(channels.showup, removedMessage({ userId: showup.user_id, adminId, ...totals }), [showup.user_id]);
    await settle(showup.user_id);
  }

  async function restore(messageId, adminId) {
    const showup = db.getShowup(messageId);
    if (showup?.status !== 'rejected') return;
    db.setStatus(messageId, 'valid', adminId);
    const totals = db.userTotals(showup.user_id, weekRange(Date.now()));
    await send(channels.showup, restoredMessage({ userId: showup.user_id, adminId, ...totals }), [showup.user_id]);
    await settle(showup.user_id);
  }

  async function markDeleted(messageId) {
    const showup = db.getShowup(messageId);
    if (!showup || showup.status === 'deleted') return;
    db.setStatus(messageId, 'deleted');
    if (showup.status !== 'valid') return;
    const totals = db.userTotals(showup.user_id, weekRange(Date.now()));
    await send(channels.showup, deletedMessage({ userId: showup.user_id, ...totals }), [showup.user_id]);
    await settle(showup.user_id);
  }

  function isAdminRejection(reaction, user) {
    return (
      reaction.message.channelId === config.channels.results &&
      reaction.emoji.name === REJECT_EMOJI &&
      config.adminIds.has(user.id)
    );
  }

  return {
    onNewMessage,
    reject,
    restore,
    markDeleted,
    syncStreakRole,
    async onReactionAdd(reaction, user) {
      if (isAdminRejection(reaction, user)) await reject(reaction.message.id, user.id);
    },
    async onReactionRemove(reaction, user) {
      if (isAdminRejection(reaction, user)) await restore(reaction.message.id, user.id);
    },
    async onMessageDelete(message) {
      if (message.channelId === config.channels.results) await markDeleted(message.id);
    },
  };
}
