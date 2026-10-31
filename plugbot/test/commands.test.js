import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { PermissionFlagsBits } from 'discord.js';
import { commandDefinitions, createCommands } from '../src/commands.js';
import { openDatabase } from '../src/db.js';
import { createPrison } from '../src/prison.js';
import { dayOf } from '../src/time.js';
import { createTracker } from '../src/tracker.js';

const ROLES = { free: 'r-free', plug: 'r-tiktok', streak: 'r-feu', weekWinner: 'r-p7', monthWinner: 'r-p30', prisoner: 'r-pri' };
const ADMIN = '900';
// Mercredi 4 novembre 2026, 10 h GMT.
const NOW = Date.UTC(2026, 10, 4, 10);

function fakeMember(id, roles) {
  const cache = new Set(roles);
  return {
    id,
    displayName: `membre${id}`,
    joinedTimestamp: Date.UTC(2026, 0, 1),
    user: { bot: false, tag: `membre${id}` },
    roles: { cache, add: async (role) => cache.add(role), remove: async (role) => cache.delete(role) },
  };
}

function command(name, member, { options = {}, subcommand } = {}) {
  const interaction = {
    commandName: name,
    user: { id: member.id },
    member,
    replies: [],
    options: { getString: (key) => options[key] ?? null, getUser: (key) => options[key] ?? null, getSubcommand: () => subcommand },
    reply: async (payload) => interaction.replies.push(payload),
    deferReply: async () => (interaction.deferred = true),
    editReply: async (payload) => interaction.replies.push(payload),
    followUp: async (payload) => interaction.replies.push(payload),
  };
  return interaction;
}

const text = (reply) => (typeof reply === 'string' ? reply : reply.content);

