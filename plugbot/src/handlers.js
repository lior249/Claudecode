// Réactions aux événements Discord : nouveau résultat, ❌ de l'admin, message supprimé,
// changement de rôle.

import {
  deletedMessage,
  prisonExitMessage,
  removedMessage,
  restoredMessage,
  showupMessage,
  winnerMessage,
} from './messages.js';
import { send } from './send.js';
import { isProof, leaderboard } from './stats.js';
import { ALL_TIME, dayOf, monthRange, weekRange } from './time.js';

export const PENDING_EMOJI = '❗';
export const REJECT_EMOJI = '❌';

function isNewer(id, than) {
  return than === null || BigInt(id) > BigInt(than);
}

export function createHandlers(ctx) {
  const { config, db, tracker, guild, channels, prison } = ctx;

  async function findMember(userId) {
    return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
  }

  // Donne ou retire le rôle de chaîne. Renvoie 'added', 'removed' ou null.
  async function syncStreakRole(member, chain) {
    const roleId = config.roles.streak;
    const wanted = chain >= config.streakRoleDays && tracker.isTracked(member);
    const has = member.roles.cache.has(roleId);
    try {
      if (wanted && !has) {
        await member.roles.add(roleId, 'Chaîne de show-up');
        return 'added';
      }
      if (!wanted && has) {
        await member.roles.remove(roleId, 'Chaîne de show-up brisée');
        return 'removed';
      }
    } catch (error) {
      console.error(`[PlugBot] Impossible de modifier le rôle de chaîne de ${member.user.tag} :`, error.message);
    }
    return null;
  }

  // Après un changement de points : sortie de prison éventuelle, rôle de chaîne et classements en direct.
  async function settle(userId) {
    const member = await findMember(userId);
    if (member) {
      const row = tracker.snapshot(new Map([[member.id, member]]), Date.now()).get(member.id);
      if (row?.prison.inPrison && !row.prison.internal && row.prison.daysToLeave === 0) {
        await prison.free(member);
        await send(channels.prison, prisonExitMessage(userId), [userId]);
      }
      if ((await syncStreakRole(member, row?.chain ?? 0)) === 'added') {
        await send(channels.showup, winnerMessage('streak', userId, config), [userId]);
      }
    }
    await ctx.boards?.refresh(Date.now());
  }

  async function onNewMessage(message) {
    if (message.guildId !== config.guildId || message.channelId !== config.channels.results) return;
    if (isNewer(message.id, db.getMeta('results_cursor'))) db.setMeta('results_cursor', message.id);
    if (message.author.bot || !message.attachments.some(isProof)) return;

    const member = await findMember(message.author.id);
    if (!member || !tracker.isTracked(member)) return;
    if (!db.addShowup(message.id, member.id, message.createdTimestamp)) return;

    await message.react(PENDING_EMOJI).catch((error) => console.error('[PlugBot] Réaction ❗ impossible :', error.message));

    // Points et rang du membre dans sa catégorie, pour la semaine, le mois et le total.
    const now = Date.now();
    const standing = (range) => {
      const rows = [...tracker.snapshot(guild.members.cache, now, range).values()];
      const row = rows.find((candidate) => candidate.userId === member.id);
      const rank = leaderboard(rows, row.category).findIndex((entry) => entry.userId === member.id) + 1;
      return { row, points: row.points, rank };
    };
    const week = standing(weekRange(now));
    const { row } = week;
    const content = showupMessage({
      userId: member.id,
      chain: row.chain,
      category: row.category,
      prison: row.prison,
      week,
      month: standing(monthRange(now)),
      total: standing(ALL_TIME),
      config,
      prisonExitChannelId: ctx.journey?.exitChannelId(),
    });
    await send(channels.showup, content, [member.id]);
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
    // Rôle gagné ou perdu : catégorie à jour, et libération si l'équipe a retiré le rôle Prisonnier.
    async onMemberUpdate(member) {
      const current = guild.members.cache.get(member.id) ?? member;
      const today = dayOf(Date.now());
      tracker.syncCategory(current, today);
      ctx.journey?.syncMember(current, Date.now());
      if (prison.wasReleasedByTeam(current)) await prison.releaseByTeam(current, today);
    },
  };
}
