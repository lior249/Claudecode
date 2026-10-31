// Entrées et sorties de prison : rôle Prisonnier, et rôles de récompense mis de côté pendant la prison.

import { prisonReleaseMessage } from './messages.js';
import { send } from './send.js';

export function createPrison(ctx) {
  const { config, db, channels } = ctx;
  const rewardRoles = [config.roles.weekWinner, config.roles.monthWinner];

  async function changeRole(member, roleId, add, reason) {
    try {
      if (add) await member.roles.add(roleId, reason);
      else await member.roles.remove(roleId, reason);
      return true;
    } catch (error) {
      console.error(`[PlugBot] Impossible de modifier le rôle ${roleId} de ${member.user.tag} :`, error.message);
      return false;
    }
  }

  // Le rôle de prison : 💔Prisonnier💔, ou Prisonnier interne pour les membres du parcours de l'accompagnement.
  function prisonRole(internal) {
    return internal ? config.roles.internalPrisoner : config.roles.prisoner;
  }

  // Donne le rôle de prison et note qu'il a bien été donné. Le verrou cache aussi le serveur au membre
  // lui-même là où un de ses rôles passerait avant le rôle de prison.
  async function giveRole(member, internal = false) {
    if (await changeRole(member, prisonRole(internal), true, internal ? 'Entrée en prison interne' : 'Entrée en prison')) {
      db.markPrisonRole(member.id);
    }
    await ctx.lockdown?.lockMember(member);
  }

  // internal : membre du parcours de l'accompagnement. Il sort seulement par un ticket de justification.
  async function imprison(member, level, { internal = false } = {}) {
    const suspended = rewardRoles.filter((roleId) => member.roles.cache.has(roleId));
    db.addPrison(member.id, level, suspended, internal);
    for (const roleId of suspended) await changeRole(member, roleId, false, 'Entrée en prison');
    await giveRole(member, internal);
    if (internal) await ctx.journey?.afterImprison(member);
  }

  // Retire le rôle Prisonnier et rend les récompenses mises de côté.
  async function free(member) {
    const record = db.getPrison(member.id);
    if (!record) return;
    // La ligne est effacée avant de toucher au rôle : le bot ne prendra pas son propre retrait
    // pour une libération par l'équipe.
    db.removePrison(member.id);
    for (const roleId of [config.roles.prisoner, config.roles.internalPrisoner].filter(Boolean)) {
      if (member.roles.cache.has(roleId)) await changeRole(member, roleId, false, 'Sortie de prison');
    }
    for (const roleId of record.suspendedRoles) await changeRole(member, roleId, true, 'Sortie de prison');
    await ctx.lockdown?.unlockMember(member);
    if (record.internal) await ctx.journey?.afterRelease(member);
  }

  // L'équipe a retiré le rôle de prison à la main, par exemple après une erreur.
  function wasReleasedByTeam(member) {
    const record = db.getPrison(member.id);
    return Boolean(record?.hasRole) && !member.roles.cache.has(prisonRole(record.internal));
  }

  // Le compteur de la prison repart de zéro le lendemain de la libération.
  async function releaseByTeam(member, today) {
    db.setResetDay(member.id, today);
    await free(member);
    await send(channels.prison, prisonReleaseMessage(member.id), [member.id]);
  }

  return { imprison, giveRole, free, wasReleasedByTeam, releaseByTeam };
}
