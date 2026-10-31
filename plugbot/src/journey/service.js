// Le parcours de l'accompagnement (voir PARCOURS.md) : salons, tickets d'étape, validation par le coach,
// fiches des membres, délai de 5 jours, prison interne, rappels de l'Engagement et récaps.

import { ChannelType, OverwriteType, PermissionFlagsBits, ThreadAutoArchiveDuration } from 'discord.js';
import { splitMessage } from '../messages.js';
import { send } from '../send.js';
import { DAY_MS, dayOf } from '../time.js';
import {
  AVAILABILITY,
  CTA_METHODS,
  DIGEST_EVERY_DAYS,
  DIGEST_HOUR,
  ENGAGEMENT,
  EQUIPMENT,
  JOURNEY_DAYS,
  LEVELS,
  MIN_POST_DAYS,
  MORNING_HOUR,
  STAGES,
  TARGET_COUNTRIES,
  labelOf,
  nicheTypeLabel,
  stageOf,
} from './catalog.js';
import { atLocal, countryLabel, localClock, nextDay, timeZoneOf } from './clock.js';
import {
  choicesNotice,
  choicesText,
  closeQuestion,
  dailyRecap,
  deadlineOf,
  deadlinePrisonText,
  digestText,
  exitTicketIntro,
  exitTicketNotice,
  ficheEmbed,
  listEmbed,
  noJourneyEmbed,
  firstCheckMissedText,
  internalPrisonNotice,
  missingChoices,
  missingProfile,
  morningText,
  planningChangedNotice,
  planningSavedText,
  postedText,
  proofNotice,
  releasedText,
  secondCheckMissedText,
  stageClosedText,
  stageDoneText,
  stageIntro,
  stageLockedText,
  ticketOpenedText,
  wallText,
  weeklyRecap,
} from './render.js';
import {
  FILTERS,
  LISTS,
  SORTS,
  choicesComponents,
  closeQuestionComponents,
  exitPanel,
  fichesPanel,
  listComponents,
  parcoursPanel,
  planningComponents,
  profileComponents,
  releaseComponents,
} from './ui.js';

const HOUR_MS = 60 * 60 * 1000;
// Un message « 👍 » tout seul (avec ou sans couleur de peau) : le coach veut clôturer l'étape.
const THUMBS_UP = /^👍[\u{1F3FB}-\u{1F3FF}]?$/u;
// Une notification de preuve au plus toutes les 10 minutes par ticket.
const PROOF_ALERT_EVERY_MS = 10 * 60 * 1000;
// Anciennes fiches effacées du salon à chaque tick, au plus.
const OLD_FICHES_PER_TICK = 10;
// Membres par page dans les listes de #fiches-membres.
const PEOPLE_PER_PAGE = 20;

// Les salons créés par PlugBot dans la catégorie de l'accompagnement.
const CHANNELS = {
  parcours: { name: 'parcours', topic: "Ton parcours dans l'accompagnement : clique sur une étape pour ouvrir ton ticket." },
  notifications: { name: 'notifications-coach', topic: 'Preuves à vérifier, prison interne, plannings et récaps (coachs seulement).' },
  fiches: { name: 'fiches-membres', topic: "Les listes et les fiches des membres de l'accompagnement (coachs seulement)." },
  wall: { name: 'prison-interne', topic: "Les membres de l'accompagnement en retard." },
  exit: { name: 'sortir-de-la-prison-interne', topic: 'Ouvre un ticket pour sortir de la prison interne.' },
};

const P = PermissionFlagsBits;
const READ = [P.ViewChannel, P.ReadMessageHistory];
const BOT_NEEDS = [
  P.ViewChannel,
  P.SendMessages,
  P.ReadMessageHistory,
  P.EmbedLinks,
  P.AttachFiles,
  P.AddReactions,
  P.CreatePrivateThreads,
  P.SendMessagesInThreads,
  P.ManageThreads,
];
const COACH_NEEDS = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.SendMessagesInThreads, P.AttachFiles, P.AddReactions];
// Les membres lisent le salon et écrivent seulement dans leurs tickets.
const TICKETS_ONLY = {
  allow: [...READ, P.SendMessagesInThreads, P.AttachFiles],
  deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads],
};
const READ_ONLY = { allow: READ, deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads] };

