// Tous les messages liés aux événements : annonces, rappels, tickets, planning, lives de l'accompagnement.

import { AUDIENCES, MENTIONS, REMINDERS, liveType } from './catalog.js';
import { formatDate, formatDateTime, formatTime } from './format.js';
import { endOf } from './schedule.js';
import { localTimeLines } from './zones.js';

const INTERESTED = '« Intéressé »';

// Les rôles choisis, et les mentions autorisées pour que Discord les notifie.
export function mentions(roles, config) {
  const ids = { free: config.roles.free, plug: config.roles.plug };
  const text = roles.map((role) => (role === 'everyone' ? '@everyone' : `<@&${ids[role]}>`)).join(' ');
  const allowedMentions = {
    parse: roles.includes('everyone') ? ['everyone'] : [],
    roles: roles.filter((role) => role !== 'everyone').map((role) => ids[role]),
  };
  return { text, allowedMentions };
}

// Le texte de présentation : le modèle choisi, puis le texte libre.
export function presentation(event) {
  const type = liveType(event.type);
  const template = event.template >= 0 ? type.texts[event.audience]?.[event.template] : null;
  return [template, event.details].filter(Boolean).join('\n\n');
}

export function location(event) {
  if (event.locationChannel) return `<#${event.locationChannel}>`;
  return event.locationUrl ?? 'à préciser';
}

export function eventLink(event, guildId) {
  return event.discordEventId ? `https://discord.com/events/${guildId}/${event.discordEventId}` : "(lien de l'événement)";
}

function heading(event) {
  const type = liveType(event.type);
  return { emoji: type.emoji, label: type.label };
}

function withMentions(roles, config, lines) {
  const { text } = mentions(roles, config);
  return (text ? [text, ...lines] : lines).join('\n');
}

// Les messages publiés dans le salon d'annonce, selon le moment.
export function eventMessage(kind, event, { config, guildId }) {
  const { emoji, label } = heading(event);
  const when = `📅 ${formatDate(event.startAt)} à ${formatTime(event.startAt)}`;
  const where = `📍 ${location(event)}`;
  const link = eventLink(event, guildId);
  const hours = ["🕒 **L'heure chez toi :**", ...localTimeLines(event.startAt)];

  switch (kind) {
    case 'creation':
      return withMentions(event.roles, config, [
        `${emoji} **${label} — ${event.title}**`,
        presentation(event),
        '',
        when,
        where,
        '',
        ...hours,
        '',
        `👉 Clique sur **${INTERESTED}** pour être prévenu au début du live : ${link}`,
      ]);
    case '7d':
      return withMentions(event.roles, config, [
        `📌 **Dans une semaine** : ${emoji} ${label} — **${event.title}**`,
        `${when} · ${where}`,
        `👉 Note-le et clique sur **${INTERESTED}** : ${link}`,
      ]);
    case '3d':
      return withMentions(event.roles, config, [
        `⏳ **Plus que 3 jours** avant ${emoji} **${event.title}** !`,
        `${when} · ${where}`,
        `👉 Clique sur **${INTERESTED}** pour ne pas le rater : ${link}`,
      ]);
    case '24h':
      return withMentions(event.roles, config, [
        `🔔 **C'est demain !** ${emoji} **${event.title}**`,
        `${when} · ${where}`,
        '',
        ...hours,
        '',
        `👉 ${link}`,
      ]);
    case '3h':
      return withMentions(event.roles, config, [
        `🚨 **Dans 3 heures !** ${emoji} **${event.title}** commence à ${formatTime(event.startAt)}.`,
        where,
        `👉 Clique sur **${INTERESTED}** pour être prévenu au lancement : ${link}`,
      ]);
    case 'feedback':
      return `🙏 Merci d'avoir participé à **${event.title}** ! Ton avis nous aide à faire encore mieux 👇`;
    case 'modification':
      return withMentions(event.roles, config, [
        `✏️ **Changement pour ${emoji} ${event.title}**`,
        `Nouvel horaire : ${when} · ${where}`,
        `👉 ${link}`,
      ]);
    case 'cancellation':
      return withMentions(event.roles, config, [
        `❌ **${emoji} ${event.title}** du ${formatDate(event.startAt)} est annulé. Désolé pour le changement, on se retrouve très vite !`,
      ]);
    default:
      throw new Error(`Message inconnu : ${kind}`);
  }
}

export const FEEDBACK_POLL = {
  question: 'Comment as-tu trouvé le live ?',
  answers: [
    { text: 'Excellent', emoji: '🔥' },
    { text: 'Bien', emoji: '👍' },
    { text: 'Moyen', emoji: '😐' },
    { text: 'Décevant', emoji: '👎' },
  ],
  durationHours: 24,
};

// Description de l'événement Discord (1 000 caractères au maximum).
export function discordDescription(event) {
  const text = presentation(event);
  return text.length > 1000 ? `${text.slice(0, 997)}…` : text;
}

// --- Tickets ---

const NONE = '—';