describe('commandes slash', () => {
  let env;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: NOW });
    const config = {
      guildId: 'guild',
      channels: { results: 'c-res', prison: 'c-prison' },
      links: { guide: 'c-guide' },
      roles: ROLES,
      adminIds: new Set([ADMIN]),
    };
    const db = openDatabase(':memory:');
    db.setMeta('launch_day', dayOf(NOW) - 30);
    const members = new Map();
    const registered = [];
    const prisonChannel = { sent: [], send: async (payload) => prisonChannel.sent.push(payload) };
    const guild = {
      id: 'guild',
      members: { cache: members, fetch: async (id) => members.get(id) },
      commands: { set: async (data) => registered.push(...data) },
    };
    const ctx = { config, db, guild, tracker: createTracker({ config, db }), channels: { prison: prisonChannel } };
    ctx.prison = createPrison(ctx);
    const add = (id, roles) => {
      const member = fakeMember(id, roles);
      members.set(id, member);
      ctx.tracker.syncCategory(member, dayOf(NOW) - 20);
      return member;
    };
    env = { ctx, db, registered, prisonChannel, add, admin: add(ADMIN, []), commands: createCommands(ctx) };
  });

  afterEach(() => {
    mock.timers.reset();
    env.db.close();
  });

  it('propose /moi et /classement à tout le monde, le reste aux admins seulement', () => {
    const basic = commandDefinitions({ events: false, journey: false }).map((command) => command.toJSON());
    assert.deepEqual(basic.map((command) => command.name), ['moi', 'classement', 'liberer']);
    const all = commandDefinitions({ events: true, journey: true }).map((command) => command.toJSON());
    assert.deepEqual(all.map((command) => command.name), ['moi', 'classement', 'liberer', 'evenement', 'membres', 'fiche', 'valider']);
    for (const command of all.slice(2)) assert.equal(command.default_member_permissions, String(PermissionFlagsBits.ManageGuild), command.name);
    assert.equal(all[3].options[0].options[0].choices.length, 14, 'un choix par type de live');
  });

  it('enregistre les commandes sur le serveur, et explique quoi faire si Discord refuse', async (t) => {
    t.mock.method(console, 'log', () => {});
    await env.commands.register();
    assert.deepEqual(env.registered.map((command) => command.name), ['moi', 'classement', 'liberer']);

    const errors = [];
    t.mock.method(console, 'error', (message) => errors.push(message));
    env.ctx.guild.commands.set = async () => {
      throw new Error('Missing Access');
    };
    env.ctx.guild.client = { application: { id: 'app' } };
    await env.commands.register();
    assert.match(errors[0], /Missing Access.*client_id=app&scope=bot\+applications\.commands/);
  });

  it('/moi : points, rangs, chaîne et jours sans show-up', async () => {
    const member = env.add('1', [ROLES.free]);
    env.db.addShowup('a', '1', NOW - 60_000);
    env.db.addShowup('b', '1', NOW - 30_000);
    const interaction = command('moi', member);
    await env.commands.onCommand(interaction);
    const reply = interaction.replies[0];
    assert.equal(reply.flags, 64, 'visible par le membre seul');
    assert.equal(
      reply.content,
      [
        '📊 **Tes stats**',
        "⛓️ Chaîne : **1 jour d'affilée**",
        '📅 Classement semaine : **2 points** — 1er du classement Free',
        '🗓️ Classement mois : **2 points** — 1er du classement Free',
        '🏅 Classement total : **2 points** — 1er du classement Free',
        '🛡️ Jours sans show-up : **0** (la prison arrive à 21).',
      ].join('\n'),
    );

    const outsider = command('moi', env.add('2', []));
    await env.commands.onCommand(outsider);
    assert.match(text(outsider.replies[0]), /il faut le rôle Free ou TikTok/);
  });

  it('/classement : le top de la période et la place du membre', async () => {
    const member = env.add('1', [ROLES.free]);
    env.add('3', [ROLES.plug]);
    env.db.addShowup('a', '1', NOW - 60_000);
    env.db.addShowup('b', '3', NOW - 60_000);
    const interaction = command('classement', member, { options: { periode: 'mois' } });
    await env.commands.onCommand(interaction);
    assert.match(interaction.replies[0].content, /^🏆 \*\*Classement — novembre 2026\*\*\n\n\*\*Accompagnement\*\*\n1\. <@3> — 1 point\n\n\*\*Free\*\*\n1\. <@1> — 1 point\n\n👤 Toi : \*\*1er\*\* avec 1 point\.$/);
    assert.deepEqual(interaction.replies[0].allowedMentions, { parse: [] }, 'personne n’est notifié');
  });

  it('refuse les commandes des coachs aux membres', async () => {
    const member = env.add('1', [ROLES.free]);
    const interaction = command('liberer', member, { options: { membre: { id: '1' } } });
    await env.commands.onCommand(interaction);
    assert.match(text(interaction.replies[0]), /Réservé aux coachs/);
  });

  it('/liberer : sort un membre de prison', async () => {
    const member = env.add('1', [ROLES.free]);
    await env.ctx.prison.imprison(member, 21);
    const interaction = command('liberer', env.admin, { options: { membre: { id: '1' } } });
    await env.commands.onCommand(interaction);
    assert.ok(!member.roles.cache.has(ROLES.prisoner));
    assert.equal(env.db.getPrison('1'), null);
    assert.match(text(interaction.replies.at(-1)), /<@1> est libéré/);
    assert.match(env.prisonChannel.sent.at(-1).content, /libéré de prison par l'équipe/);

    const again = command('liberer', env.admin, { options: { membre: { id: '1' } } });
    await env.commands.onCommand(again);
    assert.match(text(again.replies[0]), /n'est pas en prison/);
  });

  it('/evenement, /membres, /fiche et /valider passent par la planification et le parcours', async () => {
    const calls = [];
    env.ctx.eventService = {
      openTicket: async (type) => {
        calls.push(['ticket', type]);
        return { id: 't1' };
      },
      upcomingList: () => '📋 **Événements à venir**',
      markPlanningDone: () => calls.push(['fini']),
    };
    env.ctx.journey = {
      isCoach: (member) => member.id === ADMIN,
      openList: (coachId, query) => ({ embeds: [{ title: `liste ${query.list}` }] }),
      fichePayload: (userId) => ({ embeds: [{ title: `fiche ${userId}` }] }),
      closeQuestionFor: (userId) => (userId === '1' ? { content: 'Clôturer ?', components: [] } : null),
      journeyLine: () => null,
    };
    const run = async (name, options) => {
      const interaction = command(name, env.admin, options);
      await env.commands.onCommand(interaction);
      return interaction.replies.at(-1);
    };

    assert.equal(text(await run('evenement', { subcommand: 'creer', options: { type: 'masterclass' } })), '🎫 Ticket ouvert : <#t1>');
    assert.match(text(await run('evenement', { subcommand: 'liste' })), /Événements à venir/);
    assert.match(text(await run('evenement', { subcommand: 'fini' })), /tu as fini de créer tes événements/);
    assert.deepEqual(calls, [['ticket', 'masterclass'], ['fini']]);

    assert.equal((await run('membres', { options: { liste: 'stage2' } })).embeds[0].title, 'liste stage2');
    assert.equal((await run('fiche', { options: { membre: { id: '1' } } })).embeds[0].title, 'fiche 1');
    assert.equal(text(await run('valider', { options: { membre: { id: '1' } } })), 'Clôturer ?');
    assert.match(text(await run('valider', { options: { membre: { id: '2' } } })), /n'a pas d'étape à clôturer/);
  });
});
