// Entrées et sorties de prison : rôle Prisonnier, et rôles de récompense mis de côté pendant la prison.

import { prisonReleaseMessage } from './messages.js';
import { send } from './send.js';

export function createPrison({ config, db, channels }) {
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

  // Donne le rôle Prisonnier et note qu'il a bien été donné.
  async function giveRole(member) {
    if (await changeRole(member, config.roles.prisoner, true, 'Entrée en prison')) db.markPrisonRole(member.id);
  }

  async function imprison(member, level) {
    const suspended = rewardRoles.filter((roleId) => member.roles.cache.has(roleId));
    db.addPrison(member.id, level, suspended);
    for (const roleId of suspended) await changeRole(member, roleId, false, 'Entrée en prison');
    await giveRole(member);
  }

  // Retire le rôle Prisonnier et rend les récompenses mises de côté.
  async function free(member) {
    const record = db.getPrison(member.id);
    if (!record) return;
    // La ligne est effacée avant de toucher au rôle : le bot ne prendra pas son propre retrait
    // pour une libération par l'équipe.
    db.removePrison(member.id);
    if (member.roles.cache.has(config.roles.prisoner)) {
      await changeRole(member, config.roles.prisoner, false, 'Sortie de prison');
    }
    for (const roleId of record.suspendedRoles) await changeRole(member, roleId, true, 'Sortie de prison');
  }

  // L'équipe a retiré le rôle Prisonnier à la main, par exemple après une erreur.
  function wasReleasedByTeam(member) {
    const record = db.getPrison(member.id);
    return Boolean(record?.hasRole) && !member.roles.cache.has(config.roles.prisoner);
  }

  // Le compteur de la prison repart de zéro le lendemain de la libération.
  async function releaseByTeam(member, today) {
    db.setResetDay(member.id, today);
    await free(member);
    await send(channels.prison, prisonReleaseMessage(member.id), [member.id]);
  }

  return { imprison, giveRole, free, wasReleasedByTeam, releaseByTeam };
}
