// Simule le serveur Discord pour vérifier la planification des événements de bout en bout.

import assert from 'node:assert/strict';
import { ChannelType, GuildScheduledEventEntityType } from 'discord.js';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { openDatabase } from '../src/db.js';
import { createInteractionHandler } from '../src/events/interactions.js';
import { createEventService } from '../src/events/service.js';
import { createEventStore } from '../src/events/store.js';

const ADMIN = '900';
const HOUR = 60 * 60 * 1000;
// Mercredi 28 octobre 2026, 10 h GMT. Le live testé : jeudi 5 novembre, 22 h GMT.
const NOW = Date.UTC(2026, 9, 28, 10);
const START = Date.UTC(2026, 10, 5, 22);

let nextId = 1;

function fakeTextChannel(id) {
  const channel = {
    id,
    sent: [],
    send: async (payload) => {
      const message = typeof payload === 'string' ? { content: payload } : payload;
      const sent = {
        id: `m${nextId++}`,
        ...message,
        reactions: [],
        react: async (emoji) => sent.reactions.push(emoji),
        pin: async () => {},
        edit: async (update) => Object.assign(sent, update),
      };
      channel.sent.push(sent);
      return sent;
    },
  };
  return channel;
}

function fakeThread(name) {
  const thread = fakeTextChannel(`t${nextId++}`);
  return Object.assign(thread, {
    name,
    archived: false,
    deleted: false,
    members: { add: async () => {} },
    messages: { edit: async (id, payload) => Object.assign(thread.sent.find((m) => m.id === id), payload) },
    setName: async (value) => (thread.name = value),
    setArchived: async (value) => (thread.archived = value),
    delete: async () => (thread.deleted = true),
  });
}

function setup() {
  const db = openDatabase(':memory:');
  const events = createEventStore(db.connection);
  const config = { roles: { free: 'r-free', plug: 'r-tiktok' }, adminIds: new Set([ADMIN]) };
  const threads = new Map();
  const voice = { id: 'vocal', type: ChannelType.GuildVoice };
  const stage = { id: 'stage', type: ChannelType.GuildStageVoice };
  const planning = fakeTextChannel('planning');
  planning.threads = {
    create: async ({ name }) => {
      const thread = fakeThread(name);
      threads.set(thread.id, thread);
      return thread;
    },
  };
  planning.messages = { fetch: async (id) => planning.sent.find((m) => m.id === id) ?? null };
  const scheduled = { created: [], edited: [], deleted: [] };
  const guild = {
    id: 'guild',
    channels: { fetch: async (id) => threads.get(id) ?? { vocal: voice, stage }[id] ?? null },
    scheduledEvents: {
      create: async (options) => {
        scheduled.created.push(options);
        return { id: `ev${scheduled.created.length}` };
      },
      edit: async (id, options) => scheduled.edited.push({ id, options }),
      delete: async (id) => scheduled.deleted.push(id),
      fetch: async (id) => ({ id, scheduledStartTimestamp: START, channelId: 'vocal', entityMetadata: null }),
    },
  };
  const channels = {
    planning,
    planningReminder: fakeTextChannel('rappels'),
    announceFree: fakeTextChannel('free'),
    announcePlug: fakeTextChannel('plug'),
  };
  const ctx = { config, db, events, guild, channels };
  const service = createEventService(ctx);
  return { ...ctx, service, threads, scheduled, onInteraction: createInteractionHandler(ctx, service) };
}

// Remplit un ticket comme l'admin le ferait avec les menus et le formulaire.
async function fillTicket(env, type = 'masterclass', changes = {}) {
  const thread = await env.service.openTicket(type, NOW);
  const event = env.events.byThread(thread.id);
  env.events.update(event.id, {
    audience: 'free',
    title: 'Les accroches qui retiennent',
    startAt: START,
    locationChannel: 'vocal',
    roles: ['everyone'],
    ...changes,
  });
  return { thread, eventId: event.id };
}

