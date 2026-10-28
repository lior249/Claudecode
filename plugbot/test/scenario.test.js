// Simule un petit serveur Discord pour vérifier le parcours complet de PlugBot.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { SnowflakeUtil } from 'discord.js';
import { openDatabase } from '../src/db.js';
import { createHandlers } from '../src/handlers.js';
import { createJobs } from '../src/jobs.js';
import { createPrison } from '../src/prison.js';
import { startup } from '../src/sync.js';
import { createTracker } from '../src/tracker.js';
import { DAY_MS, dayOf } from '../src/time.js';

const ROLES = {
  free: 'role-free',
  plug: 'role-tiktok',
  streak: 'role-feu',
  weekWinner: 'role-plug7',
  monthWinner: 'role-plug30',
  prisoner: 'role-prisonnier',
};
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
    // Mentions autorisées pour chaque message envoyé.
    allowed: [],
    history: [],
    send: async ({ content, allowedMentions }) => {
      channel.sent.push(content);
      channel.allowed.push(allowedMentions);
    },
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
    channels: {
      results: 'c-res',
      showup: 'c-log',
      week: 'c-top7',
      month: 'c-top30',
      prison: 'c-prison',
      allTime: 'c-alltime',
    },
    links: { bonusWeek: 'c-bonus7', bonusMonth: 'c-bonus30', bonusStreak: 'c-bonus21', guide: 'c-guide' },
    roles: ROLES,
    streakRoleDays: 21,
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
  ctx.prison = createPrison(ctx);
  const handlers = createHandlers(ctx);
  const jobs = createJobs(ctx, handlers);
  // Comme à l'arrivée d'un membre sur le serveur : le bot note sa catégorie.
  const addMember = (...args) => {
    const member = fakeMember(...args);
    memberCache.set(member.id, member);
    tracker.syncCategory(member, dayOf(Date.now()));
    return member;
  };
  return { ctx, db, handlers, jobs, channels, addMember };
}

// Avance l'horloge et lance les tâches programmées, comme le ferait le bot chaque minute.
async function goTo(env, timestamp) {
  mock.timers.setTime(timestamp);
  await env.jobs.tick();
}

