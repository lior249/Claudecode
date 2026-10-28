// Tous les textes publiés par PlugBot.

import { DAYS_TO_LEAVE_PRISON, PRISON_LEVELS } from './stats.js';
import { WEEK_MS } from './time.js';

export const MAX_LENGTH = 2000;
// Nombre maximum de mentions par message de prison, pour rester sous la limite de Discord.
const MENTIONS_PER_MESSAGE = 60;

export const CATEGORY_LABELS = { free: 'Free', plug: 'Plug' };

export function mention(userId) {
  return `<@${userId}>`;
}

export function plural(count, word) {
  return `${count} ${word}${Math.abs(count) > 1 ? 's' : ''}`;
}

export function ordinal(rank) {
  return rank === 1 ? '1er' : `${rank}e`;
}

// « a », « a et b », « a, b et c »
export function frenchList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}

function totals({ total, week }) {
  return `🏅 Total : **${plural(total, 'point')}** · 📅 Semaine : **${plural(week, 'point')}**`;
}

export function showupMessage({ userId, chain, week, total, rank, category, prison }) {
  const weekPart = rank ? `**${plural(week, 'point')}** (${ordinal(rank)} ${CATEGORY_LABELS[category]})` : `**${plural(week, 'point')}**`;
  const lines = [
    `🔥 ${mention(userId)} vient de show up !`,
    `⛓️ Chaîne : **${plural(chain, 'jour')} d'affilée** · 📅 Semaine : ${weekPart} · 🏅 Total : **${plural(total, 'point')}**`,
  ];
  if (prison.inPrison) {
    lines.push(
      `🔒 Toujours en prison : encore **${plural(prison.daysToLeave, 'jour')}** de show-up d'affilée pour sortir.`,
    );
  }
  return lines.join('\n');
}

export function removedMessage({ userId, adminId, total, week }) {
  return `❌ Le point de show-up de ${mention(userId)} a été retiré par ${mention(adminId)}.\n${totals({ total, week })}`;
}

export function restoredMessage({ userId, adminId, total, week }) {
  return `↩️ Le point de show-up de ${mention(userId)} a été rendu par ${mention(adminId)}.\n${totals({ total, week })}`;
}

export function deletedMessage({ userId, total, week }) {
  return `🗑️ ${mention(userId)} a supprimé son résultat : son point de show-up est retiré.\n${totals({ total, week })}`;
}

// Pour chaque palier : [verbe au singulier, verbe au pluriel, raison].
const PRISON_TEXTS = {
  3: ["vient d'entrer en prison", "viennent d'entrer en prison", 'aucun show-up depuis 3 jours'],
  6: ["s'enfonce dans la prison", "s'enfoncent dans la prison", '6 jours sans show-up'],
  10: ['est toujours en prison', 'sont toujours en prison', '10 jours sans show-up'],
  15: ['croupit en prison', 'croupissent en prison', '15 jours sans show-up'],
  30: ['est définitivement en prison', 'sont définitivement en prison', '30 jours sans show-up'],
};

if (PRISON_LEVELS.some((level) => !PRISON_TEXTS[level])) {
  throw new Error('Il manque un texte pour un palier de la prison.');
}

// Un message par groupe de membres qui atteignent le même palier le même jour.
export function prisonLevelMessages(level, userIds) {
  const [singular, pluralVerb, reason] = PRISON_TEXTS[level];
  const messages = [];
  for (let i = 0; i < userIds.length; i += MENTIONS_PER_MESSAGE) {
    const group = userIds.slice(i, i + MENTIONS_PER_MESSAGE);
    const verb = group.length > 1 ? pluralVerb : singular;
    messages.push(
      `🔒 ${frenchList(group.map(mention))} ${verb} : ${reason}.\n` +
        `Pour sortir : ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée.`,
    );
  }
  return messages;
}

export function prisonExitMessage(userId) {
  return `🔓 ${mention(userId)} sort de prison après ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée !`;
}

const CONGRATULATIONS = [
  'Énorme semaine, bravo à tous ceux qui se sont montrés !',
  'La régularité paie : félicitations aux plus présents de la semaine !',
  "Chaque jour compte. Respect à ceux qui n'ont rien lâché !",
  'Vous vous êtes montrés, vous avez gagné. Bravo à tous !',
  'Encore une semaine de travail. Félicitations aux membres les plus réguliers !',
];

export function congratulations(weekStartTimestamp) {
  return CONGRATULATIONS[Math.floor(weekStartTimestamp / WEEK_MS) % CONGRATULATIONS.length];
}

function rankingLines(entries, describe, empty) {
  if (entries.length === 0) return [empty];
  return entries.map((entry, index) => `${index + 1}. ${mention(entry.userId)} — ${describe(entry)}`);
}

export function elogesMessage({ category, congrats, weekly, allTime, prison }) {
  return [
    `🏆 **Les éloges de la semaine — ${CATEGORY_LABELS[category]}**`,
    congrats,
    '',
    '**🔥 Top 10 de la semaine**',
    ...rankingLines(weekly, (e) => plural(e.score, 'point'), '_Personne cette semaine._'),
    '',
    '**👑 Top 10 all-time**',
    ...rankingLines(allTime, (e) => plural(e.score, 'point'), "_Personne pour l'instant._"),
    '',
    '**🔒 Top 10 de la prison**',
    ...rankingLines(prison, (e) => `en prison depuis ${plural(e.score, 'jour')}`, '_Personne en prison, bravo !_'),
  ].join('\n');
}

// Découpe un texte trop long en plusieurs messages, sans couper les lignes.
export function splitMessage(text, max = MAX_LENGTH) {
  const parts = [];
  let current = '';
  for (const line of text.split('\n')) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= max) {
      current = candidate;
      continue;
    }
    if (current) parts.push(current);
    current = line.length <= max ? line : line.slice(0, max);
  }
  if (current) parts.push(current);
  return parts;
}
