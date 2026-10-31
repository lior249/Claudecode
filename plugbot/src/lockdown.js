// Le verrou de la prison : un prisonnier ne voit plus que la-prison, #flex-resultats et son salon de sortie
// (avec leurs catégories). Tout le reste du serveur lui est caché.
//
// Deux rôles de prison : 💔Prisonnier💔 (membres normaux, salon « sortir de prison ») et Prisonnier interne
// (membres de l'accompagnement, salon « sortir de prison interne », avec les tickets de justification).
//
// 1. Chaque rôle de prison reçoit un ✗ sur « Voir le salon » dans chaque salon et chaque catégorie, et un ✓
//    dans ses salons à lui.
// 2. Règle de Discord : dans un salon où un autre rôle (Free, TikTok…) a un ✓ explicite sur « Voir le salon »,
//    ce ✓ passe avant le ✗ du rôle de prison. Dans ces salons, PlugBot pose en plus un ✗ au nom du
//    prisonnier lui-même, qui passe avant tous les rôles. Il le retire à la sortie de prison.

import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js';
import { prisonExitInstructions } from './messages.js';

const P = PermissionFlagsBits;
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
// Les ✗ posés au nom d'un prisonnier : « Voir le salon », et les actions de la version précédente du verrou.
const MEMBER_DENY_BITS =
  P.ViewChannel | P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads | P.AddReactions | P.Connect | P.SendPolls;

const READ = { ViewChannel: true, ReadMessageHistory: true };
const POST_RESULTS = { ...READ, SendMessages: true, AttachFiles: true };
const TICKETS = { ...READ, SendMessagesInThreads: true, AttachFiles: true };

