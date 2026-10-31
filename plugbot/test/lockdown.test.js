import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { openDatabase } from '../src/db.js';
import { createHandlers } from '../src/handlers.js';
import { createLockdown } from '../src/lockdown.js';
import { createPrison } from '../src/prison.js';
import { createTracker } from '../src/tracker.js';

const P = PermissionFlagsBits;
const ROLES = {
  free: 'r-free',
  plug: 'r-tiktok',
  weekWinner: 'r-p7',
  monthWinner: 'r-p30',
  prisoner: 'r-pri',
  internalPrisoner: 'r-pri-int',
  office: 'r-office',
};
// Toutes les permissions sauf Administrateur (qui vaut toutes les autres pour Discord).
const ALL_BOT = new PermissionsBitField(Object.values(P).reduce((total, flag) => total | flag, 0n)).remove(P.Administrator);

// Les autorisations d'un salon, avec la même règle de fusion que Discord.js (true : ✓, false : ✗, null : /).
function fakeOverwrites(initial = []) {
  const entry = (id, allow = [], deny = []) => ({
    id,
    type: id.startsWith('r-') || id === 'guild' ? 0 : 1,
    allow: new PermissionsBitField(allow),
    deny: new PermissionsBitField(deny),
  });
  const cache = new Map(initial.map(({ id, allow, deny }) => [id, entry(id, allow, deny)]));
  const manager = {
    cache,
    edits: 0,
    edit: async (id, options) => {
      manager.edits++;
      const current = cache.get(id) ?? entry(id);
      for (const [name, value] of Object.entries(options)) {
        current.allow.remove(P[name]);
        current.deny.remove(P[name]);
        if (value === true) current.allow.add(P[name]);
        if (value === false) current.deny.add(P[name]);
      }
      cache.set(id, current);
    },
    delete: async (id) => cache.delete(id),
  };
  return manager;
}

function fakeChannel(id, name, type, { parentId = null, overwrites, botPermissions = ALL_BOT } = {}) {
  const sent = [];
  return {
    id,
    name,
    type,
    parentId,
    sent,
    permissionOverwrites: fakeOverwrites(overwrites),
    permissionsFor: () => botPermissions,
    send: async (payload) => {
      const message = { id: `m${sent.length + 1}`, ...payload, edit: async (changes) => Object.assign(message, changes) };
      sent.push(message);
      return message;
    },
    messages: { fetch: async (id) => sent.find((message) => message.id === id) ?? null },
  };
}

function setup({ channels = [], journey = true } = {}) {
  const cache = new Map();
  const add = (...args) => cache.set(args[0], fakeChannel(...args));
  add('wall', 'le-mur', ChannelType.GuildCategory);
  add('c-prison', 'la-prison', ChannelType.GuildText, { parentId: 'wall' });
  add('exit', 'sortir-de-prison', ChannelType.GuildText, { parentId: 'wall' });
  add('exit-int', 'sortir-de-prison-interne', ChannelType.GuildText, { parentId: 'wall' });
  add('com', 'communauté', ChannelType.GuildCategory);
  add('c-res', 'flex-resultats', ChannelType.GuildText, { parentId: 'com' });
  add('chat', 'discussion', ChannelType.GuildText, { parentId: 'com' });
  add('vocal', 'vocal', ChannelType.GuildVoice, { parentId: 'com' });
  add('offre', 'offre', ChannelType.GuildCategory);
  add('training', 'formation-gratuite', ChannelType.GuildText, { parentId: 'offre' });
  add('join', 'rejoindre-accompagnement', ChannelType.GuildText, { parentId: 'offre' });
  add('pitch', 'temoignages', ChannelType.GuildText, { parentId: 'offre' });
  for (const [id, name, type, options] of channels) add(id, name, type, options);
  const members = new Map();
  const guild = { id: 'guild', channels: { cache }, members: { me: { id: 'bot' }, cache: members, fetch: async (id) => members.get(id) } };
  const config = {
    guildId: 'guild',
    roles: journey ? ROLES : { ...ROLES, internalPrisoner: undefined },
    channels: { results: 'c-res', prison: 'c-prison', prisonExit: 'exit' },
    links: { guide: 'c-guide', freeTraining: 'training', joinPlug: 'join' },
    adminIds: new Set(),
  };
  const db = openDatabase(':memory:');
  const ctx = { config, guild, db, channels: { prison: cache.get('c-prison'), prisonExit: cache.get('exit') } };
  if (journey) ctx.journey = { exitChannelId: () => 'exit-int', syncMember: () => {}, afterImprison: async () => {}, afterRelease: async () => {} };
  ctx.lockdown = createLockdown(ctx);
  ctx.prison = createPrison(ctx);
  return { ctx, cache, members };
}

