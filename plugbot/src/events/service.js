// Le cœur de la planification : tickets, validation, événements Discord, rappels, planning de la semaine
// et confirmation des lives de l'accompagnement.
// Deux salons privés : celui de création (le panneau et les tickets) et celui des rappels (les questions
// de PlugBot : planning de la semaine, « as-tu fini ? », lives de l'accompagnement).

import { ChannelType, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, ThreadAutoArchiveDuration } from 'discord.js';
import { REMINDERS, audiencesOf, liveType } from './catalog.js';
import { formatDate, formatDateTime } from './format.js';
import {
  FEEDBACK_POLL,
  PRESENCE_POLL,
  confirmationQuestion,
  discordDescription,
  eventMessage,
  finishedQuestion,
  liveCancelledMessage,
  liveConfirmedMessage,
  mentions,
  missingFields,
  planningNoMessage,
  planningPrompt,
  planningYesMessage,
  previewSchedule,
} from './render.js';
import { confirmationSlot, endOf, planningSlot, recurringLivesOfWeek, reminderSchedule } from './schedule.js';
import { controlMessage, finishedQuestionComponents, panelMessage, planningPromptComponents, settingsMessage } from './ui.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
// Formats acceptés par Discord pour l'image de couverture d'un événement.
const COVER_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);
const EDITABLE = new Set(['draft', 'scheduled']);
const CONFIRM = '👍';
const DECLINE = '👎';
const REFUSE = '❌';

function toPoll({ question, answers }, durationHours) {
  return { question: { text: question }, answers, duration: durationHours, allowMultiselect: false };
}