export function createLockdown(ctx) {
  const { config, guild } = ctx;
  const { roles, channels: ids } = config;
  const internalExitId = () => ctx.journey?.exitChannelId() ?? null;
  // Ce que PlugBot n'a pas pu verrouiller lors du dernier passage.
  let report = { unmanageable: [], errors: [] };

  // Les rôles de prison (le second n'existe que si le parcours de l'accompagnement est actif).
  function prisonRoles() {
    return [roles.prisoner, roles.internalPrisoner].filter(Boolean);
  }

  // Ce que chaque rôle de prison garde : salon -> autorisations.
  function keptFor(roleId) {
    const kept = new Map([
      [ids.prison, READ],
      [ids.results, POST_RESULTS],
    ]);
    if (roleId === roles.prisoner) {
      // Les membres normaux gardent aussi la formation gratuite et « rejoindre l'accompagnement ».
      for (const id of [ids.prisonExit, config.links.freeTraining, config.links.joinPlug].filter(Boolean)) kept.set(id, READ);
    }
    if (roleId === roles.internalPrisoner && internalExitId()) kept.set(internalExitId(), TICKETS);
    return kept;
  }

  function lockable() {
    return [...guild.channels.cache.values()].filter((channel) => LOCKABLE.has(channel.type));
  }

  function manageable(channel) {
    const mine = channel.permissionsFor(guild.members.me);
    return Boolean(mine?.has(P.ViewChannel) && mine.has(P.ManageRoles));
  }

  // Les rôles (hors prison) qui ont un ✓ explicite sur « Voir le salon » ici : ce ✓ passe avant le ✗ de la prison.
  function leakingRoles(channel) {
    const skip = new Set([...prisonRoles(), guild.id]);
    const leaking = new Set();
    for (const overwrite of channel.permissionOverwrites.cache.values()) {
      if (overwrite.type !== OverwriteType.Role || skip.has(overwrite.id)) continue;
      if (overwrite.allow.has(P.ViewChannel, false)) leaking.add(overwrite.id);
    }
    return leaking;
  }

  async function setRole(channel, roleId, permissions) {
    const current = channel.permissionOverwrites.cache.get(roleId);
    const done = Object.entries(permissions).every(([name, value]) =>
      value ? current?.allow.has(P[name], false) : current?.deny.has(P[name], false),
    );
    if (done) return;
    await channel.permissionOverwrites
      .edit(roleId, permissions, { reason: 'Prison : seuls la prison, flex-resultats et la sortie restent visibles' })
      .catch((error) => report.errors.push(`#${channel.name} : ${error.message}`));
  }

  // Pose les permissions des rôles de prison partout. À lancer au démarrage puis chaque nuit (pour les
  // salons créés entre-temps). Renvoie ce qui n'a pas pu être fait, en français.
  async function lockRoles() {
    report = { unmanageable: [], errors: [] };
    const channels = lockable();
    for (const roleId of prisonRoles()) {
      const kept = keptFor(roleId);
      // Les catégories qui contiennent un salon gardé restent visibles, pour que le salon s'affiche.
      const keptParents = new Set([...kept.keys()].map((id) => guild.channels.cache.get(id)?.parentId).filter(Boolean));
      for (const channel of channels) {
        if (!manageable(channel)) {
          if (!report.unmanageable.includes(channel.name)) report.unmanageable.push(channel.name);
          continue;
        }
        if (kept.has(channel.id)) await setRole(channel, roleId, kept.get(channel.id));
        else if (keptParents.has(channel.id)) await setRole(channel, roleId, { ViewChannel: true });
        else await setRole(channel, roleId, { ViewChannel: false });
      }
    }
    // Les salons de sortie ne sont visibles que par les prisonniers concernés (et les coachs, pour les tickets).
    for (const exitId of [ids.prisonExit, internalExitId()].filter(Boolean)) {
      const channel = guild.channels.cache.get(exitId);
      if (!channel || !manageable(channel)) continue;
      await setRole(channel, guild.id, { ViewChannel: false });
      if (exitId === internalExitId() && roles.office) await setRole(channel, roles.office, { ...TICKETS, SendMessages: true });
    }
    return problems();
  }

  function problems() {
    const lines = [];
    if (report.unmanageable.length > 0) {
      lines.push(
        `PlugBot ne peut pas gérer les permissions de ${report.unmanageable.map((name) => `#${name}`).join(', ')} : ` +
          'il lui faut « Voir le salon » et « Gérer les rôles » dans ces salons.',
      );
    }
    return [...lines, ...report.errors];
  }

  // Les salons où un rôle du membre passe avant le ✗ de la prison (sauf ses salons de prison).
  function leaksFor(member, roleId) {
    const kept = keptFor(roleId);
    return lockable().filter(
      (channel) => !kept.has(channel.id) && manageable(channel) && [...leakingRoles(channel)].some((id) => member.roles.cache.has(id)),
    );
  }

  // Le rôle de prison du membre, ou null.
  function prisonRoleOf(member) {
    return prisonRoles().find((roleId) => member.roles.cache.has(roleId)) ?? null;
  }

  // À l'entrée en prison : un ✗ « Voir le salon » au nom du prisonnier là où un de ses rôles passerait avant.
  async function lockMember(member) {
    const roleId = prisonRoleOf(member);
    if (!roleId) return;
    for (const channel of leaksFor(member, roleId)) {
      if (channel.permissionOverwrites.cache.get(member.id)?.deny.has(P.ViewChannel, false)) continue;
      await channel.permissionOverwrites
        .edit(member.id, { ViewChannel: false }, { reason: 'Prison' })
        .catch((error) => console.error(`[PlugBot] Prison : #${channel.name} non caché à ${member.user.tag} :`, error.message));
    }
  }

  // À la sortie : PlugBot retire ses ✗ au nom du membre (et l'autorisation entière si elle est vide).
  async function unlockMember(member) {
    for (const channel of lockable()) {
      const overwrite = channel.permissionOverwrites.cache.get(member.id);
      if (!overwrite || (overwrite.deny.bitfield & MEMBER_DENY_BITS) === 0n) continue;
      try {
        if ((overwrite.deny.bitfield & ~MEMBER_DENY_BITS) === 0n && overwrite.allow.bitfield === 0n) {
          await channel.permissionOverwrites.delete(member.id, 'Sortie de prison');
        } else {
          const reset = Object.fromEntries(Object.keys(P).filter((name) => (P[name] & MEMBER_DENY_BITS) !== 0n).map((name) => [name, null]));
          await channel.permissionOverwrites.edit(member.id, reset, { reason: 'Sortie de prison' });
        }
      } catch (error) {
        console.error(`[PlugBot] Prison : #${channel.name} non rendu à ${member.user.tag} :`, error.message);
      }
    }
  }

  // La consigne du salon « sortir de prison » (membres normaux), publiée une fois puis tenue à jour.
  async function postInstructions() {
    const channel = ctx.channels.prisonExit;
    if (!channel) return;
    const payload = { content: prisonExitInstructions(config), allowedMentions: { parse: [] } };
    const id = ctx.db.getMeta('prison_exit_instructions');
    const existing = id ? await channel.messages.fetch(id).catch(() => null) : null;
    if (existing) await existing.edit(payload);
    else ctx.db.setMeta('prison_exit_instructions', (await channel.send(payload)).id);
  }

  // Version précédente : les membres de l'accompagnement en prison avaient aussi 💔Prisonnier💔.
  // Ils ne gardent que le rôle Prisonnier interne (donné d'abord, pour ne pas paraître libérés).
  async function fixInternalPrisoners(records) {
    if (!roles.internalPrisoner) return;
    for (const [userId, record] of records) {
      const member = guild.members.cache.get(userId);
      if (!record.internal || !member) continue;
      try {
        if (!member.roles.cache.has(roles.internalPrisoner)) await member.roles.add(roles.internalPrisoner, 'Prison interne');
        if (member.roles.cache.has(roles.prisoner)) await member.roles.remove(roles.prisoner, 'Prison interne : un seul rôle de prison');
      } catch (error) {
        console.error(`[PlugBot] Prison interne : rôles de ${member.user.tag} non corrigés :`, error.message);
      }
    }
  }

  // Au démarrage : consigne, rôles de prison verrouillés partout, et prisonniers actuels.
  async function start() {
    const records = ctx.db.prisonRecords();
    await postInstructions().catch((error) => console.error('[PlugBot] Consigne de « sortir de prison » non publiée :', error.message));
    await fixInternalPrisoners(records);
    await lockRoles();
    for (const userId of records.keys()) {
      const member = guild.members.cache.get(userId);
      if (member) await lockMember(member);
    }
    const leaking = lockable().filter((channel) => leakingRoles(channel).size > 0);
    if (leaking.length > 0) {
      console.log(
        `[PlugBot] Prison : ${leaking.length} salon(s) donnent un ✓ « Voir le salon » à un rôle de membres ` +
          `(${leaking.map((channel) => `#${channel.name}`).join(', ')}). PlugBot les cache aux prisonniers un par un.`,
      );
    }
    const issues = problems();
    if (issues.length > 0) console.error(`[PlugBot] Prison : verrou incomplet :\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    else console.log('[PlugBot] Prison : en prison, on ne voit plus que la-prison, flex-resultats et son salon de sortie.');
  }

  return { start, lockRoles, lockMember, unlockMember, prisonRoles };
}
