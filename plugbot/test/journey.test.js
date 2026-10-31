// Simule le serveur Discord pour vérifier le parcours de l'accompagnement de bout en bout.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { openDatabase } from '../src/db.js';
import { createHandlers } from '../src/handlers.js';
import { createJobs } from '../src/jobs.js';
import { createJourneyInteractions } from '../src/journey/interactions.js';
import { createJourney } from '../src/journey/service.js';
import { createJourneyStore } from '../src/journey/store.js';
import { createPrison } from '../src/prison.js';
import { DAY_MS, dayOf } from '../src/time.js';
import { createTracker } from '../src/tracker.js';

const HOUR = 60 * 60 * 1000;
const ROLES = {
  free: 'r-free',
  plug: 'r-tiktok',
  streak: 'r-feu',
  weekWinner: 'r-p7',
  monthWinner: 'r-p30',
  prisoner: 'r-pri',
  office: 'r-office',
  plugged: 'r-plugged',
  internalPrisoner: 'r-pri-int',
};
const ADMIN = '900';
// Mercredi 4 novembre 2026, 10 h GMT.
const NOW = Date.UTC(2026, 10, 4, 10);

let nextId = 1000;

function fakeChannel(registry, name, { id = String(nextId++), parentId = null, type = ChannelType.GuildText } = {}) {
  const channel = {
    id,
    name,
    parentId,
    type,
    sent: [],
    overwrites: new Map(),
    permissionOverwrites: {
      edit: async (target, permissions) => channel.overwrites.set(target, permissions),
      delete: async (target) => channel.overwrites.delete(target),
    },
    send: async (payload) => {
      const message = { id: String(nextId++), channelId: channel.id, ...payload };
      message.edit = async (changes) => Object.assign(message, changes);
      channel.sent.push(message);
      return message;
    },
    messages: { fetch: async (messageId) => channel.sent.find((message) => message.id === messageId) ?? null },
    threads: {
      create: async ({ name: threadName, type: threadType }) => {
        const thread = fakeChannel(registry, threadName, { parentId: channel.id, type: threadType });
        Object.assign(thread, {
          archived: false,
          locked: false,
          members: { added: [], add: async (userId) => thread.members.added.push(userId) },
          setArchived: async (value) => (thread.archived = value),
          setLocked: async (value) => (thread.locked = value),
        });
        return thread;
      },
    },
  };
  registry.set(channel.id, channel);
  return channel;
}

function fakeMember(id, roles, displayName = `membre${id}`) {
  const cache = new Set(roles);
  return {
    id,
    displayName,
    joinedTimestamp: Date.UTC(2026, 0, 1),
    user: { bot: false, tag: displayName },
    roles: { cache, add: async (role) => cache.add(role), remove: async (role) => cache.delete(role) },
  };
}

function setup() {
  const registry = new Map();
  const category = fakeChannel(registry, 'tiktok-plug', { id: 'cat', type: ChannelType.GuildCategory });
  const announcements = fakeChannel(registry, 'annonces-accompagnement', { parentId: 'cat' });
  const memberCache = new Map();
  const created = [];
  const guild = {
    id: 'guild',
    members: { cache: memberCache, me: { id: 'bot' }, fetch: async (id) => (id ? memberCache.get(id) : memberCache) },
    channels: {
      cache: registry,
      fetch: async (id) => registry.get(id) ?? null,
      create: async ({ name, parent, permissionOverwrites }) => {
        const channel = fakeChannel(registry, name, { parentId: parent });
        channel.createdWith = permissionOverwrites;
        created.push(channel);
        return channel;
      },
    },
  };
  const config = {
    guildId: 'guild',
    channels: { results: 'c-res', showup: 'c-log', week: 'c-top7', month: 'c-top30', prison: 'c-prison' },
    links: { bonusWeek: 'b7', bonusMonth: 'b30', bonusStreak: 'b21', guide: 'c-guide' },
    roles: ROLES,
    streakRoleDays: 21,
    adminIds: new Set([ADMIN]),
    journeyCategoryId: 'cat',
  };
  const channels = Object.fromEntries(Object.entries(config.channels).map(([key, id]) => [key, fakeChannel(registry, key, { id })]));
  const db = openDatabase(':memory:');
  db.setMeta('launch_day', dayOf(NOW) - 30);
  const store = createJourneyStore(db.connection);
  const tracker = createTracker({ config, db, journey: store });
  const ctx = { config, db, tracker, guild, channels };
  ctx.prison = createPrison(ctx);
  ctx.journey = createJourney(ctx, store);
  const addMember = (...args) => {
    const member = fakeMember(...args);
    memberCache.set(member.id, member);
    tracker.syncCategory(member, dayOf(Date.now()));
    return member;
  };
  return {
    ctx,
    db,
    store,
    guild,
    registry,
    category,
    announcements,
    created,
    channels,
    journey: ctx.journey,
    onInteraction: createJourneyInteractions(ctx, ctx.journey),
    addMember,
    channel: (name) => created.find((channel) => channel.name === name),
  };
}