describe('planification des événements', () => {
  let env;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: NOW });
    env = setup();
  });

  afterEach(() => {
    mock.timers.reset();
    env.db.close();
  });

  it('ouvre un ticket avec ses réglages et son résumé', async () => {
    const thread = await env.service.openTicket('decouverte', NOW);
    assert.equal(thread.name, '🔍 Live découverte');
    assert.equal(thread.sent.length, 2);
    assert.equal(thread.sent[0].components.length, 5);
    assert.match(thread.sent[1].content, /Statut :\*\* 📝 Brouillon/);
    const event = env.events.byThread(thread.id);
    assert.equal(event.audience, null, 'deux publics possibles : à choisir');
    assert.equal(env.events.byThread((await env.service.openTicket('coaching', NOW)).id).audience, 'free');
  });

  it('refuse de valider tant qu’il manque des informations', async () => {
    const thread = await env.service.openTicket('masterclass', NOW);
    const error = await env.service.validate(env.events.byThread(thread.id).id, NOW);
    assert.equal(error, "Il manque le public, le sujet, la date et l'heure, le lieu.");
    assert.equal(env.scheduled.created.length, 0);
  });

  it('valide : crée l’événement Discord, publie l’annonce et programme les rappels', async () => {
    const { thread, eventId } = await fillTicket(env);
    assert.equal(await env.service.validate(eventId, NOW), null);

    const [options] = env.scheduled.created;
    assert.equal(options.name, '🎓 Les accroches qui retiennent');
    assert.equal(options.entityType, GuildScheduledEventEntityType.Voice);
    assert.equal(options.channel, 'vocal');
    assert.equal(options.scheduledEndTime.getTime(), START + HOUR);

    const [announcement] = env.channels.announceFree.sent;
    assert.match(announcement.content, /^@everyone\n🎓 \*\*Masterclass — Les accroches qui retiennent\*\*/);
    assert.match(announcement.content, /https:\/\/discord\.com\/events\/guild\/ev1/);
    assert.deepEqual(announcement.allowedMentions, { parse: ['everyone'], roles: [] });

    assert.deepEqual(
      env.events.remindersOf(eventId).map((r) => r.kind),
      ['7d', '3d', '24h', '3h', 'feedback'],
    );
    assert.equal(thread.name, '🎓 Les accroches qui retiennent — jeudi 5 novembre');
    assert.match(thread.sent[1].content, /Statut :\*\* ✅ Programmé/);

    // Dans le salon des rappels : « Est-ce que tu as fini de créer tes événements ? »
    const [question] = env.channels.planningReminder.sent;
    assert.equal(
      question.content,
      '<@900> ✅ **🎓 Les accroches qui retiennent** est programmé : jeudi 5 novembre à 22 h 00 (GMT).\nEst-ce que tu as fini de créer tes événements ?',
    );
    assert.deepEqual(
      question.components[0].components.map((button) => button.data.custom_id),
      ['ev:finished:', 'ev:another:'],
    );
  });

  it('envoie les rappels à l’heure, puis le sondage d’avis, et ferme le ticket', async () => {
    const { thread, eventId } = await fillTicket(env, 'masterclass', { roles: ['free'] });
    await env.service.validate(eventId, NOW);
    const free = env.channels.announceFree;

    await env.service.tick(START - 7 * 24 * HOUR - 1);
    assert.equal(free.sent.length, 1, 'pas encore');
    await env.service.tick(START - 7 * 24 * HOUR);
    assert.match(free.sent.at(-1).content, /^<@&r-free>\n📌 \*\*Dans une semaine\*\*/);
    assert.deepEqual(free.sent.at(-1).allowedMentions, { parse: [], roles: ['r-free'] });

    await env.service.tick(START - HOUR);
    assert.equal(free.sent.length, 5, '7 j, 3 j, 24 h et 3 h envoyés, une seule fois chacun');
    await env.service.tick(START - HOUR);
    assert.equal(free.sent.length, 5);

    await env.service.tick(START + HOUR);
    const feedback = free.sent.at(-1);
    assert.match(feedback.content, /Merci d'avoir participé à \*\*Les accroches qui retiennent\*\*/);
    assert.equal(feedback.poll.question.text, 'Comment as-tu trouvé le live ?');
    assert.equal(env.events.get(eventId).status, 'done');
    assert.equal(thread.archived, true);
  });

  it('publie dans le salon de l’accompagnement pour ce public', async () => {
    const { eventId } = await fillTicket(env, 'questions', { audience: 'plug', roles: ['plug'] });
    await env.service.validate(eventId, NOW);
    assert.equal(env.channels.announcePlug.sent.length, 1);
    assert.equal(env.channels.announceFree.sent.length, 0);
    assert.match(env.channels.announcePlug.sent[0].content, /^<@&r-tiktok>\n❓ \*\*Questions-réponses/);
  });

  it('crée un événement externe avec un lien', async () => {
    const { eventId } = await fillTicket(env, 'masterclass', { locationChannel: null, locationUrl: 'https://youtu.be/live' });
    await env.service.validate(eventId, NOW);
    const [options] = env.scheduled.created;
    assert.equal(options.entityType, GuildScheduledEventEntityType.External);
    assert.deepEqual(options.entityMetadata, { location: 'https://youtu.be/live' });
  });

  it('enregistre un changement d’horaire et prévient les membres', async () => {
    const { eventId } = await fillTicket(env);
    await env.service.validate(eventId, NOW);
    env.events.update(eventId, { startAt: START + HOUR });
    assert.equal(await env.service.saveChanges(eventId, NOW), null);
    assert.equal(env.scheduled.edited.length, 1);
    assert.match(env.channels.announceFree.sent.at(-1).content, /✏️ \*\*Changement pour 🎓 Les accroches qui retiennent\*\*\nNouvel horaire : 📅 jeudi 5 novembre à 23 h 00 \(GMT\)/);
    assert.equal(env.events.remindersOf(eventId).at(-1).sendAt, START + 2 * HOUR);
  });

  it('annule : supprime l’événement, les rappels, prévient et ferme le ticket', async () => {
    const { thread, eventId } = await fillTicket(env);
    await env.service.validate(eventId, NOW);
    await env.service.cancel(eventId);
    assert.deepEqual(env.scheduled.deleted, ['ev1']);
    assert.deepEqual(env.events.remindersOf(eventId), []);
    assert.match(env.channels.announceFree.sent.at(-1).content, /est annulé/);
    assert.equal(thread.archived, true);
    await env.service.tick(START);
    assert.equal(env.channels.announceFree.sent.length, 2, 'plus aucun rappel');
  });

  it('demande le planning le dimanche dans le salon des rappels, et relance jusqu’à « J’ai fini »', async () => {
    const reminders = env.channels.planningReminder;
    await env.service.tick(Date.UTC(2026, 10, 1, 9));
    assert.equal(env.channels.planning.sent.length, 0, 'rien dans le salon de création');
    assert.match(reminders.sent[0].content, /^<@900>\n📅 \*\*Planning de la semaine du lundi 2 novembre au dimanche 8 novembre\*\*/);
    assert.match(reminders.sent[0].content, /mercredi 4 novembre à 22 h 00 \(GMT\) et vendredi 6 novembre à 22 h 00 \(GMT\)/);
    assert.match(reminders.sent[0].content, /👍 \*\*Oui\*\*, j'ai des événements à créer\n👎 \*\*Non\*\*, rien à créer cette semaine/);
    assert.deepEqual(reminders.sent[0].reactions, ['👍', '👎']);
    await env.service.tick(Date.UTC(2026, 10, 1, 9, 30));
    assert.equal(reminders.sent.length, 1);
    await env.service.tick(Date.UTC(2026, 10, 1, 15));
    assert.match(reminders.sent[1].content, /Petit rappel : tu n'as pas encore fini de créer tes événements/);

    env.service.markPlanningDone(Date.UTC(2026, 10, 1, 16));
    await env.service.tick(Date.UTC(2026, 10, 1, 18));
    await env.service.tick(Date.UTC(2026, 10, 2, 9));
    assert.equal(reminders.sent.length, 2, 'plus de relance');
  });

  it('relance aussi le lundi, puis s’arrête', async () => {
    const reminders = env.channels.planningReminder;
    for (const hour of [9, 15, 18]) await env.service.tick(Date.UTC(2026, 10, 1, hour));
    for (const hour of [9, 15, 18]) await env.service.tick(Date.UTC(2026, 10, 2, hour));
    await env.service.tick(Date.UTC(2026, 10, 3, 9));
    assert.equal(reminders.sent.length, 6);
  });

  it('👍 sur la demande du planning : envoie créer les événements, et continue de relancer', async () => {
    const reminders = env.channels.planningReminder;
    const { eventId } = await fillTicket(env, 'masterclass');
    await env.service.validate(eventId, NOW);
    await env.service.tick(Date.UTC(2026, 10, 1, 9));
    const prompt = reminders.sent.at(-1);
    assert.match(prompt.content, /Déjà programmés :\n• 🎓 \*\*Les accroches qui retiennent\*\* — jeudi 5 novembre à 22 h 00 \(GMT\)/);

    const react = (emoji, userId = ADMIN) => env.service.onReaction({ emoji: { name: emoji }, message: { id: prompt.id } }, { id: userId }, NOW);
    assert.equal(await react('👍', '123'), false, 'seul l’admin répond');
    assert.equal(await react('👍'), true);
    assert.match(reminders.sent.at(-1).content, /^👌 Parfait ! Va directement dans <#planning> et crée ton événement/);

    await env.service.tick(Date.UTC(2026, 10, 1, 15));
    assert.match(reminders.sent.at(-1).content, /Petit rappel/, 'rien de fini : la relance continue');
  });

  it('👎 sur la demande du planning : plus de relance cette semaine', async () => {
    const reminders = env.channels.planningReminder;
    await env.service.tick(Date.UTC(2026, 10, 1, 9));
    const prompt = reminders.sent.at(-1);
    assert.equal(await env.service.onReaction({ emoji: { name: '👎🏾' }, message: { id: prompt.id } }, { id: ADMIN }, NOW), true);
    assert.match(reminders.sent.at(-1).content, /^✅ C'est noté : rien à créer cette semaine/);
    await env.service.tick(Date.UTC(2026, 10, 1, 15));
    await env.service.tick(Date.UTC(2026, 10, 2, 9));
    assert.equal(reminders.sent.length, 2);
    // La semaine suivante, la demande revient.
    await env.service.tick(Date.UTC(2026, 10, 8, 9));
    assert.match(reminders.sent.at(-1).content, /Planning de la semaine du lundi 9 novembre/);
  });

  it('« Est-ce que tu as fini ? » : « Je crée un autre événement » ou « J’ai fini »', async () => {
    const reminders = env.channels.planningReminder;
    const click = (customId, message) => ({
      customId,
      message,
      user: { id: ADMIN },
      update: async (payload) => Object.assign(message, payload),
    });

    mock.timers.setTime(Date.UTC(2026, 10, 1, 8));
    const first = await fillTicket(env, 'masterclass');
    await env.service.validate(first.eventId, Date.now());
    const question = reminders.sent.at(-1);
    await env.onInteraction(click('ev:another:', question));
    assert.match(question.content, /\n\n➕ Parfait ! Va directement dans <#planning> et crée ton prochain événement\.$/);
    assert.deepEqual(question.components, [], 'les boutons disparaissent une fois répondu');
    await env.service.tick(Date.UTC(2026, 10, 1, 9));
    assert.match(reminders.sent.at(-1).content, /Planning de la semaine/, 'pas encore fini : la demande arrive');

    const second = await fillTicket(env, 'questions');
    await env.service.validate(second.eventId, Date.now());
    const again = reminders.sent.at(-1);
    await env.onInteraction(click('ev:finished:', again));
    assert.match(again.content, /\n\n✅ C'est noté : tu as fini de créer tes événements, je ne te relance plus cette semaine\./);
    const count = reminders.sent.length;
    await env.service.tick(Date.UTC(2026, 10, 1, 15));
    await env.service.tick(Date.UTC(2026, 10, 2, 9));
    assert.equal(reminders.sent.length, count, 'plus de relance');
  });

  it("confirme le live de l'accompagnement avec 👍 : annonce et sondage de présence", async () => {
    await env.service.tick(Date.UTC(2026, 9, 28, 9));
    const question = env.channels.planningReminder.sent[0];
    assert.match(question.content, /Live accompagnement ce soir à 22 h 00 \(GMT\)\*\* : il est maintenu \?/);
    assert.deepEqual(question.reactions, ['👍', '❌']);

    const reaction = (emoji, userId) => [{ emoji: { name: emoji }, message: { id: question.id } }, { id: userId }];
    assert.equal(await env.service.onReaction(...reaction('👍', '123'), NOW), false, 'seul l’admin décide');
    assert.equal(await env.service.onReaction(...reaction('👍🏽', ADMIN), Date.UTC(2026, 9, 28, 10)), true);

    const [announcement] = env.channels.announcePlug.sent;
    assert.match(announcement.content, /^<@&r-tiktok>\n✅ \*\*Live confirmé ce soir à 22 h 00 \(GMT\) !\*\*/);
    assert.equal(announcement.poll.duration, 12);
    assert.deepEqual(announcement.allowedMentions, { roles: ['r-tiktok'] });

    assert.match(env.channels.planningReminder.sent.at(-1).content, /le live de ce soir est annoncé/);
    await env.service.tick(Date.UTC(2026, 9, 28, 12));
    assert.equal(env.channels.planningReminder.sent.filter((m) => /maintenu/.test(m.content)).length, 1, 'plus de question une fois répondu');
  });

  it("annule le live de l'accompagnement avec ❌, après une relance", async () => {
    await env.service.tick(Date.UTC(2026, 9, 30, 9));
    await env.service.tick(Date.UTC(2026, 9, 30, 12));
    const relaunch = env.channels.planningReminder.sent[1];
    assert.match(relaunch.content, /⏰ Rappel/);
    await env.service.onReaction({ emoji: { name: '❌' }, message: { id: relaunch.id } }, { id: ADMIN }, Date.UTC(2026, 9, 30, 13));
    assert.match(env.channels.announcePlug.sent[0].content, /❌ \*\*Pas de live ce soir\.\*\*/);
  });

  it('publie le panneau une seule fois', async () => {
    await env.service.ensurePanel();
    await env.service.ensurePanel();
    assert.equal(env.channels.planning.sent.length, 1);
    assert.match(env.channels.planning.sent[0].content, /^🎛️ \*\*Créer un événement — panneau PlugBot\*\*/);
    assert.match(env.channels.planning.sent[0].content, /Les rappels pour planifier tes événements arrivent dans <#rappels>\.$/);
  });

  it('ouvre un ou plusieurs tickets depuis le panneau', async () => {
    const replies = [];
    const click = (customId, values) => ({
      customId,
      values,
      user: { id: ADMIN },
      deferReply: async () => {},
      editReply: async (content) => replies.push(content),
    });
    await env.onInteraction(click('ev:open-battle:'));
    await env.onInteraction(click('ev:openMany:', ['masterclass', 'coworking', 'bilan']));
    assert.equal(env.threads.size, 4);
    assert.match(replies[0], /^🎫 Ticket ouvert : <#t\d+>$/);
    assert.equal(replies[1].match(/<#/g).length, 3);
  });

  it('pilote un ticket avec les menus et le formulaire', async () => {
    const thread = await env.service.openTicket('masterclass', NOW);
    const eventId = env.events.byThread(thread.id).id;
    const replies = [];
    const interaction = (customId, extra = {}) => ({
      customId,
      user: { id: ADMIN },
      deferUpdate: async () => {},
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
      ...extra,
    });

    await env.onInteraction(interaction(`ev:audience:${eventId}`, { values: ['free'] }));
    await env.onInteraction(interaction(`ev:roles:${eventId}`, { values: ['free', 'everyone'] }));
    await env.onInteraction(interaction(`ev:reminders:${eventId}`, { values: ['3h', 'creation'] }));
    const fields = { title: 'Accroches', date: '05/11', time: '22h', duration: '60', details: '' };
    await env.onInteraction(interaction(`ev:infoSubmit:${eventId}`, { fields: { getTextInputValue: (id) => fields[id] } }));
    await env.onInteraction(interaction(`ev:location:${eventId}`, { values: ['stage'] }));

    const event = env.events.get(eventId);
    assert.deepEqual(event.reminders, ['creation', '3h']);
    assert.equal(event.startAt, START);

    await env.onInteraction(interaction(`ev:validate:${eventId}`));
    assert.equal(env.scheduled.created[0].entityType, GuildScheduledEventEntityType.StageInstance);
    assert.match(replies.at(-1).content, /Événement programmé/);

    await env.onInteraction(interaction(`ev:roles:${eventId}`, { user: { id: '123' }, values: [] }));
    assert.match(replies.at(-1).content, /réservé à l'admin/);
  });
});