// Le résumé affiché en haut du ticket.
export function ticketSummary(event, { guildId }) {
  const { emoji, label } = heading(event);
  const status = {
    draft: '📝 Brouillon : remplis les réglages, puis clique sur ✅ Valider.',
    scheduled: `✅ Programmé — ${eventLink(event, guildId)}`,
    cancelled: '❌ Annulé',
    done: '🏁 Terminé',
  }[event.status];
  return [
    `🎫 **${emoji} ${label}**`,
    `**Public :** ${event.audience ? AUDIENCES[event.audience] : NONE}`,
    `**Sujet :** ${event.title ?? NONE}`,
    `**Date et heure :** ${event.startAt ? formatDateTime(event.startAt) : NONE}`,
    `**Durée :** ${event.durationMin} min`,
    `**Lieu :** ${event.locationChannel || event.locationUrl ? location(event) : NONE}`,
    `**Texte de présentation :** ${event.template >= 0 ? `modèle ${event.template + 1}` : 'aucun modèle'}${event.details ? ' + ton texte' : ''}`,
    `**Rôles mentionnés :** ${event.roles.length ? event.roles.map((role) => MENTIONS[role]).join(', ') : 'aucun'}`,
    `**Rappels :** ${event.reminders.length ? event.reminders.map((kind) => REMINDERS[kind].label.toLowerCase()).join(', ') : 'aucun'}`,
    '',
    `**Statut :** ${status}`,
  ].join('\n');
}

// Ce qui manque pour pouvoir valider l'événement.
export function missingFields(event, now) {
  const missing = [];
  if (!event.audience) missing.push('le public');
  if (!event.title) missing.push('le sujet');
  if (!event.startAt) missing.push("la date et l'heure");
  else if (event.startAt <= now) missing.push('une date et une heure à venir');
  if (!event.locationChannel && !event.locationUrl) missing.push('le lieu');
  return missing;
}

// L'aperçu : la liste des messages qui partiront, avec leur date d'envoi.
export function previewSchedule(event, reminders, now) {
  const lines = ['👁️ **Aperçu des messages qui partiront**'];
  if (event.reminders.includes('creation')) lines.push(`• Annonce : dès la validation`);
  for (const { kind, sendAt } of reminders) {
    const label = kind === 'feedback' ? "Sondage d'avis (fin du live)" : REMINDERS[kind].label;
    lines.push(`• ${label} : ${formatDateTime(sendAt)}`);
  }
  if (event.startAt && endOf(event) > now) lines.push(`• Le ticket se ferme à la fin du live.`);
  return lines.join('\n');
}

// --- Planning de la semaine ---

export function planningPrompt({ adminId, week, recurring, first }) {
  const monday = week * 24 * 60 * 60 * 1000;
  const sunday = monday + 6 * 24 * 60 * 60 * 1000;
  if (!first) {
    return `<@${adminId}> ⏰ Petit rappel : le planning de la semaine n'est pas encore fait. Utilise le panneau en haut du salon, puis clique sur **✅ Planning terminé**.`;
  }
  return [
    `<@${adminId}>`,
    `📅 **Planning de la semaine du ${formatDate(monday)} au ${formatDate(sunday)}**`,
    'Salut ! Quels événements sont prévus cette semaine ?',
    `Déjà au programme : 🔴 Live accompagnement — ${recurring.map((at) => formatDateTime(at)).join(' et ')}.`,
    '',
    'Crée tes lives avec le panneau en haut du salon (un ticket par live), puis clique sur **✅ Planning terminé**.',
  ].join('\n');
}

// --- Lives de l'accompagnement (mercredi et vendredi) ---

export function confirmationQuestion({ adminId, liveAt, first }) {
  const intro = first ? '🔴' : '⏰ Rappel —';
  return (
    `<@${adminId}> ${intro} **Live accompagnement ce soir à ${formatTime(liveAt)}** : il est maintenu ?\n` +
    "Réagis avec 👍 pour le confirmer ou ❌ pour l'annuler. PlugBot prévient ensuite les membres de l'accompagnement."
  );
}

export function liveConfirmedMessage({ liveAt, config }) {
  return [
    `<@&${config.roles.plug}>`,
    `✅ **Live confirmé ce soir à ${formatTime(liveAt)} !** Rendez-vous ce soir 🔥`,
    "Live réservé aux membres de l'accompagnement. Dis-nous dans le sondage si tu seras là 👇",
    '',
    "🕒 **L'heure chez toi :**",
    ...localTimeLines(liveAt),
  ].join('\n');
}

export function liveCancelledMessage({ liveAt, config }) {
  return [
    `<@&${config.roles.plug}>`,
    `❌ **Pas de live ce soir.** Le live de l'accompagnement prévu à ${formatTime(liveAt)} est annulé. On se retrouve au prochain live !`,
  ].join('\n');
}

export const PRESENCE_POLL = {
  question: 'Tu participes au live de ce soir ?',
  answers: [
    { text: 'Oui, je serai là', emoji: '✅' },
    { text: 'Non, je ne pourrai pas', emoji: '❌' },
  ],
};
