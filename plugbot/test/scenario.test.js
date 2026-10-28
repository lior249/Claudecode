// Simule un petit serveur Discord pour vérifier le parcours complet de PlugBot.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { SnowflakeUtil } from 'discord.js';
import { openDatabase } from '../src/db.js';
import { createHandlers } from '../src/handlers.js';
import { createJobs } from '../src/jobs.js';
import { startup } from '../src/sync.js';
import { createTracker } from '../src/tracker.js';
import { DAY_MS } from '../src/time.js';

const ROLES = { free: 'role-free', plug: 'role-tiktok', streak: 'role-feu' };
const ADMIN = '900';
// Mercredi 28 octobre 2026, 10 h UTC.
const LAUNCH = Date.UTC(2026, 9, 28, 10);

class FakeCollection extends Map {
  some(fn) {
    return [...this.values()].some(fn);
  }
  find(fn) {
    return [...this.values()].find(fn);
  }
  first() {
    return this.values().next().value;
  }
}

function fakeMember(id, roles, joinedTimestamp = Date.UTC(2026, 0, 1)) {
  const cache = new Set(roles);
  return {
    id,
    joinedTimestamp,
    user: { bot: false, tag: `membre${id}` },
    roles: {
      cache,
      add: async (role) => cache.add(role),
      remove: async (role) => cache.delete(role),
    },
  };
}

function fakeChannel(id) {
  const channel = {
    id,
    sent: [],
    history: [],
    send: async ({ content }) => channel.sent.push(content),
    messages: {
      // Assez fidèle à l'API Discord pour le rattrapage au démarrage.
      fetch: async ({ limit = 50, after, before } = {}) => {
        let list = [...channel.history].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        if (after) list = list.filter((m) => BigInt(m.id) > BigInt(after)).slice(0, limit);
        else {
          if (before) list = list.filter((m) => BigInt(m.id) < BigInt(before));
          list = list.slice(-limit);
        }
        return new FakeCollection(list.reverse().map((m) => [m.id, m]));
      },
    },
  };
  return channel;
}

function fakeMessage(channel, author, { attachment = 'image/png' } = {}) {
  const id = SnowflakeUtil.generate({ timestamp: Date.now() }).toString();
  const message = {
    id,
    guildId: 'guild',
    channelId: channel.id,
    author: { id: author, bot: false },
    createdTimestamp: Date.now(),
    attachments: new FakeCollection(attachment ? [['a', { contentType: attachment, name: 'preuve' }]] : []),
    reactions: { cache: new FakeCollection() },
    reacted: [],
    react: async (emoji) => message.reacted.push(emoji),
  };
  channel.history.push(message);
  return message;
}

function setup() {
  const config = {
    guildId: 'guild',
    channels: { results: 'c-res', showup: 'c-log', elogesFree: 'c-free', elogesPlug: 'c-plug', prison: 'c-prison' },
    roles: ROLES,
    streakRoleDays: 3,
    adminIds: new Set([ADMIN]),
  };
  const db = openDatabase(':memory:');
  const tracker = createTracker({ config, db });
  const memberCache = new FakeCollection();
  const guild = {
    members: {
      cache: memberCache,
      fetch: async (id) => (id ? memberCache.get(id) : memberCache),
    },
  };
  const channels = Object.fromEntries(Object.entries(config.channels).map(([name, id]) => [name, fakeChannel(id)]));
  const ctx = { config, db, tracker, guild, channels };
  const handlers = createHandlers(ctx);
  const jobs = createJobs(ctx, handlers);
  const addMember = (...args) => {
    const member = fakeMember(...args);
    memberCache.set(member.id, member);
    return member;
  };
  return { ctx, db, handlers, jobs, channels, addMember };
}

// Avance l'horloge et lance les tâches programmées, comme le ferait le bot chaque minute.
async function goTo(env, timestamp) {
  mock.timers.setTime(timestamp);
  await env.jobs.tick();
}

const at = (day, hour) => LAUNCH + day * DAY_MS + (hour - 10) * 60 * 60 * 1000;

