import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { openDatabase } from '../src/db.js';
import { createHandlers } from '../src/handlers.js';
import { createLockdown } from '../src/lockdown.js';
import { createPrison } from '../src/prison.js';
import { createTracker } from '../src/tracker.js';

const P = PermissionFlagsBits;
const ROLES = { free: 'r-free', plug: 'r-tiktok', weekWinner: 'r-p7', monthWinner: 'r-p30', prisoner: 'r-pri' };
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

function setup({ bot = ALL_BOT, channels = [] } = {}) {
  const cache = new Map();
  const add = (id, name, type, { overwrites, botPermissions = bot } = {}) => {
    const channel = { id, name, type, permissionOverwrites: fakeOverwrites(overwrites), permissionsFor: () => botPermissions };
    cache.set(id, channel);
    return channel;
  };
  add('cat', 'communauté', ChannelType.GuildCategory);
  add('chat', 'discussion', ChannelType.GuildText);
  add('vocal', 'vocal', ChannelType.GuildVoice);
  add('c-res', 'flex-resultats', ChannelType.GuildText);
  add('c-prison', 'la-prison', ChannelType.GuildText);
  for (const [id, name, type, options] of channels) add(id, name, type, options);
  const members = new Map();
  const guild = { id: 'guild', channels: { cache }, members: { me: { id: 'bot' }, cache: members } };
  const config = { roles: ROLES, channels: { results: 'c-res', prison: 'c-prison' } };
  const ctx = { config, guild, db: openDatabase(':memory:'), channels: {} };
  ctx.lockdown = createLockdown(ctx);
  ctx.prison = createPrison(ctx);
  return { ctx, cache, members };
}

function fakeMember(id, roles) {
  const cache = new Set(roles);
  return { id, user: { tag: `membre${id}` }, roles: { cache, add: async (role) => cache.add(role), remove: async (role) => cache.delete(role) } };
}

const denied = (channel, id) => channel.permissionOverwrites.cache.get(id)?.deny ?? new PermissionsBitField();

describe('verrou de la prison', () => {
  it('interdit tout au rôle Prisonnier, dans chaque salon, sauf la prison et flex-resultats', async () => {
    const { ctx, cache } = setup();
    assert.deepEqual(await ctx.lockdown.lockRole(), []);

    const chat = denied(cache.get('chat'), ROLES.prisoner);
    for (const name of ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions', 'SendPolls']) {
      assert.ok(chat.has(P[name]), name);
    }
    assert.ok(denied(cache.get('vocal'), ROLES.prisoner).has(P.Connect), 'pas de vocal');
    assert.ok(denied(cache.get('cat'), ROLES.prisoner).has(P.Connect | P.SendMessages), 'la catégorie aussi, pour les futurs salons');
    assert.ok(!cache.get('c-prison').permissionOverwrites.cache.has(ROLES.prisoner), 'la-prison est laissée telle quelle');
    const results = cache.get('c-res').permissionOverwrites.cache.get(ROLES.prisoner);
    assert.ok(results.allow.has(P.SendMessages | P.AttachFiles), 'il peut poster ses résultats pour sortir');

    // Déjà en place : rien n'est renvoyé à Discord (sauf flex-resultats, toujours réglé).
    const before = cache.get('chat').permissionOverwrites.edits;
    await ctx.lockdown.lockRole();
    assert.equal(cache.get('chat').permissionOverwrites.edits, before);
  });

  it("bloque le prisonnier lui-même là où un de ses rôles a un ✓, et le débloque à la sortie", async () => {
    const { ctx, cache, members } = setup({
      channels: [
        ['free-chat', 'chat-free', ChannelType.GuildText, { overwrites: [{ id: ROLES.free, allow: [P.ViewChannel, P.SendMessages] }] }],
        ['plug-chat', 'chat-accompagnement', ChannelType.GuildText, { overwrites: [{ id: ROLES.plug, allow: [P.SendMessages] }] }],
      ],
    });
    await ctx.lockdown.lockRole();
    const member = fakeMember('1', [ROLES.free]);
    members.set('1', member);
    // Une autorisation au nom du membre posée par ailleurs (par exemple la prison interne) : elle reste.
    await cache.get('chat').permissionOverwrites.edit('1', { ViewChannel: false });

    await ctx.prison.imprison(member, 21);
    assert.ok(member.roles.cache.has(ROLES.prisoner));
    const own = denied(cache.get('free-chat'), '1');
    assert.ok(own.has(P.SendMessages) && own.has(P.AddReactions), 'son ✗ passe avant le ✓ du rôle Free');
    assert.ok(!cache.get('plug-chat').permissionOverwrites.cache.has('1'), "il n'a pas le rôle TikTok : rien à faire là");

    await ctx.prison.free(member);
    assert.ok(!cache.get('free-chat').permissionOverwrites.cache.has('1'));
    assert.ok(denied(cache.get('chat'), '1').has(P.ViewChannel), "l'autre autorisation n'est pas touchée");
  });

  it('explique ce qu’il ne peut pas verrouiller', async () => {
    const withoutConnect = new PermissionsBitField(ALL_BOT).remove(P.Connect);
    const { ctx } = setup({
      bot: withoutConnect,
      channels: [['staff', 'staff', ChannelType.GuildText, { botPermissions: new PermissionsBitField([P.ViewChannel]) }]],
    });
    const problems = await ctx.lockdown.lockRole();
    assert.deepEqual(problems, [
      'PlugBot ne peut pas gérer les permissions de #staff : il lui faut « Voir le salon » et « Gérer les rôles » dans ces salons.',
      "PlugBot n'a pas la permission « Se connecter », il ne peut donc pas l'interdire aux prisonniers (#communauté, #vocal). Active-la dans Paramètres du serveur > Rôles > PlugBot.",
    ]);
  });

  it('suit le rôle Prisonnier donné ou retiré à la main', async () => {
    const { ctx, cache, members } = setup({
      channels: [['free-chat', 'chat-free', ChannelType.GuildText, { overwrites: [{ id: ROLES.free, allow: [P.SendMessages] }] }]],
    });
    ctx.config.adminIds = new Set();
    ctx.tracker = createTracker({ config: ctx.config, db: ctx.db });
    const handlers = createHandlers(ctx);
    const member = fakeMember('1', [ROLES.free]);
    members.set('1', member);
    const before = { roles: { cache: new Set(member.roles.cache) } };

    member.roles.cache.add(ROLES.prisoner);
    await handlers.onMemberUpdate(member, before);
    assert.ok(denied(cache.get('free-chat'), '1').has(P.SendMessages), 'bloqué même sans passer par PlugBot');

    const jailed = { roles: { cache: new Set(member.roles.cache) } };
    member.roles.cache.delete(ROLES.prisoner);
    await handlers.onMemberUpdate(member, jailed);
    assert.ok(!cache.get('free-chat').permissionOverwrites.cache.has('1'));
  });

  it('laisse les salons de la prison interne au parcours', async () => {
    const { ctx, cache } = setup({ channels: [['exit', 'sortir-de-la-prison-interne', ChannelType.GuildText]] });
    ctx.journey = { prisonChannelIds: () => ['exit'] };
    await ctx.lockdown.lockRole();
    assert.ok(!cache.get('exit').permissionOverwrites.cache.has(ROLES.prisoner));
  });
});