export function createJourney(ctx, store) {
  const { config, db, guild, channels, prison } = ctx;
  const { roles } = config;
  const categoryId = config.journeyCategoryId;
  // Les salons du parcours, une fois prêts.
  const ready = {};

  // --- Qui est qui ---

  function isCoach(member) {
    return Boolean(member) && (config.adminIds.has(member.id) || member.roles.cache.has(roles.office));
  }

  function coaches() {
    return [...guild.members.cache.values()].filter((member) => !member.user.bot && isCoach(member));
  }

  // active : il suit le parcours ; exempt : Plugged®, coach ou admin ; left : pas (ou plus) de rôle TikTok.
  function statusOf(member) {
    if (member.user.bot || !member.roles.cache.has(roles.plug)) return 'left';
    if (isCoach(member) || member.roles.cache.has(roles.plugged)) return 'exempt';
    return 'active';
  }

  // Arrivée dans l'accompagnement, départ, ou rôle Plugged® reçu : PlugBot met le parcours à jour.
  function syncMember(member, now) {
    const status = statusOf(member);
    const record = store.get(member.id);
    if (!record) {
      if (status === 'active') store.create(member.id, now);
      return;
    }
    if (record.status === status) return;
    const changes = { status };
    // De retour dans le parcours : le délai repart de zéro.
    if (status === 'active' && record.stage < ENGAGEMENT) changes.deadlineFrom = now;
    store.update(member.id, changes);
  }

  // Le membre suit le parcours : en prison, il n'en sort qu'avec un ticket de justification.
  function followsJourney(userId) {
    return store.get(userId)?.status === 'active';
  }

  // --- Les salons ---

  function overwritesFor(key) {
    const list = [
      { id: guild.id, type: OverwriteType.Role, deny: [P.ViewChannel] },
      { id: guild.members.me.id, type: OverwriteType.Member, allow: BOT_NEEDS },
      { id: roles.office, type: OverwriteType.Role, allow: COACH_NEEDS },
    ];
    if (key === 'parcours') list.push({ id: roles.plug, type: OverwriteType.Role, ...TICKETS_ONLY });
    if (key === 'wall') {
      list.push({ id: roles.plug, type: OverwriteType.Role, ...READ_ONLY }, { id: roles.internalPrisoner, type: OverwriteType.Role, ...READ_ONLY });
    }
    if (key === 'exit') list.push({ id: roles.internalPrisoner, type: OverwriteType.Role, ...TICKETS_ONLY });
    return list;
  }

  async function ensureChannels() {
    for (const [key, { name, topic }] of Object.entries(CHANNELS)) {
      const id = db.getMeta(`journey_channel_${key}`);
      let channel = id ? (guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null))) : null;
      if (!channel) {
        channel = await guild.channels.create({
          name,
          topic,
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: overwritesFor(key),
          reason: "Parcours de l'accompagnement",
        });
        db.setMeta(`journey_channel_${key}`, channel.id);
      }
      ready[key] = channel;
    }
  }

  // Publie un message fixe (panneau), ou le met à jour s'il existe déjà.
  async function ensureMessage(metaKey, channel, payload) {
    const id = db.getMeta(metaKey);
    const existing = id ? await channel.messages.fetch(id).catch(() => null) : null;
    if (existing) {
      await existing.edit(payload);
      return;
    }
    const message = await channel.send(payload);
    db.setMeta(metaKey, message.id);
  }

  let isSetUp = false;
  let setupFailed = false;

  // Crée les salons et les panneaux. Si Discord refuse, PlugBot le signale une fois et réessaie chaque minute.
  async function setup() {
    try {
      await ensureChannels();
      await ensureMessage('journey_panel_parcours', ready.parcours, parcoursPanel());
      await ensureMessage('journey_panel_exit', ready.exit, exitPanel());
      await ensureMessage('journey_panel_filter', ready.fiches, fichesPanel());
    } catch (error) {
      if (!setupFailed) {
        console.error(
          `[PlugBot] Parcours de l'accompagnement : les salons n'ont pas pu être préparés (${error.message}). ` +
            'Vérifie que PlugBot a, dans Paramètres du serveur > Rôles : Gérer les salons, Gérer les rôles, Gérer les fils, ' +
            'Créer des fils privés, Envoyer des messages dans les fils, Intégrer des liens et Joindre des fichiers. Il réessaie chaque minute.',
        );
      }
      setupFailed = true;
      return false;
    }
    if (setupFailed) console.log("[PlugBot] Parcours de l'accompagnement prêt.");
    isSetUp = true;
    setupFailed = false;
    return true;
  }

  async function start(now) {
    for (const member of guild.members.cache.values()) syncMember(member, now);
    // Les récaps démarrent à partir d'aujourd'hui (le point tous les 3 jours : dans 3 jours).
    if (db.getMeta('journey_recap_day') === null) db.setMeta('journey_recap_day', dayOf(now));
    if (db.getMeta('journey_digest_day') === null) db.setMeta('journey_digest_day', dayOf(now));
    await setup();
  }

  // --- Messages ---

  async function post(channel, content, allowedMentions = { parse: [] }) {
    for (const part of splitMessage(content)) await channel.send({ content: part, allowedMentions });
  }

  // Dans #notifications-coach. mention : le rôle Office est notifié.
  async function notify(content, { mention = false } = {}) {
    if (!ready.notifications) return;
    if (mention) await post(ready.notifications, `<@&${roles.office}> ${content}`, { roles: [roles.office] });
    else await post(ready.notifications, content);
  }

  async function fetchThread(threadId) {
    const thread = await guild.channels.fetch(threadId).catch(() => null);
    if (thread?.archived) await thread.setArchived(false).catch(() => {});
    return thread;
  }

  async function closeThread(threadId, content, userId, now) {
    store.closeTicket(threadId, now);
    const thread = await fetchThread(threadId);
    if (!thread) return;
    await thread.send({ content, allowedMentions: { users: [userId] } });
    await thread.setLocked(true).catch(() => {});
    await thread.setArchived(true).catch(() => {});
  }

  // Un ticket : un fil privé, avec le membre et les coachs.
  async function openTicket(channel, member, name, kind, now) {
    const thread = await channel.threads.create({
      name: name.slice(0, 100),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: "Ticket du parcours de l'accompagnement",
    });
    await thread.members.add(member.id).catch(() => {});
    for (const coach of coaches()) await thread.members.add(coach.id).catch(() => {});
    store.addTicket(thread.id, member.id, kind, now);
    return thread;
  }

  // --- Les étapes ---

  // Le membre clique sur une étape du panneau. Renvoie la réponse, visible par lui seul.
  async function openStage(member, number, now) {
    if (!isSetUp) return "Le parcours n'est pas encore prêt : réessaie dans quelques minutes.";
    const record = store.get(member.id);
    if (!record || record.status !== 'active') {
      if (isCoach(member)) return "Ce panneau est pour les membres de l'accompagnement.";
      if (member.roles.cache.has(roles.plugged)) return '✅ Tu as le rôle Plugged® : pas besoin de refaire le parcours.';
      return "Ce parcours est réservé aux membres de l'accompagnement.";
    }
    if (db.getPrison(member.id)) return `🔒 Tu es en prison : explique-toi d'abord dans <#${ready.exit.id}>.`;
    if (number > record.stage) return stageLockedText(record.stage);
    const stage = stageOf(number);
    const ticket = store.lastTicket(member.id, stage.key);
    if (number < record.stage) return stageDoneText(number, ticket);
    const existing = ticket && !ticket.closedAt ? await fetchThread(ticket.threadId) : null;
    if (existing) return ticketOpenedText(existing.id);

    const thread = await openTicket(ready.parcours, member, `${stage.emoji} ${stage.label} — ${member.displayName}`, stage.key, now);
    const intro = { content: stageIntro(number, { userId: member.id, deadline: deadlineOf(record) }), allowedMentions: { users: [member.id] } };
    if (number === 1) intro.components = profileComponents(member.id);
    if (number === 2) intro.components = choicesComponents(member.id);
    if (number === ENGAGEMENT) intro.components = planningComponents(member.id);
    await thread.send(intro);
    return ticketOpenedText(thread.id);
  }

  // Un message dans un ticket : le « 👍 » du coach, ou une preuve envoyée par le membre.
  async function onMessage(message, now) {
    if (message.author?.bot || !isSetUp) return false;
    const ticket = store.ticket(message.channelId);
    if (!ticket || ticket.closedAt) return false;
    const record = store.get(ticket.userId);
    const number = STAGES.findIndex((stage) => stage.key === ticket.kind) + 1;
    if (!record || number < 1 || number >= ENGAGEMENT || record.stage !== number) return false;

    const author = message.member ?? guild.members.cache.get(message.author.id);
    if (isCoach(author) && THUMBS_UP.test(message.content?.trim() ?? '')) {
      await message.channel.send({
        content: closeQuestion({ userId: ticket.userId, stage: number, missing: missing(record, number) }),
        components: closeQuestionComponents(ticket.userId, number),
        allowedMentions: { parse: [] },
      });
      return true;
    }
    if (message.author.id !== ticket.userId || message.attachments.size === 0) return false;
    store.setProof(ticket.threadId, message.id);
    if (number === 3) store.update(ticket.userId, { videos: record.videos + 1 });
    await alertCoach(ticket, proofNotice({ userId: ticket.userId, stage: number, threadId: ticket.threadId }), now);
    return true;
  }

  // Ce qui manque encore au membre pour l'étape, affiché sous la question du coach.
  function missing(record, number) {
    if (number === 1) return missingProfile(record);
    if (number === 2) return missingChoices(record);
    return [];
  }

  // Prévient le coach qu'il y a du nouveau dans un ticket, au plus une fois toutes les 10 minutes.
  async function alertCoach(ticket, content, now) {
    if (ticket.lastAlertAt && now - ticket.lastAlertAt < PROOF_ALERT_EVERY_MS) return;
    store.setAlert(ticket.threadId, now);
    await notify(content, { mention: true });
  }

  // Le membre remplit ses choix du Positionnement. Renvoie un message d'erreur, ou null.
  async function saveChoices(userId, { niche, nicheType, target, cta }, now) {
    const record = store.get(userId);
    if (!record || record.stage !== 2) return "Tes choix se remplissent à l'étape Positionnement.";
    if (!niche) return 'Écris le nom de ta niche.';
    store.update(userId, { niche, nicheType, targetCountry: target, ctaMethod: cta });
    const ticket = store.lastTicket(userId, stageOf(2).key);
    const thread = ticket && !ticket.closedAt ? await fetchThread(ticket.threadId) : null;
    if (thread) {
      await thread.send({ content: choicesText({ userId, record: store.get(userId) }), allowedMentions: { parse: [] } });
      await alertCoach(ticket, choicesNotice({ userId, threadId: ticket.threadId }), now);
    }
    return null;
  }

  function closeQuestionNeeded(userId, number) {
    return store.get(userId)?.stage === number;
  }

  // Clôture une étape : la fiche est mise à jour, le ticket est fermé et l'étape suivante est débloquée.
  // details : ce que le coach a noté (Positionnement : niche, nicheType, target, cta ; Confirmation : note).
  async function closeStage(userId, number, details, now) {
    const record = store.get(userId);
    if (!record || record.stage !== number) return false;
    const stage = stageOf(number);
    const ticket = store.lastTicket(userId, stage.key);
    const changes = { stage: number + 1, stageSince: now };
    if (number === 1) {
      changes.watchedAt = now;
      changes.watchedDays = dayOf(now) - dayOf(record.joinedAt) + 1;
      changes.watchedProof = ticket?.proofMessageId ? `${ticket.threadId}/${ticket.proofMessageId}` : null;
    }
    if (number === 2) {
      Object.assign(changes, {
        niche: details.niche,
        nicheType: details.nicheType,
        targetCountry: details.target,
        ctaMethod: details.cta,
        positionedAt: now,
      });
    }
    if (number === 3) Object.assign(changes, { confirmedAt: now, confirmationNote: details.note || null, engagementAt: now });
    store.update(userId, changes);
    // Arrivé à l'Engagement : la prison des 15 jours sans show-up commence demain.
    if (number === 3) db.setResetDay(userId, dayOf(now));
    if (ticket && !ticket.closedAt) {
      await closeThread(ticket.threadId, stageClosedText({ userId, stage: number, parcoursChannelId: ready.parcours.id }), userId, now);
    }
    return true;
  }

  function profileOf(userId) {
    return store.get(userId);
  }

  function saveProfile(userId, profile) {
    store.update(userId, {
      fullName: profile.name,
      homeCountry: profile.home,
      level: profile.level,
      equipment: profile.equipment,
      availability: profile.availability,
    });
  }

  // Le planning de l'Engagement. Renvoie un message d'erreur, ou null.
  async function savePlanning(userId, { days, check1, check2, home }, now) {
    const record = store.get(userId);
    if (!record || record.stage < ENGAGEMENT) return "Le planning se choisit à l'étape Engagement.";
    if (days.length < MIN_POST_DAYS) return `Choisis au moins ${MIN_POST_DAYS} jours.`;
    if (check2 <= check1) return 'La 2ᵉ vérification doit être plus tard que la 1ʳᵉ.';
    const homeCountry = home ?? record.homeCountry;
    if (!homeCountry) return 'Choisis le pays où tu vis.';
    const today = localClock(now, timeZoneOf(homeCountry)).day;
    store.update(userId, { postDays: days, check1, check2, homeCountry, planningFrom: nextDay(today) });
    const saved = store.get(userId);
    await sayInTicket(userId, 'engagement', planningSavedText(saved));
    await notify(planningChangedNotice({ userId, record: saved }));
    return null;
  }

  async function sayInTicket(userId, kind, content) {
    const ticket = store.lastTicket(userId, kind);
    const thread = ticket && !ticket.closedAt ? await fetchThread(ticket.threadId) : null;
    await thread?.send({ content, allowedMentions: { users: [userId] } });
  }

  // --- La prison interne ---

  // Les salons de l'accompagnement, sauf #prison-interne et le salon de sortie, que le prisonnier garde.
  function hiddenChannels() {
    const kept = new Set([ready.wall?.id, ready.exit?.id]);
    return [...guild.channels.cache.values()].filter(
      (channel) => (channel.id === categoryId || channel.parentId === categoryId) && !kept.has(channel.id),
    );
  }

  async function setHidden(userId, hidden) {
    for (const channel of hiddenChannels()) {
      try {
        if (hidden) await channel.permissionOverwrites.edit(userId, { ViewChannel: false }, { reason: 'Prison interne' });
        else await channel.permissionOverwrites.delete(userId, 'Sortie de la prison interne');
      } catch (error) {
        console.error(`[PlugBot] Prison interne : accès à #${channel.name} non modifié :`, error.message);
      }
    }
  }

  // Appelée par la prison quand un membre du parcours y entre : rôle Prisonnier interne, et
  // l'accompagnement lui est caché (une permission par membre : un rôle ne peut pas cacher un salon
  // qu'un autre rôle, TikTok, ouvre).
  async function afterImprison(member) {
    await member.roles
      .add(roles.internalPrisoner, 'Prison interne')
      .catch((error) => console.error('[PlugBot] Rôle Prisonnier interne non donné :', error.message));
    await setHidden(member.id, true);
    const record = store.get(member.id);
    if (record) store.update(member.id, { prisonCount: record.prisonCount + 1 });
  }

  // Appelée par la prison à la sortie : tout est rendu, et le délai de 5 jours repart de zéro.
  async function afterRelease(member, now = Date.now()) {
    if (member.roles.cache.has(roles.internalPrisoner)) {
      await member.roles
        .remove(roles.internalPrisoner, 'Sortie de la prison interne')
        .catch((error) => console.error('[PlugBot] Rôle Prisonnier interne non retiré :', error.message));
    }
    await setHidden(member.id, false);
    const record = store.get(member.id);
    if (record?.stage < ENGAGEMENT) store.update(member.id, { deadlineFrom: now });
  }

  // Le mur des retardataires et la notification au coach. reason : deadline ou noPosts.
  async function announceInternal(userIds, reason, days) {
    if (userIds.length === 0 || !ready.wall) return;
    await send(ready.wall, wallText(reason, userIds, ready.exit.id, days));
    await notify(internalPrisonNotice(userIds, reason === 'deadline' ? `délai de ${JOURNEY_DAYS} jours dépassé` : `${days} jours sans show-up`));
  }

  // Plus de 5 jours sans arriver à l'Engagement : prison interne.
  async function checkDeadlines(now) {
    const late = [];
    for (const record of store.active()) {
      if (record.stage >= ENGAGEMENT || deadlineOf(record) > now || db.getPrison(record.userId)) continue;
      const member = guild.members.cache.get(record.userId);
      if (!member) continue;
      await prison.imprison(member, 0, { internal: true });
      late.push(member.id);
    }
    if (late.length === 0) return;
    await send(channels.prison, deadlinePrisonText(late, ready.exit.id));
    await announceInternal(late, 'deadline');
  }

  // Le membre clique sur « Ouvrir mon ticket de sortie ». Renvoie la réponse, visible par lui seul.
  async function openExitTicket(member, now) {
    if (!isSetUp) return "Le parcours n'est pas encore prêt : réessaie dans quelques minutes.";
    if (!db.getPrison(member.id)?.internal) return "Ce salon sert à sortir de la prison interne : tu n'y es pas.";
    const ticket = store.lastTicket(member.id, 'sortie');
    const existing = ticket && !ticket.closedAt ? await fetchThread(ticket.threadId) : null;
    if (existing) return ticketOpenedText(existing.id);
    const thread = await openTicket(ready.exit, member, `🔓 Sortie — ${member.displayName}`, 'sortie', now);
    await thread.send({ content: exitTicketIntro(member.id), components: releaseComponents(member.id), allowedMentions: { users: [member.id] } });
    await notify(exitTicketNotice({ userId: member.id, threadId: thread.id }), { mention: true });
    return ticketOpenedText(thread.id);
  }

  // Le coach clique sur « Libérer ». Renvoie un message d'erreur, ou null.
  async function release(userId, now) {
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    if (!member || !db.getPrison(userId)) return "Ce membre n'est plus en prison.";
    await prison.releaseByTeam(member, dayOf(now));
    const ticket = store.lastTicket(userId, 'sortie');
    if (ticket && !ticket.closedAt) await closeThread(ticket.threadId, releasedText(userId), userId, now);
    return null;
  }

  // --- L'Engagement au quotidien ---

  // Les membres à l'étape Engagement qui ont choisi leur planning.
  function engaged() {
    return store.active().filter((record) => record.stage >= ENGAGEMENT && record.postDays.length > 0);
  }

  function dayBounds(record, day) {
    const zone = timeZoneOf(record.homeCountry);
    return {
      start: atLocal(day, 0, zone),
      end: atLocal(nextDay(day), 0, zone),
      morning: atLocal(day, MORNING_HOUR, zone),
      check1: atLocal(day, record.check1, zone),
      check2: atLocal(day, record.check2, zone),
    };
  }

  // Le message du matin et les deux vérifications, dans le ticket Engagement du membre.
  async function engagementTick(now) {
    for (const record of engaged()) {
      if (db.getPrison(record.userId)) continue;
      const local = localClock(now, timeZoneOf(record.homeCountry));
      if (local.day < record.planningFrom || !record.postDays.includes(local.weekday)) continue;
      const times = dayBounds(record, local.day);
      const sent = store.day(record.userId, local.day);
      const postedBefore = (until) => db.firstShowupBetween(record.userId, times.start, until) !== null;
      const say = (content) => sayInTicket(record.userId, 'engagement', content);
      const { userId } = record;

      if (!sent.morning && now >= times.morning && now < times.check1) {
        store.markDay(userId, local.day, 'morning');
        await say(morningText({ userId, record }));
      }
      if (!sent.check1 && now >= times.check1 && now < times.check2) {
        store.markDay(userId, local.day, 'check1');
        if (postedBefore(times.check1)) {
          store.markDay(userId, local.day, 'check2');
          await say(postedText(userId));
        } else {
          await say(firstCheckMissedText({ userId, record }));
        }
      }
      if (!sent.check2 && now >= times.check2 && now < times.end) {
        store.markDay(userId, local.day, 'check2');
        await say(postedBefore(times.check2) ? postedText(userId) : secondCheckMissedText(userId));
      }
    }
  }

  // Comment s'est passé le jour local `day` pour ce membre (null : pas encore de planning ce jour-là).
  function dayStatus(record, day) {
    if (day < record.planningFrom) return null;
    if (!record.postDays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) return 'rest';
    const times = dayBounds(record, day);
    const first = db.firstShowupBetween(record.userId, times.start, times.end);
    if (first === null) return 'missed';
    if (first < times.check1) return 'first';
    if (first < times.check2) return 'second';
    return 'late';
  }

  function dayKey(day) {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
  }

  // À minuit GMT : le récap de la journée (la journée locale est finie pour tous les membres,
  // du Sénégal à Madagascar). Le lundi, en plus, le bilan de la semaine.
  async function recapTick(now) {
    const today = dayOf(now);
    if (Number(db.getMeta('journey_recap_day')) >= today) return;
    db.setMeta('journey_recap_day', today);
    for (const member of guild.members.cache.values()) syncMember(member, now);

    const yesterday = dayKey(today - 1);
    const rows = [];
    for (const record of engaged()) {
      const status = db.getPrison(record.userId) ? 'prison' : dayStatus(record, yesterday);
      if (status) rows.push({ userId: record.userId, status });
    }
    if (rows.length > 0) await notify(dailyRecap({ day: yesterday, rows }));

    if (new Date(now).getUTCDay() !== 1) return;
    const week = [];
    for (const record of engaged()) {
      const statuses = Array.from({ length: 7 }, (_, i) => dayStatus(record, dayKey(today - 7 + i))).filter(
        (status) => status && status !== 'rest',
      );
      if (statuses.length > 0) week.push({ userId: record.userId, planned: statuses.length, kept: statuses.filter((status) => status !== 'missed').length });
    }
    if (week.length > 0) await notify(weeklyRecap(week));
  }

  // Tous les 3 jours à 9 h GMT : les membres en prison interne et ceux dont le délai approche.
  async function digestTick(now) {
    const today = dayOf(now);
    if (now < today * DAY_MS + DIGEST_HOUR * HOUR_MS || today - Number(db.getMeta('journey_digest_day')) < DIGEST_EVERY_DAYS) return;
    db.setMeta('journey_digest_day', today);
    const prisoners = [];
    const soon = [];
    for (const record of store.active()) {
      if (db.getPrison(record.userId)?.internal) {
        const ticket = store.lastTicket(record.userId, 'sortie');
        prisoners.push({ userId: record.userId, ticketId: ticket && !ticket.closedAt ? ticket.threadId : null });
      } else if (record.stage < ENGAGEMENT && deadlineOf(record) - now <= 2 * DAY_MS) {
        soon.push({ userId: record.userId, stage: record.stage, deadline: deadlineOf(record) });
      }
    }
    // Rien à signaler : le message part sans mention.
    await notify(digestText({ prisoners, soon }), { mention: prisoners.length + soon.length > 0 });
  }

  // --- Les fiches et les listes (#fiches-membres) ---

  // Les anciennes fiches publiées dans le salon sont effacées, 10 par minute : le salon ne garde que le panneau.
  async function removeOldFiches() {
    for (const record of store.oldFiches(OLD_FICHES_PER_TICK)) {
      const message = await ready.fiches.messages.fetch(record.ficheMessageId).catch(() => null);
      await message?.delete().catch(() => {});
      store.forgetFiche(record.userId);
    }
  }

  // La fiche d'un membre, pour le coach qui la demande.
  function fichePayload(userId) {
    const member = guild.members.cache.get(userId);
    const record = store.get(userId);
    const displayName = record?.fullName || member?.displayName || 'Membre';
    if (!record || record.status === 'exempt') {
      return { embeds: [noJourneyEmbed({ userId, displayName, plugged: Boolean(member?.roles.cache.has(roles.plugged)) })] };
    }
    const embed = ficheEmbed(record, {
      displayName: member?.displayName,
      inPrison: Boolean(db.getPrison(userId)),
      proofUrl: record.watchedProof ? `https://discord.com/channels/${guild.id}/${record.watchedProof}` : null,
      tickets: store.ticketsOf(userId).map(({ kind, threadId }) => ({ kind, threadId })),
    });
    return { embeds: [embed] };
  }

  // Les clients : les membres qui ont le rôle TikTok (sauf les coachs), avec leur parcours s'ils en ont un.
  function clients() {
    const people = [];
    for (const member of guild.members.cache.values()) {
      if (member.user.bot || !member.roles.cache.has(roles.plug) || isCoach(member)) continue;
      const record = store.get(member.id);
      people.push({
        userId: member.id,
        name: record?.fullName || member.displayName,
        joinedAt: record?.joinedAt ?? member.joinedTimestamp ?? 0,
        record: record?.status === 'active' ? record : null,
        plugged: member.roles.cache.has(roles.plugged),
        inPrison: Boolean(db.getPrison(member.id)),
      });
    }
    return people;
  }

  function criterionValue(criterion, record) {
    const fields = { target: 'targetCountry', cta: 'ctaMethod', home: 'homeCountry' };
    return record[fields[criterion] ?? criterion];
  }

  function valueLabel(criterion, value) {
    const lists = { target: TARGET_COUNTRIES, cta: CTA_METHODS, level: LEVELS, equipment: EQUIPMENT, availability: AVAILABILITY };
    if (criterion === 'nicheType') return nicheTypeLabel(value);
    if (criterion === 'home') return countryLabel(value);
    return lists[criterion] ? labelOf(lists[criterion], value) : value;
  }

  // Les valeurs d'un critère présentes chez les clients, avec leur nombre : [valeur, texte].
  function filterOptions(criterion) {
    const counts = new Map();
    for (const { record } of clients()) {
      const value = record ? criterionValue(criterion, record) : null;
      if (value === null || value === undefined || value === '') continue;
      counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
    }
    return [...counts]
      .sort(([, a], [, b]) => b - a)
      .map(([value, count]) => [value, `${valueLabel(criterion, value)} (${count})`.slice(0, 100)]);
  }

  // query : { list } (une liste du panneau) ou { criterion, value } (le menu « Filtrer par… »).
  function select(query) {
    const people = clients();
    if (query.criterion) {
      return {
        title: `${FILTERS[query.criterion]} : ${valueLabel(query.criterion, query.value)}`,
        people: people.filter(({ record }) => record && String(criterionValue(query.criterion, record)) === query.value),
      };
    }
    const stage = /^stage(\d)$/.exec(query.list)?.[1];
    const filters = {
      all: () => true,
      plugged: (person) => person.plugged,
      never: (person) => person.record?.stage === 1 && store.ticketsOf(person.userId).length === 0,
      prison: (person) => person.inPrison,
    };
    const keep = stage ? (person) => person.record?.stage === Number(stage) : filters[query.list];
    const title = stage ? `Étape ${stage} : ${stageOf(Number(stage)).emoji} ${stageOf(Number(stage)).label}` : LISTS[query.list].label;
    return { title, people: people.filter(keep) };
  }

  const stageRank = (person) => (person.plugged ? ENGAGEMENT + 1 : (person.record?.stage ?? 0));
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  const SORTERS = {
    az: byName,
    za: (a, b) => byName(b, a),
    oldest: (a, b) => a.joinedAt - b.joinedAt,
    newest: (a, b) => b.joinedAt - a.joinedAt,
    stageUp: (a, b) => stageRank(a) - stageRank(b) || byName(a, b),
    stageDown: (a, b) => stageRank(b) - stageRank(a) || byName(a, b),
  };

  // La liste que chaque coach regarde : la recherche, le tri et la page.
  const views = new Map();

  function render(view) {
    const { title, people } = select(view.query);
    const sorted = people.sort(SORTERS[view.sort]);
    const pages = Math.max(1, Math.ceil(sorted.length / PEOPLE_PER_PAGE));
    view.page = Math.min(view.page, pages - 1);
    const shown = sorted.slice(view.page * PEOPLE_PER_PAGE, (view.page + 1) * PEOPLE_PER_PAGE);
    return {
      content: '',
      embeds: [listEmbed({ title, people: shown, page: view.page, pages, total: sorted.length, sortLabel: SORTS[view.sort] })],
      components: listComponents({ sort: view.sort, page: view.page, pages, people: shown }),
      allowedMentions: { parse: [] },
    };
  }

  function openList(coachId, query) {
    const view = { query, sort: 'az', page: 0 };
    views.set(coachId, view);
    return render(view);
  }

  // Tri ou page suivante. Null si le bot a redémarré depuis la recherche.
  function changeList(coachId, { sort, move = 0 }) {
    const view = views.get(coachId);
    if (!view) return null;
    if (sort) Object.assign(view, { sort, page: 0 });
    view.page = Math.max(0, view.page + move);
    return render(view);
  }

  // --- Chaque minute ---

  async function tick(now) {
    if (!isSetUp && !(await setup())) return;
    await checkDeadlines(now);
    await engagementTick(now);
    await recapTick(now);
    await digestTick(now);
    await removeOldFiches();
  }

  return {
    start,
    tick,
    isCoach,
    syncMember,
    followsJourney,
    openStage,
    onMessage,
    closeQuestionNeeded,
    closeStage,
    profileOf,
    saveProfile,
    saveChoices,
    savePlanning,
    openExitTicket,
    release,
    afterImprison,
    afterRelease,
    announceInternal,
    filterOptions,
    fichePayload,
    openList,
    changeList,
    exitChannelId: () => ready.exit?.id ?? null,
  };
}