function interaction(customId, member, extra = {}) {
  const result = {
    customId,
    user: { id: member.id },
    member,
    replies: [],
    deferReply: async () => (result.deferred = true),
    deferUpdate: async () => (result.deferred = true),
    reply: async (payload) => result.replies.push(payload),
    followUp: async (payload) => result.replies.push(payload),
    editReply: async (payload) => result.replies.push(payload),
    update: async (payload) => result.replies.push(payload),
    showModal: async (modal) => (result.modal = modal),
    ...extra,
  };
  return result;
}

// Les réponses d'un formulaire : un texte ou un bouton de choix (une valeur), des cases à cocher ou un menu (une liste).
function modalFields(values) {
  return {
    fields: new Map(Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? { values: value } : { value }])),
    getTextInputValue: (key) => values[key],
  };
}

const text = (reply) => (typeof reply === 'string' ? reply : reply.content);

describe("parcours de l'accompagnement", () => {
  let env;
  let alice;
  let coach;

  beforeEach(async () => {
    mock.timers.enable({ apis: ['Date'], now: NOW });
    env = setup();
    alice = env.addMember('1', [ROLES.plug], 'Alice');
    coach = env.addMember('2', [ROLES.plug, ROLES.office], 'Coach');
    env.addMember(ADMIN, [], 'Admin');
    env.addMember('3', [ROLES.plug, ROLES.plugged], 'Bob');
    env.addMember('4', [ROLES.free], 'Carl');
    await env.journey.start(NOW);
  });

  afterEach(() => {
    mock.timers.reset();
    env.db.close();
  });

  // Ouvre une étape depuis le panneau et renvoie le fil du ticket.
  async function openStage(member, stage) {
    const click = interaction(`pc:open::${stage}`, member);
    await env.onInteraction(click);
    const id = text(click.replies.at(-1)).match(/<#(\d+)>/)?.[1];
    return { reply: text(click.replies.at(-1)), thread: env.registry.get(id) };
  }

  async function thumbsUp(thread) {
    await env.journey.onMessage(
      { channelId: thread.id, author: { id: coach.id, bot: false }, member: coach, content: '👍', attachments: { size: 0 }, channel: thread },
      Date.now(),
    );
    return thread.sent.at(-1);
  }

  async function closeWithForm(member, stage, values) {
    const { thread } = await openStage(member, stage);
    const question = await thumbsUp(thread);
    await env.onInteraction(interaction(`pc:close:${member.id}:${stage}`, coach, { message: question }));
    const submit = interaction(`pc:closeForm:${member.id}:${stage}`, coach, { message: question, fields: modalFields(values) });
    await env.onInteraction(submit);
    return { thread, submit };
  }

  it('crée les salons du parcours dans la catégorie, avec leurs panneaux', () => {
    assert.deepEqual(
      env.created.map((channel) => channel.name),
      ['parcours', 'notifications-coach', 'fiches-membres', 'prison-interne', 'sortir-de-la-prison-interne'],
    );
    assert.ok(env.created.every((channel) => channel.parentId === 'cat'));
    const tiktok = env.channel('parcours').createdWith.find((overwrite) => overwrite.id === ROLES.plug);
    assert.ok(tiktok.allow.includes(PermissionFlagsBits.SendMessagesInThreads));
    assert.ok(tiktok.deny.includes(PermissionFlagsBits.SendMessages), 'on écrit seulement dans son ticket');
    assert.ok(env.channel('sortir-de-la-prison-interne').createdWith.some((overwrite) => overwrite.id === ROLES.internalPrisoner));
    assert.ok(!env.channel('fiches-membres').createdWith.some((overwrite) => overwrite.id === ROLES.plug), 'fiches : coachs seulement');

    assert.match(env.channel('parcours').sent[0].content, /Ton parcours dans l'accompagnement/);
    assert.equal(env.channel('parcours').sent[0].components[0].components.length, 4);
    assert.match(env.channel('sortir-de-la-prison-interne').sent[0].content, /Sortir de la prison interne/);
    const panel = env.channel('fiches-membres').sent[0];
    assert.match(panel.content, /^🗂️ \*\*Fiches des membres\*\*/);
    assert.deepEqual(
      panel.components.map((row) => row.components.map((component) => component.data.custom_id)),
      [
        ['pc:list::all', 'pc:list::stage1', 'pc:list::stage2', 'pc:list::stage3', 'pc:list::stage4'],
        ['pc:list::plugged', 'pc:list::never', 'pc:list::prison'],
        ['pc:filter::'],
        ['pc:ficheUser::'],
      ],
    );

    // Seuls les membres TikTok sans Plugged® ni Office suivent le parcours.
    assert.equal(env.store.get('1').status, 'active');
    for (const id of ['2', ADMIN, '3', '4']) assert.equal(env.store.get(id), null, id);
  });

  it('ouvre les étapes dans l’ordre, chacune dans un fil privé avec le coach', async () => {
    assert.match((await openStage(alice, 2)).reply, /🔒 Termine d'abord l'étape \*\*🎬 Visionnage\*\*/);
    const { reply, thread } = await openStage(alice, 1);
    assert.match(reply, /^🎫 Ton ticket est ici : <#\d+>$/);
    assert.equal(thread.type, ChannelType.PrivateThread);
    assert.deepEqual(thread.members.added.sort(), ['1', '2', ADMIN].sort());
    assert.match(thread.sent[0].content, /^<@1> 🎬 \*\*Étape 1 : Visionnage\*\*/);
    assert.equal(thread.sent[0].components[0].components[0].data.custom_id, 'pc:profile:1:');
    assert.equal((await openStage(alice, 1)).thread.id, thread.id, 'pas de deuxième ticket');

    const bob = env.guild.members.cache.get('3');
    assert.match((await openStage(bob, 1)).reply, /Plugged® : pas besoin/);
  });

  it('enregistre la fiche du membre, et seulement pour lui', async () => {
    const refused = interaction('pc:profile:1', coach);
    await env.onInteraction(refused);
    assert.match(text(refused.replies[0]), /pour le membre de ce ticket/);

    const open = interaction('pc:profile:1', alice);
    await env.onInteraction(open);
    assert.equal(open.modal.toJSON().title, 'Ma fiche');

    const values = { name: ' Alice Martin ', home: ['Sénégal'], level: ['compte'], equipment: ['telephone'], availability: ['1-2h'] };
    await env.onInteraction(interaction('pc:profileSubmit:1', alice, { fields: modalFields(values) }));
    const record = env.store.get('1');
    assert.equal(record.fullName, 'Alice Martin');
    assert.equal(record.homeCountry, 'Sénégal');
    assert.equal(record.availability, '1-2h');
  });

  it('prévient le coach des preuves envoyées, au plus une fois toutes les 10 minutes', async () => {
    const { thread } = await openStage(alice, 1);
    const proof = (id) => ({ id, channelId: thread.id, author: { id: '1', bot: false }, content: '', attachments: { size: 1 }, channel: thread });
    await env.journey.onMessage(proof('p1'), NOW);
    await env.journey.onMessage(proof('p2'), NOW + 60_000);
    const notices = env.channel('notifications-coach').sent;
    assert.equal(notices.length, 1);
    assert.match(notices[0].content, /^<@&r-office> 📥 <@1> a envoyé une preuve — 🎬 Visionnage → <#\d+>$/);
    assert.deepEqual(notices[0].allowedMentions, { roles: [ROLES.office] });
    assert.equal(env.store.lastTicket('1', 'visionnage').proofMessageId, 'p2');
  });

  it('clôture les étapes avec le 👍 du coach, puis ses notes', async () => {
    const { thread } = await openStage(alice, 1);
    const question = await thumbsUp(thread);
    assert.match(question.content, /^Clôturer l'étape \*\*🎬 Visionnage\*\* de <@1> \?\n⚠️ Sa fiche est incomplète/);

    const byMember = interaction('pc:close:1:1', alice, { message: question });
    await env.onInteraction(byMember);
    assert.match(text(byMember.replies[0]), /Réservé aux coachs/);

    mock.timers.setTime(NOW + DAY_MS);
    const close = interaction('pc:close:1:1', coach, { message: question });
    await env.onInteraction(close);
    assert.match(close.replies.at(-1).content, /✅ Étape clôturée par <@2>\.$/);
    assert.deepEqual(close.replies.at(-1).components, []);
    assert.match(thread.sent.at(-1).content, /<@1> ✅ \*\*Bravo, l'étape 🎬 Visionnage est validée !\*\*\nL'étape suivante est débloquée : clique sur \*\*🧭 Positionnement\*\*/);
    assert.ok(thread.locked && thread.archived);
    assert.equal(env.store.get('1').stage, 2);
    assert.equal(env.store.get('1').watchedDays, 2, 'arrivé mercredi, validé jeudi');

    await closeWithForm(alice, 2, { niche: 'Cuisine', nicheType: 'repost-ameliore', target: 'france', cta: 'white-hat' });
    const positioned = env.store.get('1');
    assert.deepEqual([positioned.niche, positioned.nicheType, positioned.targetCountry, positioned.ctaMethod], ['Cuisine', 'repost-ameliore', 'france', 'white-hat']);

    const { submit } = await closeWithForm(alice, 3, { note: 'Très bon son.' });
    assert.match(submit.replies.at(-1).content, /Étape clôturée/);
    const engaged = env.store.get('1');
    assert.equal(engaged.stage, 4);
    assert.equal(engaged.confirmationNote, 'Très bon son.');
    assert.equal(env.db.getMemberState('1').resetDay, dayOf(Date.now()), 'la prison des 15 jours démarre à l’Engagement');
  });

  it('Positionnement : le membre remplit ses choix avec des boutons, le coach les retrouve en clôturant', async () => {
    env.store.update('1', { stage: 2 });
    const { thread } = await openStage(alice, 2);
    assert.equal(thread.sent[0].components[0].components[0].data.custom_id, 'pc:choices:1:');

    const open = interaction('pc:choices:1', alice);
    await env.onInteraction(open);
    const form = open.modal.toJSON();
    assert.equal(form.title, 'Mes choix');
    // Le nom de la niche s'écrit ; le reste se choisit avec des boutons.
    assert.deepEqual(
      form.components.map((label) => label.component.type),
      [4, 21, 21, 21],
    );
    assert.equal(form.components[2].component.options.length, 8, 'les 8 pays de la monétisation');

    const submit = interaction('pc:choicesSubmit:1', alice, {
      fields: modalFields({ niche: ' Recettes africaines ', nicheType: 'commentary', target: 'france', cta: 'gray-hat' }),
    });
    await env.onInteraction(submit);
    assert.match(text(submit.replies.at(-1)), /Tes choix sont enregistrés/);
    assert.equal(
      thread.sent.at(-1).content,
      '🧭 **Les choix de <@1>**\nNiche : Recettes africaines\nType de niche : 🎙️ Commentary\nPays cible : 🇫🇷 France\nMéthode CTA : 🔘 Gray hat',
    );
    assert.match(env.channel('notifications-coach').sent.at(-1).content, /<@1> a rempli ses choix — 🧭 Positionnement/);

    // Le coach clôture : le formulaire reprend les choix du membre, déjà cochés.
    const question = await thumbsUp(thread);
    assert.doesNotMatch(question.content, /incomplète/);
    const close = interaction('pc:close:1:2', coach, { message: question });
    await env.onInteraction(close);
    const target = close.modal.toJSON().components[2].component.options.find((option) => option.default);
    assert.equal(target.value, 'france');
  });

  it('ouvre les formulaires avec des menus déroulants si Discord refuse les boutons de choix', async (t) => {
    const shown = [];
    const open = interaction('pc:profile:1', alice, {
      showModal: async (modal) => {
        shown.push(modal.toJSON());
        if (shown.length === 1) throw Object.assign(new Error('Invalid Form Body'), { status: 400 });
      },
    });
    t.mock.method(console, 'warn', () => {});
    await env.onInteraction(open);
    assert.deepEqual(shown[0].components.map((label) => label.component.type), [4, 3, 21, 21, 21]);
    assert.deepEqual(shown[1].components.map((label) => label.component.type), [4, 3, 3, 3, 3]);
  });

  it('#fiches-membres ne garde que le panneau : les anciennes fiches sont effacées', async () => {
    const fiches = env.channel('fiches-membres');
    const old = await fiches.send({ embeds: [{ title: 'ancienne fiche' }] });
    old.delete = async () => fiches.sent.splice(fiches.sent.indexOf(old), 1);
    env.db.connection.prepare('UPDATE journey SET fiche_message_id = ? WHERE user_id = ?').run(old.id, '1');
    await env.journey.tick(NOW);
    assert.equal(fiches.sent.length, 1, 'seul le panneau reste');
    assert.equal(env.store.get('1').ficheMessageId, null);
  });

  it('#fiches-membres sert de journal : une ligne par action, avec un bouton pour voir la fiche', async () => {
    const fiches = env.channel('fiches-membres');
    assert.equal(fiches.sent.length, 1, 'au démarrage, seulement le panneau');

    const { thread } = await openStage(alice, 1);
    await env.onInteraction(
      interaction('pc:profileSubmit:1', alice, {
        fields: modalFields({ name: 'Alice Martin', home: ['Sénégal'], level: 'compte', equipment: 'telephone', availability: '1-2h' }),
      }),
    );
    await env.journey.onMessage(
      { id: 'p1', channelId: thread.id, author: { id: '1', bot: false }, content: '', attachments: { size: 1 }, channel: thread },
      NOW,
    );
    await env.journey.closeStage('1', 1, {}, NOW);
    const newcomer = env.addMember('7', [ROLES.plug], 'Nora');
    env.journey.syncMember(newcomer, NOW);
    await new Promise((resolve) => setImmediate(resolve));

    const lines = fiches.sent.slice(1).map((message) => message.content);
    assert.deepEqual(lines, [
      '**Alice** <@1> — 🎫 a ouvert son ticket 🎬 Visionnage',
      '**Alice Martin** <@1> — 📝 a rempli sa fiche',
      '**Alice Martin** <@1> — 📥 a envoyé une preuve — 🎬 Visionnage',
      "**Alice Martin** <@1> — ✅ a validé l'étape 🎬 Visionnage en 1 jour",
      "**Nora** <@7> — 👋 arrive dans l'accompagnement : étape 🎬 Visionnage",
    ]);
    const line = fiches.sent[1];
    assert.deepEqual(line.allowedMentions, { parse: [] }, 'personne n’est notifié');
    assert.equal(line.components[0].components[0].data.custom_id, 'pc:ficheOf:1:');

    const open = interaction('pc:ficheOf:1', coach);
    await env.onInteraction(open);
    assert.equal(open.replies[0].flags, 64, 'la fiche ne s’affiche que pour le coach');
    assert.equal(open.replies[0].embeds[0].title, '🗂️ Alice Martin');
  });

  it('montre les listes de clients, triées et par pages, avec la fiche de chacun', async () => {
    const names = ['Zoé', 'Ali', 'Mia', 'Bea'];
    names.forEach((name, i) => {
      const member = env.addMember(String(10 + i), [ROLES.plug], name);
      member.joinedTimestamp = Date.UTC(2026, 0, 1 + i);
      env.journey.syncMember(member, NOW + i * HOUR);
    });
    env.store.update('11', { stage: 2 });
    env.store.update('1', { fullName: 'Alice Martin' });
    const list = async (key) => {
      const click = interaction(`pc:list::${key}`, coach);
      await env.onInteraction(click);
      return click.replies[0];
    };

    const all = await list('all');
    assert.equal(all.flags, 64, 'visible par le coach seul');
    assert.equal(all.embeds[0].title, '🗂️ Tous les clients');
    assert.deepEqual(
      all.embeds[0].description.split('\n').map((line) => line.match(/\*\*(.+?)\*\*/)[1]),
      ['Ali', 'Alice Martin', 'Bea', 'Bob', 'Mia', 'Zoé'],
      'de A à Z, Plugged® compris, coachs exclus',
    );
    assert.match(all.embeds[0].description, /\*\*Bob\*\* <@3> — 💎 Plugged®/);
    assert.equal(all.embeds[0].footer.text, '6 membres · trié de A à Z');

    const stage2 = await list('stage2');
    assert.equal(stage2.embeds[0].title, '🗂️ Étape 2 : 🧭 Positionnement');
    assert.match(stage2.embeds[0].description, /^• \*\*Ali\*\* <@11> — 🧭 Positionnement depuis le <t:\d+:D>$/);
    assert.equal((await list('plugged')).embeds[0].description.split('\n').length, 1);
    assert.equal((await list('never')).embeds[0].description.split('\n').length, 4, 'à l’étape 1, sans aucun ticket ouvert');

    await list('all');
    const sort = interaction('pc:listSort::', coach, { values: ['za'] });
    await env.onInteraction(sort);
    assert.match(sort.replies[0].embeds[0].description, /^• \*\*Zoé\*\*/);
    const newest = interaction('pc:listSort::', coach, { values: ['newest'] });
    await env.onInteraction(newest);
    assert.match(newest.replies[0].embeds[0].description, /^• \*\*Bea\*\*/, 'arrivée la plus récente');

    // La fiche d'un membre, depuis la liste ou depuis le menu des membres du panneau.
    const fiche = interaction('pc:fiche::', coach, { values: ['1'] });
    await env.onInteraction(fiche);
    assert.equal(fiche.replies[0].flags, 64);
    assert.equal(fiche.replies[0].embeds[0].title, '🗂️ Alice Martin');
    const plugged = interaction('pc:ficheUser::', coach, { values: ['3'] });
    await env.onInteraction(plugged);
    assert.match(plugged.replies[0].embeds[0].description, /Plugged® : pas de parcours/);

    const refused = interaction('pc:list::all', alice);
    await env.onInteraction(refused);
    assert.match(text(refused.replies[0]), /Réservé aux coachs/);
  });

  it('pagine les longues listes', async () => {
    for (let i = 0; i < 25; i++) env.journey.syncMember(env.addMember(String(100 + i), [ROLES.plug], `Membre ${String(i).padStart(2, '0')}`), NOW);
    const click = interaction('pc:list::all', coach);
    await env.onInteraction(click);
    const first = click.replies[0];
    assert.equal(first.embeds[0].description.split('\n').length, 20);
    assert.equal(first.embeds[0].footer.text, '27 membres · trié de A à Z · page 1/2');
    const next = interaction('pc:listPage::next', coach);
    await env.onInteraction(next);
    assert.equal(next.replies[0].embeds[0].description.split('\n').length, 7);
    assert.match(next.replies[0].embeds[0].footer.text, /page 2\/2$/);
  });

  it('filtre les membres par critère', async () => {
    env.store.update('1', { stage: 3, targetCountry: 'france', ctaMethod: 'carousel', niche: 'Cuisine', nicheType: 'commentary' });
    const dave = env.addMember('5', [ROLES.plug], 'Dave');
    env.journey.syncMember(dave, NOW);
    env.store.update('5', { targetCountry: 'japon', nicheType: 'autre' });

    assert.deepEqual(env.journey.filterOptions('target'), [
      ['france', '🇫🇷 France (1)'],
      ['japon', '🇯🇵 Japon (1)'],
    ]);
    assert.deepEqual(
      env.journey.filterOptions('nicheType').map(([, label]) => label),
      ['🎙️ Commentary (1)', '✨ Autre (1)'],
      'les anciens choix restent lisibles',
    );
    const pick = interaction('pc:filter::', coach, { values: ['cta'] });
    await env.onInteraction(pick);
    assert.equal(pick.replies[0].components[0].components[0].data.custom_id, 'pc:filterValue::cta');
    const result = interaction('pc:filterValue::cta', coach, { values: ['carousel'] });
    await env.onInteraction(result);
    assert.equal(result.replies[0].embeds[0].title, '🗂️ Méthode CTA : 🎠 Carousel');
    assert.match(result.replies[0].embeds[0].description, /^• \*\*Alice\*\* <@1> — 🎥 Confirmation/);
  });

  it('prison interne après 5 jours sans arriver à l’Engagement, sortie par un ticket', async () => {
    await env.journey.tick(NOW + 5 * DAY_MS - 60_000);
    assert.ok(!alice.roles.cache.has(ROLES.prisoner));
    // Le point tous les 3 jours (parti à 9 h ce jour-là) signale son délai qui approche.
    assert.match(
      env.channel('notifications-coach').sent.at(-1).content,
      /^<@&r-office> 📋 \*\*Le point tous les 3 jours\*\*\n\n⏳ \*\*Délai bientôt dépassé\*\* \(1\)\n• <@1> — 🎬 Visionnage, délai <t:\d+:R>$/,
    );

    mock.timers.setTime(NOW + 5 * DAY_MS);
    await env.journey.tick(Date.now());
    assert.ok(alice.roles.cache.has(ROLES.prisoner) && alice.roles.cache.has(ROLES.internalPrisoner));
    assert.ok(env.db.getPrison('1').internal);
    // L'accompagnement lui est caché, sauf #prison-interne et le salon de sortie.
    for (const channel of [env.category, env.announcements, env.channel('parcours'), env.channel('fiches-membres')]) {
      assert.deepEqual(channel.overwrites.get('1'), { ViewChannel: false }, channel.name);
    }
    for (const name of ['prison-interne', 'sortir-de-la-prison-interne']) assert.ok(!env.channel(name).overwrites.has('1'), name);

    const exitId = env.channel('sortir-de-la-prison-interne').id;
    assert.match(env.channels.prison.sent.at(-1).content, new RegExp(`^🔒 \\*\\*Tu viens de rejoindre la prison : tu n'as pas atteint l'étape Engagement de l'accompagnement en 5 jours\\.\\*\\*\\nVoici comment en sortir : ouvre un ticket dans <#${exitId}>`));
    assert.match(env.channel('prison-interne').sent.at(-1).content, /Tu n'as toujours pas atteint l'étape Engagement après 5 jours[\s\S]*\n<@1>$/);
    assert.match(env.channel('notifications-coach').sent.at(-1).content, /Prison interne\*\* — délai de 5 jours dépassé/);
    assert.match((await openStage(alice, 1)).reply, /Tu es en prison/);

    const outsider = interaction('pc:exit::', coach);
    await env.onInteraction(outsider);
    assert.match(text(outsider.replies[0]), /tu n'y es pas/);

    const exit = interaction('pc:exit::', alice);
    await env.onInteraction(exit);
    const ticket = env.registry.get(text(exit.replies[0]).match(/<#(\d+)>/)[1]);
    assert.equal(ticket.parentId, exitId);
    assert.equal(ticket.sent[0].components[0].components[0].data.custom_id, 'pc:release:1:');
    assert.match(env.channel('notifications-coach').sent.at(-1).content, /^<@&r-office> 🔓 <@1> a ouvert un ticket/);

    mock.timers.setTime(NOW + 6 * DAY_MS);
    await env.onInteraction(interaction('pc:release:1', coach));
    assert.ok(!alice.roles.cache.has(ROLES.prisoner) && !alice.roles.cache.has(ROLES.internalPrisoner));
    assert.equal(env.db.getPrison('1'), null);
    assert.ok(!env.category.overwrites.has('1'), "l'accompagnement est rendu");
    assert.equal(env.store.get('1').deadlineFrom, NOW + 6 * DAY_MS, 'nouveau délai de 5 jours');
    assert.match(ticket.sent.at(-1).content, /est libéré par son coach/);
    assert.ok(ticket.locked);
    assert.match(env.channels.prison.sent.at(-1).content, /libéré de prison par l'équipe/);
  });

  it('Engagement : planning, rappels dans son heure locale et récaps à minuit', async () => {
    env.store.update('1', { stage: 4, engagementAt: NOW });
    const { thread } = await openStage(alice, 4);
    assert.equal(thread.sent[0].components[0].components[0].data.custom_id, 'pc:planning:1:');

    const save = (values) => env.journey.savePlanning('1', values, NOW);
    assert.match(await save({ days: [1, 2, 3], check1: 12, check2: 19, home: 'Madagascar' }), /au moins 5 jours/);
    assert.match(await save({ days: [1, 2, 3, 4, 5], check1: 19, check2: 12, home: 'Madagascar' }), /plus tard que la 1ʳᵉ/);
    // Madagascar : GMT+3. Mercredi 13 h là-bas : les rappels commencent jeudi.
    assert.equal(await save({ days: [1, 2, 3, 4, 5], check1: 12, check2: 19, home: 'Madagascar' }), null);
    assert.match(thread.sent.at(-1).content, /Ton planning est enregistré :\*\* lundi, mardi, mercredi, jeudi, vendredi · vérifications à 12 h et 19 h \(🇲🇬 Madagascar\)/);
    assert.match(env.channel('notifications-coach').sent.at(-1).content, /a choisi son planning/);

    const tick = (time) => {
      mock.timers.setTime(time);
      return env.journey.tick(time);
    };
    const said = () => thread.sent.at(-1).content;
    const count = thread.sent.length;
    await tick(Date.UTC(2026, 10, 5, 5, 59));
    assert.equal(thread.sent.length, count, 'pas avant 9 h, heure de Madagascar');
    await tick(Date.UTC(2026, 10, 5, 6));
    assert.match(said(), /^<@1> 🚀 \*\*Aujourd'hui, tu postes !\*\*\nVérifications à 12 h et à 19 h/);
    await tick(Date.UTC(2026, 10, 5, 9));
    assert.match(said(), /Première vérification : pas encore de post aujourd'hui\.\*\* Prochaine vérification à 19 h\./);
    env.db.addShowup('post-jeudi', '1', Date.UTC(2026, 10, 5, 10));
    await tick(Date.UTC(2026, 10, 5, 16));
    assert.match(said(), /Post reçu, ta journée est validée/);
    await tick(Date.UTC(2026, 10, 5, 16, 30));
    assert.match(said(), /Post reçu/, 'une seule fois');

    const notices = env.channel('notifications-coach').sent;
    await tick(Date.UTC(2026, 10, 6, 0));
    assert.match(notices.at(-1).content, /^📊 \*\*Engagement — récap du 05\/11\/2026\*\*\n\n✅ \*\*Avant la 2ᵉ vérification\*\* \(1\)\n<@1>$/);
    await tick(Date.UTC(2026, 10, 6, 16));
    assert.match(said(), /Pas de post à la 2ᵉ vérification/);
    await tick(Date.UTC(2026, 10, 7, 0));
    assert.match(notices.at(-1).content, /❌ \*\*N'ont pas posté\*\* \(1\)\n<@1>/);

    // Le point tous les 3 jours : samedi 7 à 9 h (3 jours après la mise en route), avec une mention.
    await tick(Date.UTC(2026, 10, 7, 8, 59));
    assert.doesNotMatch(notices.at(-1).content, /Le point tous les 3 jours/);
    await tick(Date.UTC(2026, 10, 7, 9));
    assert.match(notices.at(-1).content, /^📋 \*\*Le point tous les 3 jours\*\*\n\nRien à signaler/, 'rien à signaler : pas de mention');

    await tick(Date.UTC(2026, 10, 8, 0));
    assert.match(notices.at(-1).content, /😴 \*\*Jour de repos\*\* \(1\)/);

    // Le lundi à minuit : le bilan de la semaine (jeudi tenu, vendredi manqué).
    await tick(Date.UTC(2026, 10, 9, 0));
    await tick(Date.UTC(2026, 10, 9, 0, 1));
    assert.match(notices.find((message) => message.content.includes('bilan de la semaine')).content, /🟠 <@1> — 1\/2$/);
  });

  it('choisit le planning avec le bouton du ticket, et demande le pays s’il manque', async () => {
    const early = interaction('pc:planning:1', alice);
    await env.onInteraction(early);
    assert.match(text(early.replies[0]), /se choisit à l'étape Engagement/);

    env.store.update('1', { stage: 4, engagementAt: NOW });
    await openStage(alice, 4);
    const open = interaction('pc:planning:1', alice);
    await env.onInteraction(open);
    assert.equal(open.modal.toJSON().components.length, 4, 'jours, 2 vérifications et le pays');

    const values = { days: ['1', '2', '3', '4', '5', '6'], check1: ['11'], check2: ['20'], home: ["Côte d'Ivoire"] };
    const submit = interaction('pc:planningSubmit:1', alice, { fields: modalFields(values) });
    await env.onInteraction(submit);
    assert.equal(text(submit.replies.at(-1)), '✅ Planning enregistré.');
    const record = env.store.get('1');
    assert.deepEqual([record.postDays, record.check1, record.check2, record.homeCountry], [[1, 2, 3, 4, 5, 6], 11, 20, "Côte d'Ivoire"]);
    assert.equal(record.planningFrom, '2026-11-05');
  });

  it('avant l’Engagement, pas de prison faute de show-up ; ensuite, prison interne sans sortie en postant', async () => {
    const { ctx } = env;
    const handlers = createHandlers(ctx);
    const jobs = createJobs(ctx, handlers);
    const row = () => ctx.tracker.snapshot(env.guild.members.cache, Date.now()).get('1');
    assert.equal(row().prison.limit, Infinity);

    // Arrivé à l'Engagement il y a 16 jours, sans rien poster depuis.
    env.store.update('1', { stage: 4, engagementAt: NOW - 16 * DAY_MS });
    env.db.setResetDay('1', dayOf(NOW) - 16);
    assert.equal(row().prison.limit, 15);
    await jobs.runDaily(NOW);
    assert.ok(env.db.getPrison('1').internal);
    const exitId = env.channel('sortir-de-la-prison-interne').id;
    assert.match(env.channels.prison.sent.at(-1).content, new RegExp(`15 jours sans show-up\\.\\*\\*\\nVoici comment en sortir : ouvre un ticket dans <#${exitId}>`));
    assert.match(env.channel('prison-interne').sent.at(-1).content, /Tu n'as rien posté depuis 15 jours/);

    // 3 jours de posts ne suffisent pas : il faut un ticket.
    for (let day = 0; day < 3; day++) {
      mock.timers.setTime(NOW + day * DAY_MS + HOUR);
      const message = {
        id: String(5000 + day),
        guildId: 'guild',
        channelId: 'c-res',
        author: { id: '1', bot: false },
        createdTimestamp: Date.now(),
        attachments: { some: () => true },
        react: async () => {},
      };
      await handlers.onNewMessage(message);
      await jobs.runDaily(Date.now() + DAY_MS);
    }
    assert.ok(env.db.getPrison('1'));
    assert.match(env.channels.showup.sent.at(-1).content, new RegExp(`Toujours en prison interne : pour en sortir, ouvre un ticket dans <#${exitId}>`));
  });
});
