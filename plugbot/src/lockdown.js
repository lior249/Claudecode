// Le verrou de la prison : un prisonnier ne peut plus rien faire sur le serveur, sauf poster ses résultats
// dans #flex-resultats (et, en prison interne, s'expliquer dans son ticket de sortie).
//
// 1. Le rôle Prisonnier reçoit un ✗ sur toutes les actions, dans chaque salon et chaque catégorie.
// 2. Règle de Discord : dans un salon où un autre rôle (Free, TikTok…) a un ✓ explicite sur une action,
//    ce ✓ passe avant le ✗ du rôle Prisonnier. Dans ces salons, PlugBot pose en plus un ✗ au nom du
//    prisonnier lui-même, qui passe avant tous les rôles. Il le retire à la sortie de prison.

import { ChannelType, PermissionFlagsBits } from 'discord.js';

// Ce que la prison interdit : écrire, répondre dans les fils, en créer, réagir, rejoindre un vocal, créer un sondage.
export const BLOCKED = ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions', 'Connect', 'SendPolls'];
const LABELS = {
  SendMessages: 'Envoyer des messages',
  SendMessagesInThreads: 'Envoyer des messages dans les fils',
  CreatePublicThreads: 'Créer des fils publics',
  CreatePrivateThreads: 'Créer des fils privés',
  AddReactions: 'Ajouter des réactions',
  Connect: 'Se connecter',
  SendPolls: 'Créer des sondages',
};
const VOICE = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
// Les actions qui comptent selon le type de salon (« Se connecter » n'a de sens que dans un vocal).
function relevant(channel) {
  if (channel.type === ChannelType.GuildCategory) return BLOCKED;
  return VOICE.has(channel.type) ? ['SendMessages', 'AddReactions', 'Connect'] : BLOCKED.filter((name) => name !== 'Connect');
}
// Ce que le prisonnier garde dans #flex-resultats : poster ses résultats.
const RESULTS_ALLOWED = { ViewChannel: true, ReadMessageHistory: true, SendMessages: true, AttachFiles: true };
// Les salons (pas les fils) dont PlugBot règle les permissions.
const LOCKABLE = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const bits = (names) => names.reduce((total, name) => total | PermissionFlagsBits[name], 0n);
const BLOCKED_BITS = bits(BLOCKED);