function fakeMember(id, roles) {
  const cache = new Set(roles);
  return { id, user: { tag: `membre${id}` }, roles: { cache, add: async (role) => cache.add(role), remove: async (role) => cache.delete(role) } };
}

const role = (channel, id) => channel.permissionOverwrites.cache.get(id);
const sees = (channel, id) => role(channel, id)?.allow.has(P.ViewChannel, false) ?? false;
const hidden = (channel, id) => role(channel, id)?.deny.has(P.ViewChannel, false) ?? false;

describe('verrou de la prison', () => {
  it('un prisonnier ne voit plus que la-prison, flex-resultats et son salon de sortie', async () => {
    const { ctx, cache } = setup();
    assert.deepEqual(await ctx.lockdown.lockRoles(), []);

    // 💔Prisonnier💔 : la-prison, flex-resultats (où il poste) et « sortir de prison ».
    for (const id of ['c-prison', 'c-res', 'exit']) assert.ok(sees(cache.get(id), ROLES.prisoner), id);
    assert.ok(role(cache.get('c-res'), ROLES.prisoner).allow.has(P.SendMessages | P.AttachFiles), 'il poste ses résultats pour sortir');
    for (const id of ['chat', 'vocal', 'exit-int', 'pitch']) assert.ok(hidden(cache.get(id), ROLES.prisoner), id);
    // Les membres normaux gardent aussi la formation gratuite et « rejoindre l'accompagnement ».
    for (const id of ['training', 'join', 'offre']) assert.ok(sees(cache.get(id), ROLES.prisoner), id);

    // Prisonnier interne : pareil, mais avec « sortir de prison interne », où il ouvre son ticket.
    for (const id of ['c-prison', 'c-res', 'exit-int']) assert.ok(sees(cache.get(id), ROLES.internalPrisoner), id);
    assert.ok(role(cache.get('exit-int'), ROLES.internalPrisoner).allow.has(P.SendMessagesInThreads));
    for (const id of ['chat', 'vocal', 'exit', 'training', 'join', 'offre']) assert.ok(hidden(cache.get(id), ROLES.internalPrisoner), id);

    // Les catégories des salons gardés restent visibles ; les autres sont cachées.
    assert.ok(sees(cache.get('wall'), ROLES.prisoner) && sees(cache.get('com'), ROLES.prisoner));

    // Les salons de sortie sont cachés à tous les autres ; les coachs voient les tickets de la prison interne.
    assert.ok(hidden(cache.get('exit'), 'guild') && hidden(cache.get('exit-int'), 'guild'));
    assert.ok(sees(cache.get('exit-int'), ROLES.office));

    // Déjà en place : rien n'est renvoyé à Discord.
    const edits = [...cache.values()].reduce((total, channel) => total + channel.permissionOverwrites.edits, 0);
    await ctx.lockdown.lockRoles();
    assert.equal([...cache.values()].reduce((total, channel) => total + channel.permissionOverwrites.edits, 0), edits);
  });

  it('cache aussi les salons au prisonnier lui-même là où un de ses rôles a un ✓, et les rend à la sortie', async () => {
    const { ctx, cache, members } = setup({
      channels: [
        ['free-chat', 'chat-free', ChannelType.GuildText, { overwrites: [{ id: ROLES.free, allow: [P.ViewChannel] }] }],
        ['plug-chat', 'chat-accompagnement', ChannelType.GuildText, { overwrites: [{ id: ROLES.plug, allow: [P.ViewChannel] }] }],
      ],
    });
    await ctx.lockdown.lockRoles();
    const member = fakeMember('1', [ROLES.free]);
    members.set('1', member);
    await cache.get('chat').permissionOverwrites.edit('1', { AttachFiles: false });

    await ctx.prison.imprison(member, 21);
    assert.ok(member.roles.cache.has(ROLES.prisoner));
    assert.ok(hidden(cache.get('free-chat'), '1'), 'son ✗ passe avant le ✓ du rôle Free');
    assert.ok(!cache.get('plug-chat').permissionOverwrites.cache.has('1'), "il n'a pas le rôle TikTok : rien à faire là");

    await ctx.prison.free(member);
    assert.ok(!member.roles.cache.has(ROLES.prisoner));
    assert.ok(!cache.get('free-chat').permissionOverwrites.cache.has('1'));
    assert.ok(role(cache.get('chat'), '1').deny.has(P.AttachFiles), "une autre autorisation n'est pas touchée");
  });

  it("un membre de l'accompagnement n'a que le rôle Prisonnier interne", async () => {
    const { ctx, members } = setup();
    const member = fakeMember('1', [ROLES.plug]);
    members.set('1', member);
    await ctx.prison.imprison(member, 0, { internal: true });
    assert.ok(member.roles.cache.has(ROLES.internalPrisoner));
    assert.ok(!member.roles.cache.has(ROLES.prisoner));
    assert.equal(ctx.prison.wasReleasedByTeam(member), false);
    member.roles.cache.delete(ROLES.internalPrisoner);
    assert.equal(ctx.prison.wasReleasedByTeam(member), true, 'retirer le rôle Prisonnier interne à la main le libère');
  });

  it("au démarrage, retire 💔Prisonnier💔 aux prisonniers de l'accompagnement (ancienne version)", async (t) => {
    t.mock.method(console, 'log', () => {});
    const { ctx, members } = setup();
    const member = fakeMember('1', [ROLES.plug, ROLES.prisoner, ROLES.internalPrisoner]);
    members.set('1', member);
    ctx.db.addPrison('1', 0, [], true);
    await ctx.lockdown.start();
    assert.deepEqual([...member.roles.cache].sort(), [ROLES.internalPrisoner, ROLES.plug].sort());
  });

  it('publie la consigne de « sortir de prison » une seule fois', async (t) => {
    t.mock.method(console, 'log', () => {});
    const { ctx, cache } = setup();
    await ctx.lockdown.start();
    await ctx.lockdown.start();
    const exit = cache.get('exit');
    assert.equal(exit.sent.length, 1);
    assert.match(exit.sent[0].content, /^🔓 \*\*Comment sortir de prison\*\*/);
    assert.match(exit.sent[0].content, /poste un résultat dans <#c-res> \*\*3 jours d'affilée\*\*/);
    assert.match(exit.sent[0].content, /tu ne vois plus que ces salons : <#c-prison>, <#exit>, <#c-res>, <#training> et <#join>\./);
    assert.match(exit.sent[0].content, /Regarde la formation gratuite dans <#training>\.\n🚀 \*\*Tu veux aller plus vite \?\*\* Rejoins l'accompagnement pour avoir les informations et les méthodes tendance du moment, les plus efficaces : <#join>\.$/);
  });

  it('suit le rôle de prison donné ou retiré à la main', async () => {
    const { ctx, cache, members } = setup({
      channels: [['free-chat', 'chat-free', ChannelType.GuildText, { overwrites: [{ id: ROLES.free, allow: [P.ViewChannel] }] }]],
    });
    ctx.tracker = createTracker({ config: ctx.config, db: ctx.db });
    const handlers = createHandlers(ctx);
    const member = fakeMember('1', [ROLES.free]);
    members.set('1', member);
    const before = { roles: { cache: new Set(member.roles.cache) } };

    member.roles.cache.add(ROLES.prisoner);
    await handlers.onMemberUpdate(member, before);
    assert.ok(hidden(cache.get('free-chat'), '1'), 'caché même sans passer par PlugBot');

    const jailed = { roles: { cache: new Set(member.roles.cache) } };
    member.roles.cache.delete(ROLES.prisoner);
    await handlers.onMemberUpdate(member, jailed);
    assert.ok(!cache.get('free-chat').permissionOverwrites.cache.has('1'));
  });

  it('explique ce qu’il ne peut pas verrouiller', async () => {
    const { ctx } = setup({
      journey: false,
      channels: [['staff', 'staff', ChannelType.GuildText, { botPermissions: new PermissionsBitField([P.ViewChannel]) }]],
    });
    assert.deepEqual(await ctx.lockdown.lockRoles(), [
      'PlugBot ne peut pas gérer les permissions de #staff : il lui faut « Voir le salon » et « Gérer les rôles » dans ces salons.',
    ]);
  });
});