async function post(env, userId, options) {
  const message = fakeMessage(env.channels.results, userId, options);
  await env.handlers.onNewMessage(message);
  return message;
}

describe('scénario PlugBot', () => {
  let env;

  beforeEach(async () => {
    mock.timers.enable({ apis: ['Date'], now: LAUNCH });
    env = setup();
    await startup(env.ctx, env.handlers);
  });

  afterEach(() => {
    mock.timers.reset();
    env.db.close();
  });

  it("compte chaque résultat, met ❗ et l'annonce dans #show-up", async () => {
    env.addMember('1', [ROLES.free]);
    env.addMember('2', [ROLES.free]);

    const first = await post(env, '1');
    assert.deepEqual(first.reacted, ['❗']);
    assert.match(env.channels.showup.sent.at(-1), /<@1> vient de show up/);
    assert.match(env.channels.showup.sent.at(-1), /Semaine : \*\*1 point\*\* \(1er Free\)/);

    await post(env, '2');
    await post(env, '2');
    assert.match(env.channels.showup.sent.at(-1), /Semaine : \*\*2 points\*\* \(1er Free\) · 🏅 Total : \*\*2 points\*\*/);
    // Plusieurs résultats le même jour : un seul jour de chaîne.
    assert.match(env.channels.showup.sent.at(-1), /Chaîne : \*\*1 jour d'affilée\*\*/);
  });

  it('ignore les messages sans image, les admins et les membres sans rôle', async () => {
    env.addMember('1', [ROLES.free]);
    env.addMember('3', []);
    env.addMember(ADMIN, [ROLES.plug]);
    await post(env, '1', { attachment: null });
    await post(env, '3');
    await post(env, ADMIN);
    assert.equal(env.channels.showup.sent.length, 0);
  });

  it("retire le point sur ❌ de l'admin, et le rend si la ❌ est enlevée", async () => {
    env.addMember('1', [ROLES.plug]);
    const message = await post(env, '1');
    const reaction = { message, emoji: { name: '❌' } };

    await env.handlers.onReactionAdd(reaction, { id: '1' });
    assert.equal(env.channels.showup.sent.length, 1, "la ❌ d'un membre ne compte pas");

    await env.handlers.onReactionAdd(reaction, { id: ADMIN });
    assert.equal(
      env.channels.showup.sent.at(-1),
      `❌ Le point de show-up de <@1> a été retiré par <@${ADMIN}>.\n🏅 Total : **0 point** · 📅 Semaine : **0 point**`,
    );

    await env.handlers.onReactionRemove(reaction, { id: ADMIN });
    assert.match(env.channels.showup.sent.at(-1), /a été rendu par/);
    assert.match(env.channels.showup.sent.at(-1), /Total : \*\*1 point\*\*/);
  });

  it('retire le point si le membre supprime son résultat', async () => {
    env.addMember('1', [ROLES.free]);
    const message = await post(env, '1');
    await env.handlers.onMessageDelete({ id: message.id, channelId: message.channelId });
    assert.match(env.channels.showup.sent.at(-1), /<@1> a supprimé son résultat/);
    assert.equal(env.db.totals().get('1'), undefined);
  });

  it("envoie en prison après 3 jours sans show-up et libère après 3 jours d'affilée", async () => {
    env.addMember('1', [ROLES.free]);
    env.addMember('2', [ROLES.free]);
    env.addMember('3', [ROLES.free]);
    await post(env, '3'); // jour 0 : seul le membre 3 poste

    await goTo(env, at(3, 0) + 60_000);
    assert.equal(env.channels.prison.sent.length, 0, 'le suivi commence le lendemain du lancement');

    await goTo(env, at(4, 0) + 60_000);
    assert.deepEqual(env.channels.prison.sent, [
      "🔒 <@1>, <@2> et <@3> viennent d'entrer en prison : aucun show-up depuis 3 jours.\nPour sortir : 3 jours de show-up d'affilée.",
    ]);

    // Le membre 1 poste 3 jours de suite : il sort au 3e post.
    await goTo(env, at(4, 12));
    await post(env, '1');
    assert.match(env.channels.showup.sent.at(-1), /encore \*\*2 jours\*\*/);
    await goTo(env, at(5, 12));
    await post(env, '1');
    await goTo(env, at(6, 12));
    await post(env, '1');
    assert.equal(env.channels.prison.sent.at(-1), "🔓 <@1> sort de prison après 3 jours de show-up d'affilée !");

    // Les autres s'enfoncent : palier de 6 jours.
    await goTo(env, at(7, 0) + 60_000);
    assert.match(env.channels.prison.sent.at(-1), /^🔒 <@2> et <@3> s'enfoncent dans la prison : 6 jours/);
  });

  it("n'applique la prison qu'après 7 jours entiers sur le serveur", async () => {
    env.addMember('1', [ROLES.free], at(0, 15)); // arrive le jour du lancement à 15 h
    await goTo(env, at(10, 0) + 60_000);
    assert.equal(env.channels.prison.sent.length, 0);
    await goTo(env, at(11, 0) + 60_000);
    assert.match(env.channels.prison.sent.at(-1), /<@1> vient d'entrer en prison/);
  });

  it('donne et retire le rôle de chaîne', async () => {
    const member = env.addMember('1', [ROLES.free]);
    for (const day of [0, 1, 2]) {
      await goTo(env, at(day, 12));
      await post(env, '1');
    }
    assert.ok(member.roles.cache.has(ROLES.streak));
    await goTo(env, at(4, 0) + 60_000);
    assert.ok(!member.roles.cache.has(ROLES.streak), 'la chaîne est brisée après un jour manqué');
  });

  it('publie les éloges le dimanche à 18 h UTC, sans les membres en prison', async () => {
    env.addMember('1', [ROLES.free]);
    env.addMember('2', [ROLES.free]);
    env.addMember('3', [ROLES.plug]);
    env.addMember('4', [ROLES.free]);
    await post(env, '1');
    await post(env, '1');
    await post(env, '2');
    await post(env, '3');
    // Le membre 4 n'a jamais posté. Les autres postent chaque jour jusqu'à dimanche.
    for (const day of [1, 2, 3]) {
      await goTo(env, at(day, 12));
      for (const id of ['1', '2', '3']) await post(env, id);
    }

    await goTo(env, Date.UTC(2026, 10, 1, 17, 59));
    assert.equal(env.channels.elogesFree.sent.length, 0);
    await goTo(env, Date.UTC(2026, 10, 1, 18, 0));

    const free = env.channels.elogesFree.sent.join('\n');
    assert.match(free, /Les éloges de la semaine — Free/);
    assert.match(free, /Top 10 de la semaine\*\*\n1\. <@1> — 5 points\n2\. <@2> — 4 points\n\n/);
    assert.match(free, /Top 10 de la prison\*\*\n1\. <@4> — en prison depuis 1 jour/);
    const plug = env.channels.elogesPlug.sent.join('\n');
    assert.match(plug, /1\. <@3> — 4 points/);
    assert.doesNotMatch(plug, /<@1>/);

    // Les points de la semaine repartent à zéro juste après.
    await post(env, '1');
    assert.match(env.channels.showup.sent.at(-1), /Semaine : \*\*1 point\*\*/);
    assert.match(env.channels.showup.sent.at(-1), /Total : \*\*6 points\*\*/);
  });

  it('rattrape au démarrage les résultats et les ❌ arrivés pendant une coupure', async () => {
    env.addMember('1', [ROLES.free]);
    const counted = await post(env, '1');
    // Le bot est éteint : un nouveau résultat arrive, et l'admin met ❌ sur l'ancien.
    const missed = fakeMessage(env.channels.results, '1');
    counted.reactions.cache.set('❌', {
      emoji: { name: '❌' },
      users: { fetch: async () => new FakeCollection([[ADMIN, { id: ADMIN }]]) },
    });

    await startup(env.ctx, env.handlers);
    assert.deepEqual(missed.reacted, ['❗']);
    assert.equal(env.db.getShowup(counted.id).status, 'rejected');
    assert.equal(env.db.getShowup(missed.id).status, 'valid');
    assert.match(env.channels.showup.sent.at(-1), /a été retiré par/);
  });
});