export function createEventService({ config, db, events, guild, channels }) {
  const context = { config, guildId: guild.id };
  const adminId = [...config.adminIds][0];
  // Sans salon des rappels, les questions de PlugBot arrivent dans le salon de création.
  const reminderChannel = channels.planningReminder ?? channels.planning;

  function readJson(key) {
    const value = db.getMeta(key);
    return value ? JSON.parse(value) : null;
  }

  function announceChannel(event) {
    return event.audience === 'plug' ? channels.announcePlug : channels.announceFree;
  }

  async function postEventMessage(kind, event) {
    const { allowedMentions } = mentions(event.roles, config);
    const message = { content: eventMessage(kind, event, context), allowedMentions };
    if (kind === 'feedback') message.poll = toPoll(FEEDBACK_POLL, FEEDBACK_POLL.durationHours);
    await announceChannel(event).send(message);
  }

  async function fetchThread(event) {
    const thread = await guild.channels.fetch(event.threadId).catch(() => null);
    if (thread?.archived) await thread.setArchived(false).catch(() => {});
    return thread;
  }

  function threadName(event) {
    const type = liveType(event.type);
    const name = event.title ? `${type.emoji} ${event.title}` : `${type.emoji} ${type.label}`;
    return (event.startAt ? `${name} — ${formatDate(event.startAt)}` : name).slice(0, 100);
  }

  // Met à jour le ticket (réglages, résumé, nom du fil) après un changement.
  async function refreshTicket(eventId) {
    const event = events.get(eventId);
    const thread = await fetchThread(event);
    if (!thread) return;
    await thread.messages.edit(event.settingsMessageId, settingsMessage(event));
    await thread.messages.edit(event.controlMessageId, controlMessage(event, context));
    if (thread.name !== threadName(event)) await thread.setName(threadName(event)).catch(() => {});
  }

  async function closeTicket(event) {
    const thread = await fetchThread(event);
    if (!thread) return;
    await thread.messages.edit(event.settingsMessageId, settingsMessage(event)).catch(() => {});
    await thread.messages.edit(event.controlMessageId, controlMessage(event, context)).catch(() => {});
    await thread.setArchived(true).catch(() => {});
  }

  // Ouvre un ticket (un fil dans le salon de planification) pour un nouveau live.
  async function openTicket(typeKey, now) {
    const type = liveType(typeKey);
    const audiences = audiencesOf(type);
    const event = events.create(typeKey, audiences.length === 1 ? audiences[0] : null, now);
    const thread = await channels.planning.threads.create({
      name: threadName(event),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: 'Ticket de live PlugBot',
    });
    await thread.members.add(adminId).catch(() => {});
    const settings = await thread.send(settingsMessage(event));
    const control = await thread.send(controlMessage(event, context));
    events.update(event.id, { threadId: thread.id, settingsMessageId: settings.id, controlMessageId: control.id });
    return thread;
  }

  function coverAttachment(message) {
    return message?.attachments.find((attachment) => COVER_TYPES.has(attachment.contentType)) ?? null;
  }

  // Lien de l'image de couverture. Le message est relu à chaque fois : les liens des pièces jointes
  // de Discord expirent au bout de quelques heures.
  async function coverUrl(event) {
    if (!event.coverMessageId) return null;
    const thread = await fetchThread(event);
    const message = await thread?.messages.fetch(event.coverMessageId).catch(() => null);
    return coverAttachment(message)?.url ?? null;
  }

  async function discordEventOptions(event) {
    const type = liveType(event.type);
    const options = {
      name: `${type.emoji} ${event.title}`.slice(0, 100),
      scheduledStartTime: new Date(event.startAt),
      scheduledEndTime: new Date(endOf(event)),
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      description: discordDescription(event),
    };
    const image = await coverUrl(event);
    if (image) options.image = image;
    if (event.locationUrl) {
      return { ...options, entityType: GuildScheduledEventEntityType.External, entityMetadata: { location: event.locationUrl }, channel: null };
    }
    const channel = await guild.channels.fetch(event.locationChannel);
    const stage = channel.type === ChannelType.GuildStageVoice;
    return {
      ...options,
      entityType: stage ? GuildScheduledEventEntityType.StageInstance : GuildScheduledEventEntityType.Voice,
      channel: channel.id,
      entityMetadata: null,
    };
  }

  function describeDiscordError(error) {
    return (
      `Discord a refusé l'événement : ${error.message}\n` +
      'Vérifie que PlugBot a la permission « Gérer les événements » et, pour un salon « stage », ' +
      '« Gérer les salons », « Rendre muets des membres » et « Déplacer des membres » dans ce salon.'
    );
  }

  // Une image envoyée par l'admin dans un ticket devient l'image de couverture de l'événement.
  // Renvoie true si le message a été pris en compte.
  async function onTicketMessage(message) {
    if (message.author?.bot || !config.adminIds.has(message.author?.id)) return false;
    const event = events.byThread(message.channelId);
    if (!event || !EDITABLE.has(event.status) || message.attachments.size === 0) return false;
    const image = coverAttachment(message);
    if (!image) {
      await message.reply("⚠️ Pour l'image de couverture, envoie une image en PNG, JPG ou GIF.");
      return true;
    }
    if (event.status === 'scheduled') {
      try {
        await guild.scheduledEvents.edit(event.discordEventId, { image: image.url });
      } catch (error) {
        await message.reply(`⚠️ ${describeDiscordError(error)}`);
        return true;
      }
    }
    events.update(event.id, { coverMessageId: message.id });
    await message.react('🖼️').catch(() => {});
    await message.reply(
      event.status === 'scheduled'
        ? "🖼️ C'est fait : l'image de couverture est sur l'événement."
        : "🖼️ Image de couverture enregistrée : elle sera ajoutée à l'événement quand tu cliqueras sur ✅ Valider.",
    );
    await refreshTicket(event.id);
    return true;
  }

  // Valide un brouillon : crée l'événement Discord, publie l'annonce, programme les rappels.
  // Renvoie un message d'erreur à montrer à l'admin, ou null si tout s'est bien passé.
  async function validate(eventId, now) {
    const event = events.get(eventId);
    const missing = missingFields(event, now);
    if (missing.length > 0) return `Il manque ${missing.join(', ')}.`;
    try {
      const created = await guild.scheduledEvents.create(await discordEventOptions(event));
      events.update(event.id, { discordEventId: created.id, status: 'scheduled' });
    } catch (error) {
      return describeDiscordError(error);
    }
    const scheduled = events.get(event.id);
    if (scheduled.reminders.includes('creation')) {
      await postEventMessage('creation', scheduled);
      events.update(event.id, { announced: true });
    }
    events.setReminders(event.id, reminderSchedule(scheduled, now));
    await refreshTicket(event.id);
    // L'événement est créé : une question qui ne part pas ne doit pas faire croire à un échec.
    await reminderChannel
      .send({
        content: finishedQuestion({ adminId, event: scheduled }),
        components: finishedQuestionComponents(),
        allowedMentions: { users: [adminId] },
      })
      .catch((error) => console.error('[PlugBot] Question « as-tu fini ? » non envoyée :', error.message));
    return null;
  }

  // Enregistre les changements d'un événement déjà programmé. Si la date, l'heure ou le lieu changent,
  // les membres sont prévenus (si l'annonce était déjà partie).
  async function saveChanges(eventId, now) {
    const event = events.get(eventId);
    const missing = missingFields(event, now);
    if (missing.length > 0) return `Il manque ${missing.join(', ')}.`;
    let moved = false;
    try {
      const options = await discordEventOptions(event);
      const current = await guild.scheduledEvents.fetch(event.discordEventId).catch(() => null);
      moved =
        !current ||
        current.scheduledStartTimestamp !== event.startAt ||
        (current.channelId ?? null) !== (options.channel ?? null) ||
        (current.entityMetadata?.location ?? null) !== (event.locationUrl ?? null);
      if (current) {
        await guild.scheduledEvents.edit(event.discordEventId, options);
      } else {
        const created = await guild.scheduledEvents.create(options);
        events.update(event.id, { discordEventId: created.id });
      }
    } catch (error) {
      return describeDiscordError(error);
    }
    const saved = events.get(event.id);
    if (moved && saved.announced) await postEventMessage('modification', saved);
    if (!saved.announced && saved.reminders.includes('creation')) {
      await postEventMessage('creation', saved);
      events.update(event.id, { announced: true });
    }
    events.setReminders(event.id, reminderSchedule(saved, now));
    await refreshTicket(event.id);
    return null;
  }

  async function cancel(eventId) {
    const event = events.get(eventId);
    if (event.discordEventId) await guild.scheduledEvents.delete(event.discordEventId).catch(() => {});
    events.clearReminders(event.id);
    events.update(event.id, { status: 'cancelled' });
    if (event.announced) await postEventMessage('cancellation', event);
    await closeTicket(events.get(event.id));
  }

  // Supprime un brouillon et son ticket.
  async function deleteDraft(eventId) {
    const event = events.get(eventId);
    events.update(event.id, { status: 'cancelled' });
    const thread = await fetchThread(event);
    await thread?.delete().catch(() => {});
  }

  // Montre dans le ticket tous les messages qui partiront, sans notifier personne.
  async function preview(eventId, now) {
    const event = events.get(eventId);
    const thread = await fetchThread(event);
    if (!thread) return;
    const quiet = { allowedMentions: { parse: [] } };
    const reminders = event.startAt ? reminderSchedule(event, now) : [];
    await thread.send({ content: previewSchedule(event, reminders, now), ...quiet });
    if (!event.title || !event.startAt) {
      await thread.send({ content: "🧪 Remplis d'abord le sujet, la date et l'heure pour voir les messages.", ...quiet });
      return;
    }
    const kinds = [...(event.reminders.includes('creation') ? ['creation'] : []), ...reminders.map(({ kind }) => kind)];
    for (const kind of kinds) {
      const label = kind === 'creation' ? 'Annonce' : kind === 'feedback' ? "Sondage d'avis (avec un sondage)" : REMINDERS[kind].label;
      await thread.send({ content: `🧪 **Aperçu — ${label}**\n${eventMessage(kind, event, context)}`, ...quiet });
    }
  }

  function upcomingList() {
    const upcoming = events.upcoming();
    if (upcoming.length === 0) return "Aucun événement programmé pour l'instant.";
    return [
      '📋 **Événements à venir**',
      ...upcoming.map((event) => {
        const type = liveType(event.type);
        return `• ${type.emoji} **${event.title}** — ${formatDateTime(event.startAt)} — <#${event.threadId}>`;
      }),
    ].join('\n');
  }

  // Envoie les rappels dont l'heure est passée. Le sondage d'avis termine l'événement et ferme le ticket.
  async function sendDueReminders(now) {
    for (const { eventId, kind } of events.dueReminders(now)) {
      events.removeReminder(eventId, kind);
      const event = events.get(eventId);
      if (event?.status !== 'scheduled') continue;
      try {
        await postEventMessage(kind, event);
      } catch (error) {
        console.error(`[PlugBot] Rappel « ${kind} » non envoyé pour l'événement ${eventId} :`, error.message);
      }
      if (kind === 'feedback') {
        events.update(eventId, { status: 'done' });
        await closeTicket(events.get(eventId));
      }
    }
  }

  // --- Planning de la semaine ---

  // La semaine concernée quand tu dis avoir fini : le dimanche, celle qui commence le lendemain ;
  // du lundi au samedi, la semaine en cours.
  function planningWeek(now) {
    const day = Math.floor(now / DAY_MS);
    const weekday = new Date(now).getUTCDay();
    return weekday === 0 ? day + 1 : day - (weekday - 1);
  }

  // « J'ai fini de créer mes événements » : plus de rappel pour planifier cette semaine.
  function markPlanningDone(now) {
    db.setMeta('planning_done_week', planningWeek(now));
  }

  function plannedDuring(week) {
    const start = week * DAY_MS;
    return events.upcoming().filter((event) => event.startAt >= start && event.startAt < start + 7 * DAY_MS);
  }

  // Demande du planning le dimanche et le lundi, à chaque créneau, jusqu'à « J'ai fini » ou 👎.
  async function planningTick(now) {
    const slot = planningSlot(now);
    if (!slot || Number(db.getMeta('planning_done_week')) === slot.week) return;
    if (Number(db.getMeta('planning_last_slot')) >= slot.slot) return;
    db.setMeta('planning_last_slot', slot.slot);
    const prompts = readJson('planning_prompts');
    const earlier = prompts?.week === slot.week ? prompts.messageIds : [];
    const message = await reminderChannel.send({
      content: planningPrompt({
        adminId,
        week: slot.week,
        recurring: recurringLivesOfWeek(slot.week),
        planned: plannedDuring(slot.week),
        first: earlier.length === 0,
      }),
      components: planningPromptComponents(),
      allowedMentions: { users: [adminId] },
    });
    db.setMeta('planning_prompts', JSON.stringify({ week: slot.week, messageIds: [...earlier, message.id] }));
    await message.react(CONFIRM).catch(() => {});
    await message.react(DECLINE).catch(() => {});
  }

  // 👍 sur la demande du planning : PlugBot t'envoie créer tes événements, et continue de te relancer.
  // 👎 : rien à créer cette semaine, plus de relance.
  async function onPlanningReaction(reaction) {
    const prompts = readJson('planning_prompts');
    if (!prompts?.messageIds.includes(reaction.message.id)) return false;
    const name = reaction.emoji.name ?? '';
    if (name.startsWith(CONFIRM)) {
      await reminderChannel.send(planningYesMessage(channels.planning.id));
      return true;
    }
    if (!name.startsWith(DECLINE)) return false;
    db.setMeta('planning_done_week', prompts.week);
    await reminderChannel.send(planningNoMessage(channels.planning.id));
    return true;
  }

  // --- Lives de l'accompagnement ---

  async function confirmationTick(now) {
    const slot = confirmationSlot(now);
    if (!slot) return;
    const state = readJson('live_confirmation');
    const today = state?.day === slot.day ? state : null;
    if (today && (today.status !== 'pending' || today.lastSlot >= slot.slot)) return;
    // Le créneau est noté avant l'envoi : si Discord refuse, PlugBot réessaie au créneau suivant,
    // pas chaque minute.
    const next = { day: slot.day, liveAt: slot.liveAt, status: 'pending', lastSlot: slot.slot, messageIds: today?.messageIds ?? [] };
    db.setMeta('live_confirmation', JSON.stringify(next));
    const message = await reminderChannel.send({
      content: confirmationQuestion({ adminId, liveAt: slot.liveAt, first: !today }),
      allowedMentions: { users: [adminId] },
    });
    db.setMeta('live_confirmation', JSON.stringify({ ...next, messageIds: [...next.messageIds, message.id] }));
    await message.react(CONFIRM).catch(() => {});
    await message.react(REFUSE).catch(() => {});
  }

  // 👍 ou ❌ sur la question du jour : PlugBot prévient les membres de l'accompagnement.
  async function onConfirmationReaction(reaction, now) {
    const state = readJson('live_confirmation');
    if (!state || state.status !== 'pending' || !state.messageIds.includes(reaction.message.id) || now >= state.liveAt) return false;
    const name = reaction.emoji.name ?? '';
    const confirmed = name.startsWith(CONFIRM);
    if (!confirmed && name !== REFUSE) return false;
    db.setMeta('live_confirmation', JSON.stringify({ ...state, status: confirmed ? 'confirmed' : 'cancelled' }));
    const allowedMentions = { roles: [config.roles.plug] };
    if (confirmed) {
      const hours = Math.max(1, Math.ceil((state.liveAt - now) / HOUR_MS));
      await channels.announcePlug.send({
        content: liveConfirmedMessage({ liveAt: state.liveAt, config }),
        poll: toPoll(PRESENCE_POLL, hours),
        allowedMentions,
      });
    } else {
      await channels.announcePlug.send({ content: liveCancelledMessage({ liveAt: state.liveAt, config }), allowedMentions });
    }
    await reminderChannel.send(confirmed ? "✅ C'est noté : le live de ce soir est annoncé." : "❌ C'est noté : les membres sont prévenus que le live est annulé.");
    return true;
  }

  // Réaction de l'admin dans le salon des rappels. Renvoie true si elle répondait à une question de PlugBot.
  async function onReaction(reaction, user, now) {
    if (!config.adminIds.has(user.id)) return false;
    return (await onPlanningReaction(reaction)) || (await onConfirmationReaction(reaction, now));
  }

  // Le panneau est-il en place ? Sinon, PlugBot réessaie à chaque tick (par exemple après une
  // correction des permissions) et ne signale le problème qu'une fois.
  let panelReady = false;
  let panelFailed = false;

  async function publishPanel() {
    const content = panelMessage({ reminderChannelId: channels.planningReminder?.id });
    const id = db.getMeta('events_panel_message');
    const existing = id ? await channels.planning.messages.fetch(id).catch(() => null) : null;
    if (existing) {
      await existing.edit(content);
      return;
    }
    const panel = await channels.planning.send(content);
    db.setMeta('events_panel_message', panel.id);
    await panel.pin().catch(() => {});
  }

  // Publie le panneau en haut du salon de création, s'il n'y est pas déjà. Ne lève jamais d'erreur.
  async function ensurePanel() {
    try {
      await publishPanel();
    } catch (error) {
      if (!panelFailed) {
        console.error(
          `[PlugBot] Le panneau des événements n'a pas pu être publié dans #${channels.planning.name} : ${error.message}. ` +
            'Vérifie que PlugBot a accès à ce salon (voir le salon, envoyer des messages, voir les anciens messages). ' +
            'Il réessaie chaque minute.',
        );
      }
      panelFailed = true;
      return;
    }
    if (panelFailed) console.log('[PlugBot] Panneau des événements publié.');
    panelReady = true;
    panelFailed = false;
  }

  async function tick(now) {
    if (!panelReady) await ensurePanel();
    await planningTick(now);
    await confirmationTick(now);
    await sendDueReminders(now);
  }

  return {
    openTicket,
    refreshTicket,
    validate,
    saveChanges,
    cancel,
    deleteDraft,
    preview,
    upcomingList,
    markPlanningDone,
    onReaction,
    onTicketMessage,
    ensurePanel,
    tick,
  };
}