// Jour `day` après le lancement, à `hour` heures UTC (le jour 0 est le mercredi 28 octobre).
const at = (day, hour) => LAUNCH + day * DAY_MS + (hour - 10) * 60 * 60 * 1000;
const afterMidnight = (day) => at(day, 0) + 60_000;
// 19 h 45 UTC, l'heure des publications du soir.
const evening = (day) => at(day, 19) + 45 * 60_000;

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
    await startup(env.ctx, env.handlers, env.jobs);
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
    assert.match(env.channels.showup.sent.at(-1), /Classement semaine : \*\*1 point\*\* — 1er du classement Free/);

    await post(env, '2');
    await post(env, '2');
    assert.match(
      env.channels.showup.sent.at(-1),
      /📅 Classement semaine : \*\*2 points\*\* — 1er du classement Free\n🗓️ Classement mois : \*\*2 points\*\* — 1er du classement Free\n🏅 Classement total : \*\*2 points\*\* — 1er du classement Free/,
    );
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

  it("Free : alerte à 16 jours, prison à 21, sortie après 3 jours d'affilée", async () => {
    const member = env.addMember('1', [ROLES.free, ROLES.weekWinner]);
    env.addMember('2', [ROLES.free]);
    env.addMember('3', [ROLES.free]);
    await post(env, '3'); // jour 0 : seul le membre 3 poste

    await goTo(env, afterMidnight(16));
    assert.equal(env.channels.prison.sent.length, 0, 'le suivi commence le lendemain du lancement');
    await goTo(env, afterMidnight(17));
    assert.equal(env.channels.prison.sent.length, 1);
    assert.match(env.channels.prison.sent[0], /^⚠️ \*\*Alerte : tu vas en prison\.\*\*/);
    assert.match(env.channels.prison.sent[0], /\n<@1> <@2> <@3>$/);
    await goTo(env, afterMidnight(18));
    assert.equal(env.channels.prison.sent.length, 1, 'une seule alerte par absence');

    await goTo(env, afterMidnight(21));
    assert.equal(env.channels.prison.sent.length, 1);
    await goTo(env, afterMidnight(22));
    assert.equal(
      env.channels.prison.sent.at(-1),
      [
        '🔒 **Tu viens de rejoindre la prison : 21 jours sans show-up.**',
        "Voici comment en sortir : poste un résultat dans <#c-res> pendant 3 jours d'affilée.",
        'Si tu veux plus de détails, va voir <#c-guide>.',
        '',
        'Voici ceux qui viennent de rejoindre la prison :',
        '<@1> <@2> <@3>',
      ].join('\n'),
    );
    assert.ok(member.roles.cache.has(ROLES.prisoner));
    assert.ok(!member.roles.cache.has(ROLES.weekWinner), 'les récompenses sont bloquées en prison');

    // Le membre 1 poste 3 jours de suite : il sort au 3e post et retrouve ses récompenses.
    for (const day of [22, 23]) {
      await goTo(env, at(day, 12));
      await post(env, '1');
    }
    assert.match(env.channels.showup.sent.at(-1), /encore \*\*1 jour\*\*/);
    await goTo(env, at(24, 12));
    await post(env, '1');
    assert.doesNotMatch(env.channels.showup.sent.at(-1), /Toujours en prison/);
    assert.equal(env.channels.prison.sent.at(-1), "🔓 <@1> sort de prison après 3 jours de show-up d'affilée !");
    assert.ok(!member.roles.cache.has(ROLES.prisoner));
    assert.ok(member.roles.cache.has(ROLES.weekWinner));

    // Les autres atteignent le dernier palier.
    await goTo(env, afterMidnight(31));
    assert.match(env.channels.prison.sent.at(-1), /^🔒 \*\*Définitivement en prison : 30 jours sans show-up\.\*\*[\s\S]*\n<@2> <@3>$/);
  });

  it("Accompagnement : alerte à 10 jours, prison à 15", async () => {
    env.addMember('1', [ROLES.plug]);
    await goTo(env, afterMidnight(10));
    assert.equal(env.channels.prison.sent.length, 0);
    await goTo(env, afterMidnight(11));
    assert.match(env.channels.prison.sent.at(-1), /^⚠️/);
    await goTo(env, afterMidnight(16));
    assert.match(env.channels.prison.sent.at(-1), /^🔒 \*\*Tu viens de rejoindre la prison : 15 jours sans show-up\.\*\*[\s\S]*\n<@1>$/);
  });

  it('remet le compteur à zéro quand le membre change de rôle', async () => {
    const member = env.addMember('1', [ROLES.plug, ROLES.free]);
    await goTo(env, afterMidnight(14)); // 13 jours sans show-up dans l'accompagnement

    // Il quitte l'accompagnement : il redevient Free et repart de zéro, avec 21 jours.
    member.roles.cache.delete(ROLES.plug);
    await env.handlers.onMemberUpdate(member);
    await goTo(env, afterMidnight(16));
    assert.ok(!env.channels.prison.sent.some((m) => m.startsWith('🔒')));
    await goTo(env, afterMidnight(35));
    assert.ok(!env.channels.prison.sent.some((m) => m.startsWith('🔒')));
    await goTo(env, afterMidnight(36));
    assert.match(env.channels.prison.sent.at(-1), /^🔒 \*\*Tu viens de rejoindre la prison : 21 jours[\s\S]*\n<@1>$/);
  });

  it('un changement de rôle ne fait pas sortir de prison', async () => {
    const member = env.addMember('1', [ROLES.plug, ROLES.free]);
    await goTo(env, afterMidnight(16));
    assert.ok(member.roles.cache.has(ROLES.prisoner));
    member.roles.cache.delete(ROLES.plug);
    await env.handlers.onMemberUpdate(member);
    await goTo(env, afterMidnight(17));
    assert.ok(member.roles.cache.has(ROLES.prisoner));
  });

  it("libère un membre quand l'équipe retire le rôle Prisonnier", async () => {
    const member = env.addMember('1', [ROLES.free]);
    await goTo(env, afterMidnight(22));
    assert.ok(member.roles.cache.has(ROLES.prisoner));

    member.roles.cache.delete(ROLES.prisoner);
    await env.handlers.onMemberUpdate(member);
    assert.equal(env.channels.prison.sent.at(-1), "🔓 <@1> a été libéré de prison par l'équipe.");

    // Le compteur repart de zéro : pas de retour en prison le lendemain.
    await goTo(env, afterMidnight(23));
    assert.ok(!member.roles.cache.has(ROLES.prisoner));
    assert.equal(env.channels.prison.sent.at(-1), "🔓 <@1> a été libéré de prison par l'équipe.");
  });

  it("repère aussi une libération par l'équipe faite pendant une coupure", async () => {
    const member = env.addMember('1', [ROLES.free]);
    await goTo(env, afterMidnight(22));
    member.roles.cache.delete(ROLES.prisoner);
    await goTo(env, afterMidnight(23));
    assert.match(env.channels.prison.sent.at(-1), /a été libéré de prison par l'équipe/);
  });

  it("n'applique la prison qu'après 7 jours entiers sur le serveur", async () => {
    env.addMember('1', [ROLES.free], at(0, 15)); // arrive le jour du lancement à 15 h
    await goTo(env, afterMidnight(28));
    assert.ok(!env.channels.prison.sent.some((m) => m.startsWith('🔒')));
    await goTo(env, afterMidnight(29));
    assert.match(env.channels.prison.sent.at(-1), /Tu viens de rejoindre la prison[\s\S]*\n<@1>$/);
  });

  it('donne le rôle 🔥🔥🔥 à 21 jours et le retire dès que la chaîne casse', async () => {
    const member = env.addMember('1', [ROLES.free]);
    for (let day = 0; day < 21; day++) {
      await goTo(env, at(day, 12));
      await post(env, '1');
    }
    assert.ok(member.roles.cache.has(ROLES.streak));
    assert.equal(
      env.channels.showup.sent.at(-1),
      "🎉 Hourra <@1> ! Tu viens de gagner le challenge des 21 jours d'affilée (🔥🔥🔥).\nTu gagnes −15 % sur la formation.\nRetrouve tes bénéfices dans <#c-bonus21>.",
    );
    assert.deepEqual(env.channels.showup.allowed.at(-1), { users: ['1'] }, 'seul le gagnant est notifié');
    await goTo(env, afterMidnight(22));
    assert.ok(!member.roles.cache.has(ROLES.streak), 'la chaîne est brisée après un jour manqué');
  });

  it('top-7 : lancement le lundi, classement du mardi au samedi, clôture le dimanche', async () => {
    const one = env.addMember('1', [ROLES.free]);
    env.addMember('2', [ROLES.free]);
    const three = env.addMember('3', [ROLES.plug]);

    // Semaine incomplète du lancement : pas de clôture le dimanche 1er novembre.
    await goTo(env, Date.UTC(2026, 10, 1, 19, 45));
    assert.equal(env.channels.week.sent.length, 0);

    // Pas de pause : dès dimanche 18 h, les résultats comptent pour la nouvelle semaine.
    await goTo(env, at(5, 12));
    await post(env, '1');
    await post(env, '1');
    assert.match(env.channels.showup.sent.at(-1), /Classement semaine : \*\*2 points\*\* — 1er du classement Free/);

    await goTo(env, evening(5));
    assert.equal(env.channels.week.sent.length, 1);
    assert.match(env.channels.week.sent[0], /^@everyone\n⚡ \*\*Le challenge de la semaine est lancé !\*\*/);
    assert.deepEqual(env.channels.week.allowed[0], { parse: ['everyone', 'users'] }, 'tout le serveur est notifié');

    // Du mardi 3 au samedi 7 novembre (jours 6 à 10) : posts, puis classement du jour à 18 h.
    for (let day = 6; day <= 10; day++) {
      await goTo(env, at(day, 12));
      await post(env, '1');
      await post(env, '1');
      await post(env, '2');
      await post(env, '3');
      await goTo(env, evening(day));
    }
    assert.equal(env.channels.week.sent.length, 6);
    assert.match(env.channels.week.sent[1], /classement du jour\*\*\nPlus que 5 jours avant la fin/);
    assert.match(env.channels.week.sent[1], /\*\*Free\*\*\n1\. <@1> — 4 points\n2\. <@2> — 1 point/);
    assert.match(env.channels.week.sent[5], /Dernier jour avant la fin/);

    await goTo(env, Date.UTC(2026, 10, 8, 19, 44));
    assert.equal(env.channels.week.sent.length, 6);
    await goTo(env, Date.UTC(2026, 10, 8, 19, 45));

    assert.equal(
      env.channels.week.sent.at(-1),
      [
        '@everyone',
        '⚡ **Classement de la semaine**',
        env.channels.week.sent.at(-1).split('\n')[2],
        '',
        '**Accompagnement**',
        '1. <@3> — 5 points',
        '',
        '**Free**',
        '1. <@1> — 12 points',
        '2. <@2> — 5 points',
        '',
        '🏆 <@3> remporte le classement Accompagnement !',
        '⚡ <@1> remporte <@&role-plug7> : −25 % sur la formation !',
      ].join('\n'),
    );
    assert.ok(one.roles.cache.has(ROLES.weekWinner));
    assert.ok(!three.roles.cache.has(ROLES.weekWinner), "l'accompagnement ne gagne pas la réduction");

    // Le récap des récompenses part dans show-up, avec @everyone.
    const recap = env.channels.showup.sent.findLast((m) => m.includes('Voici ce que tu gagnes'));
    assert.match(recap, /^@everyone\n🏆/);
    assert.match(recap, /regarde <#c-guide>\.$/);

    // 3 minutes après la clôture, un message pour le seul gagnant Free.
    await goTo(env, Date.UTC(2026, 10, 8, 19, 47));
    assert.match(env.channels.week.sent.at(-1), /^@everyone\n⚡ \*\*Classement de la semaine/);
    await goTo(env, Date.UTC(2026, 10, 8, 19, 48));
    assert.equal(
      env.channels.week.sent.at(-1),
      '🎉 Hourra <@1> ! Tu viens de gagner le challenge de la semaine (top 7).\nTu gagnes −25 % sur la formation.\nRetrouve tes bénéfices dans <#c-bonus7>.',
    );
    assert.deepEqual(env.channels.week.allowed.at(-1), { users: ['1'] });

    // La nouvelle semaine démarre tout de suite.
    await post(env, '1');
    assert.match(env.channels.showup.sent.at(-1), /Classement semaine : \*\*1 point\*\*/);
    assert.match(env.channels.showup.sent.at(-1), /Classement total : \*\*13 points\*\*/);
  });

  it('top-30 : lancement le 1er, classement le dimanche, rappels, clôture le dernier jour', async () => {
    const one = env.addMember('1', [ROLES.free]);
    env.addMember('2', [ROLES.free]);
    env.addMember('3', [ROLES.plug]);
    env.addMember('5', [ROLES.free]);

    // Mois incomplet du lancement : pas de clôture le 31 octobre.
    await goTo(env, Date.UTC(2026, 9, 31, 19, 45));
    assert.equal(env.channels.month.sent.length, 0);

    // Novembre : jours 4 (1er novembre) à 33 (30 novembre).
    for (let day = 4; day <= 33; day++) {
      await goTo(env, at(day, 12));
      await post(env, '1');
      if (day % 2 === 0) await post(env, '2');
      if (day % 3 === 0) await post(env, '3');
      // Le membre 5 poste 3 jours puis disparaît : il est en prison à la fin du mois.
      if (day <= 6) await post(env, '5');
    }
    await goTo(env, Date.UTC(2026, 10, 30, 19, 45));

    const sent = env.channels.month.sent;
    assert.match(sent[0], /^@everyone\n★ \*\*Le challenge du mois de novembre 2026 est lancé !\*\*/);
    // Classement provisoire les dimanches 8, 15, 22 et 29 ; rappel les 10, 20 et 25 novembre.
    assert.equal(sent.filter((m) => m.includes('classement provisoire')).length, 4);
    const reminders = sent.filter((m) => m.includes('Rappel'));
    assert.equal(reminders.length, 3);
    assert.match(reminders[0], /Plus que 20 jours avant la fin/);
    assert.doesNotMatch(reminders[0], /<@1>/, 'un rappel ne contient pas de classement');
    assert.equal(sent.length, 9);
    assert.ok(env.channels.month.allowed.every((allowed) => allowed.parse.includes('everyone')));

    const final = sent.at(-1);
    assert.match(final, /^@everyone\n★ \*\*Classement du mois — novembre 2026\*\*/);
    assert.match(
      final,
      /\*\*Accompagnement\*\*\n1\. <@3> — 10 points\n\n\*\*Free\*\*\n1\. <@1> — 30 points\n2\. <@2> — 15 points/,
    );
    assert.doesNotMatch(final, /<@5>/);
    assert.match(final, /🏆 <@3> remporte le classement Accompagnement !\n★ <@1> remporte <@&role-plug30> : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !$/);
    assert.ok(one.roles.cache.has(ROLES.monthWinner));

    await goTo(env, Date.UTC(2026, 10, 30, 19, 48));
    assert.match(env.channels.month.sent.at(-1), /^🎉 Hourra <@1> ! Tu viens de gagner le challenge du mois \(top 30\)\.[\s\S]*<#c-bonus30>\.$/);
  });

  it('publie le top all-time chaque dimanche à 19 h 45', async () => {
    env.addMember('1', [ROLES.free]);
    env.addMember('3', [ROLES.plug]);
    await post(env, '1');
    await post(env, '1');
    await post(env, '1');
    await post(env, '3');

    await goTo(env, Date.UTC(2026, 10, 1, 19, 44));
    assert.equal(env.channels.allTime.sent.length, 0);
    await goTo(env, Date.UTC(2026, 10, 1, 19, 45));
    assert.equal(env.channels.allTime.sent.length, 1);
    assert.match(env.channels.allTime.sent[0], /^@everyone\n👑 \*\*Classement all-time\*\*/);
    assert.match(env.channels.allTime.sent[0], /\*\*Accompagnement\*\*\n1\. <@3> — 1 point\n\n\*\*Free\*\*\n1\. <@1> — 3 points/);
    assert.deepEqual(env.channels.allTime.allowed[0], { parse: ['everyone', 'users'] });

    await goTo(env, Date.UTC(2026, 10, 2, 19, 45));
    assert.equal(env.channels.allTime.sent.length, 1, 'seulement le dimanche');
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

    await startup(env.ctx, env.handlers, env.jobs);
    assert.deepEqual(missed.reacted, ['❗']);
    assert.equal(env.db.getShowup(counted.id).status, 'rejected');
    assert.equal(env.db.getShowup(missed.id).status, 'valid');
    assert.match(env.channels.showup.sent.at(-1), /a été retiré par/);
  });
});