export function createLockdown(ctx) {
  const { config, guild } = ctx;
  const prisonerRole = config.roles.prisoner;
  // Ce que PlugBot n'a pas pu verrouiller lors du dernier passage.
  let report = { unmanageable: [], missing: new Map(), errors: [] };

  // Les salons de la prison, où le prisonnier garde ses droits : la-prison, flex-resultats, et les
  // salons de la prison interne (réglés par le parcours de l'accompagnement).
  function exempt() {
    return new Set([config.channels.results, config.channels.prison, ...(ctx.journey?.prisonChannelIds() ?? [])]);
  }

  function lockable() {
    const skip = exempt();
    return [...guild.channels.cache.values()].filter((channel) => LOCKABLE.has(channel.type) && !skip.has(channel.id));
  }

  // Les actions que PlugBot peut interdire dans ce salon : Discord n'accepte un ✗ que sur une permission
  // que PlugBot a lui-même dans le salon. null : PlugBot ne peut pas gérer les permissions du salon.
  function deniable(channel) {
    const mine = channel.permissionsFor(guild.members.me);
    if (!mine?.has(PermissionFlagsBits.ViewChannel) || !mine.has(PermissionFlagsBits.ManageRoles)) return null;
    return relevant(channel).filter((name) => mine.has(PermissionFlagsBits[name]));
  }

  const deny = (names) => Object.fromEntries(names.map((name) => [name, false]));

  // Les rôles qui ont un ✓ explicite sur une action interdite dans ce salon (le ✓ passe avant le ✗ du rôle Prisonnier).
  function leakingRoles(channel) {
    const roles = new Set();
    for (const overwrite of channel.permissionOverwrites.cache.values()) {
      if (overwrite.id === prisonerRole || overwrite.id === guild.id || overwrite.type !== 0) continue;
      if ((overwrite.allow.bitfield & BLOCKED_BITS) !== 0n) roles.add(overwrite.id);
    }
    return roles;
  }

  // Pose le ✗ du rôle Prisonnier partout où il manque, et ouvre #flex-resultats aux prisonniers.
  // À lancer au démarrage puis chaque jour (pour les salons créés entre-temps).
  async function lockRole() {
    report = { unmanageable: [], missing: new Map(), errors: [] };
    for (const channel of lockable()) {
      const names = deniable(channel);
      if (!names) {
        report.unmanageable.push(channel.name);
        continue;
      }
      for (const name of relevant(channel).filter((candidate) => !names.includes(candidate))) {
        report.missing.set(name, [...(report.missing.get(name) ?? []), channel.name]);
      }
      const todo = names.filter((name) => !channel.permissionOverwrites.cache.get(prisonerRole)?.deny.has(PermissionFlagsBits[name]));
      if (todo.length === 0) continue;
      await channel.permissionOverwrites
        .edit(prisonerRole, deny(todo), { reason: 'Prison : le rôle Prisonnier ne peut plus rien faire' })
        .catch((error) => report.errors.push(`#${channel.name} : ${error.message}`));
    }
    const results = guild.channels.cache.get(config.channels.results);
    if (results) {
      await results.permissionOverwrites
        .edit(prisonerRole, RESULTS_ALLOWED, { reason: 'Prison : les prisonniers postent leurs résultats' })
        .catch((error) => report.errors.push(`#${results.name} : ${error.message}`));
    }
    return problems();
  }

  // Ce qui n'a pas pu être verrouillé, en français, une ligne par problème.
  function problems() {
    const list = (names) => names.map((name) => `#${name}`).join(', ');
    const lines = [];
    if (report.unmanageable.length > 0) {
      lines.push(`PlugBot ne peut pas gérer les permissions de ${list(report.unmanageable)} : il lui faut « Voir le salon » et « Gérer les rôles » dans ces salons.`);
    }
    for (const [name, channels] of report.missing) {
      lines.push(`PlugBot n'a pas la permission « ${LABELS[name]} », il ne peut donc pas l'interdire aux prisonniers (${list(channels)}). Active-la dans Paramètres du serveur > Rôles > PlugBot.`);
    }
    return [...lines, ...report.errors];
  }

  // Les salons où un rôle du membre passe avant le ✗ du rôle Prisonnier.
  function leaksFor(member) {
    return lockable().filter((channel) => [...leakingRoles(channel)].some((roleId) => member.roles.cache.has(roleId)));
  }

  // À l'entrée en prison : un ✗ au nom du prisonnier dans ces salons (sauf s'il y est déjà).
  async function lockMember(member) {
    for (const channel of leaksFor(member)) {
      const names = deniable(channel);
      if (!names?.length) continue;
      const own = channel.permissionOverwrites.cache.get(member.id)?.deny;
      if (own && names.every((name) => own.has(PermissionFlagsBits[name]))) continue;
      await channel.permissionOverwrites
        .edit(member.id, deny(names), { reason: 'Prison' })
        .catch((error) => console.error(`[PlugBot] Prison : #${channel.name} non verrouillé pour ${member.user.tag} :`, error.message));
    }
  }

  // À la sortie : PlugBot retire ses ✗ au nom du membre (et l'autorisation entière si elle est vide).
  async function unlockMember(member) {
    for (const channel of lockable()) {
      const overwrite = channel.permissionOverwrites.cache.get(member.id);
      if (!overwrite || (overwrite.deny.bitfield & BLOCKED_BITS) === 0n) continue;
      try {
        const rest = overwrite.deny.bitfield & ~BLOCKED_BITS;
        if (rest === 0n && overwrite.allow.bitfield === 0n) await channel.permissionOverwrites.delete(member.id, 'Sortie de prison');
        else await channel.permissionOverwrites.edit(member.id, Object.fromEntries(BLOCKED.map((name) => [name, null])), { reason: 'Sortie de prison' });
      } catch (error) {
        console.error(`[PlugBot] Prison : #${channel.name} non déverrouillé pour ${member.user.tag} :`, error.message);
      }
    }
  }

  // Au démarrage : le rôle Prisonnier est verrouillé partout, et les prisonniers actuels aussi.
  async function start(prisonerIds) {
    await lockRole();
    for (const userId of prisonerIds) {
      const member = guild.members.cache.get(userId);
      if (member) await lockMember(member);
    }
    const leaking = lockable().filter((channel) => leakingRoles(channel).size > 0);
    if (leaking.length > 0) {
      console.log(
        `[PlugBot] Prison : ${leaking.length} salon(s) donnent un ✓ à un rôle de membres (${leaking.map((channel) => `#${channel.name}`).join(', ')}). ` +
          'PlugBot y bloque les prisonniers un par un.',
      );
    }
    const issues = problems();
    if (issues.length > 0) console.error(`[PlugBot] Prison : blocage incomplet :\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    else console.log('[PlugBot] Prison : le rôle Prisonnier est bloqué dans tous les salons.');
  }

  return { start, lockRole, lockMember, unlockMember, leaksFor };
}
