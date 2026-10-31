// Réactions aux événements Discord : nouveau résultat, ❌ de l'admin, message supprimé,
// changement de rôle.

import {
  deletedMessage,
  helpPointMessage,
  helpPointRemovedMessage,
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
// Dans #entraide, un 👍 ou un ❤️ de l'équipe donne un point à l'auteur du message.
const isLike = (name) => (name ?? '').startsWith('👍') || (name ?? '').startsWith('❤');

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

    const { week, month, total } = standings(member, Date.now());
    const content = showupMessage({
      userId: member.id,
      chain: week.row.chain,
      category: week.row.category,
      prison: week.row.prison,
      week,
      month,
      total,
      config,
      prisonExitChannelId: ctx.journey?.exitChannelId(),
    });
    await send(channels.showup, content, [member.id]);
    await settle(member.id);
  }

  // Points et rang du membre dans sa catégorie, pour la semaine, le mois et le total.
  function standings(member, now) {
    const standing = (range) => {
      const rows = [...tracker.snapshot(guild.members.cache, now, range).values()];
      const row = rows.find((candidate) => candidate.userId === member.id);
      const rank = leaderboard(rows, row.category).findIndex((entry) => entry.userId === member.id) + 1;
      return { row, points: row.points, rank };
    };
    return { week: standing(weekRange(now)), month: standing(monthRange(now)), total: standing(ALL_TIME) };
  }

  // L'équipe : les admins et les coachs (rôle Office).
  function isTeam(userId) {
    if (config.adminIds.has(userId)) return true;
    return Boolean(config.roles.office) && Boolean(guild.members.cache.get(userId)?.roles.cache.has(config.roles.office));
  }

  function isHelpLike(reaction, user) {
    return Boolean(config.channels.help) && reaction.message.channelId === config.channels.help && isLike(reaction.emoji.name) && isTeam(user.id);
  }

  async function fullMessage(message) {
    return message.partial ? message.fetch().catch(() => null) : message;
  }

  // 👍 ou ❤️ de l'équipe sur une réponse dans #entraide : 1 point pour son auteur (une seule fois par message).
  async function awardHelp(reaction, adminId) {
    const message = await fullMessage(reaction.message);
    if (!message || message.author?.bot) return;
    const member = await findMember(message.author.id);
    if (!member || !tracker.isTracked(member)) return;
    const existing = db.getShowup(message.id);
    if (existing?.status === 'valid') return;
    if (existing) db.setStatus(message.id, 'valid', adminId);
    else db.addHelpPoint(message.id, member.id, Date.now());

    const { week, month, total } = standings(member, Date.now());
    const content = helpPointMessage({
      userId: member.id,
      category: week.row.category,
      week,
      month,
      total,
      messageUrl: message.url,
      config,
    });
    await send(channels.showup, content, [member.id]);
    await settle(member.id);
  }

  // L'équipe retire son like : le point est retiré, sauf s'il reste un 👍 ou un ❤️ de l'équipe sur le message.
  async function revokeHelp(reaction, adminId) {
    const showup = db.getShowup(reaction.message.id);
    if (showup?.kind !== 'help' || showup.status !== 'valid') return;
    const message = await fullMessage(reaction.message);
    for (const other of message?.reactions.cache.values() ?? []) {
      if (!isLike(other.emoji.name)) continue;
      const users = await other.users.fetch().catch(() => null);
      if (users?.some((user) => isTeam(user.id))) return;
    }
    db.setStatus(showup.message_id, 'rejected', adminId);
    const totals = db.userTotals(showup.user_id, weekRange(Date.now()));
    await send(channels.showup, helpPointRemovedMessage({ userId: showup.user_id, ...totals }), [showup.user_id]);
    await settle(showup.user_id);
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
      if (isHelpLike(reaction, user)) await awardHelp(reaction, user.id);
    },
    async onReactionRemove(reaction, user) {
      if (isAdminRejection(reaction, user)) await restore(reaction.message.id, user.id);
      if (isHelpLike(reaction, user)) await revokeHelp(reaction, user.id);
    },
    async onMessageDelete(message) {
      if (message.channelId === config.channels.results) await markDeleted(message.id);
    },
    // Rôle gagné ou perdu : catégorie à jour, et libération si l'équipe a retiré le rôle Prisonnier.
    // Rôle Prisonnier donné ou retiré à la main : le verrou de la prison suit (previous : le membre avant).
    async onMemberUpdate(member, previous) {
      const current = guild.members.cache.get(member.id) ?? member;
      const today = dayOf(Date.now());
      tracker.syncCategory(current, today);
      ctx.journey?.syncMember(current, Date.now());
      if (prison.wasReleasedByTeam(current)) await prison.releaseByTeam(current, today);
      const jailed = (someone) => [config.roles.prisoner, config.roles.internalPrisoner].some((roleId) => roleId && someone.roles.cache.has(roleId));
      const isPrisoner = jailed(current);
      const wasPrisoner = previous && !previous.partial ? jailed(previous) : isPrisoner;
      if (isPrisoner && !wasPrisoner) await ctx.lockdown?.lockMember(current);
      if (wasPrisoner && !isPrisoner) await ctx.lockdown?.unlockMember(current);
    },
  };
}
