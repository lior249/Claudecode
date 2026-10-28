// Tous les textes publiés par PlugBot.

import { DAYS_TO_LEAVE_PRISON, PRISON_LEVELS, PRISON_WARNING_DAYS } from './stats.js';
import { WEEK_MS } from './time.js';

export const MAX_LENGTH = 2000;
// Nombre maximum de mentions par message groupé, pour rester sous la limite de Discord.
const MENTIONS_PER_MESSAGE = 50;

export const CATEGORY_LABELS = { free: 'Free', plug: 'Plug' };

// Réduction sur la formation débloquée par chaque rôle (en %).
export const DISCOUNTS = { streak: 15, weekWinner: 25, monthWinner: 35 };

export function mention(userId) {
  return `<@${userId}>`;
}

export function roleMention(roleId) {
  return `<@&${roleId}>`;
}

export function channelMention(channelId) {
  return `<#${channelId}>`;
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

function inGroups(userIds) {
  const groups = [];
  for (let i = 0; i < userIds.length; i += MENTIONS_PER_MESSAGE) groups.push(userIds.slice(i, i + MENTIONS_PER_MESSAGE));
  return groups;
}

function totals({ total, week }) {
  return `🏅 Total : **${plural(total, 'point')}** · 📅 Semaine : **${plural(week, 'point')}**`;
}

// --- #show-up ---

export function showupMessage({ userId, chain, week, total, rank, category, prison }) {
  const weekPart = rank
    ? `**${plural(week, 'point')}** (${ordinal(rank)} ${CATEGORY_LABELS[category]})`
    : `**${plural(week, 'point')}**`;
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

export function streakRewardMessage(userId, config) {
  return (
    `🔥 ${mention(userId)} atteint **${config.streakRoleDays} jours d'affilée** et débloque ` +
    `${roleMention(config.roles.streak)} : −${DISCOUNTS.streak} % sur la formation !`
  );
}

// --- #la-prison ---

export function prisonWarningMessages(userIds, config) {
  const { roles } = config;
  const daysLeft = PRISON_LEVELS[0] - PRISON_WARNING_DAYS;
  return inGroups(userIds).map(
    (group) =>
      `⚠️ ${frenchList(group.map(mention))} : ${PRISON_WARNING_DAYS} jours sans show-up.\n` +
      `Encore ${plural(daysLeft, 'jour')} sans résultat et c'est la prison : le rôle ${roleMention(roles.prisoner)}, ` +
      `plus le droit d'écrire ailleurs que dans la prison, et plus aucun accès aux récompenses ` +
      `(${roleMention(roles.streak)}, ${roleMention(roles.weekWinner)}, ${roleMention(roles.monthWinner)}).\n` +
      `Un seul résultat dans ${channelMention(config.channels.results)} suffit pour l'éviter.`,
  );
}

// Pour chaque palier : [verbe au singulier, verbe au pluriel, raison].
const PRISON_TEXTS = {
  15: ["vient d'entrer en prison", "viennent d'entrer en prison", '15 jours sans show-up'],
  30: ['est définitivement en prison', 'sont définitivement en prison', '30 jours sans show-up'],
};

if (PRISON_LEVELS.some((level) => !PRISON_TEXTS[level])) {
  throw new Error('Il manque un texte pour un palier de la prison.');
}

function wayOutOfPrison(config) {
  const ticket = config.prisonExitChannelId ? ` dans ${channelMention(config.prisonExitChannelId)}` : '';
  return (
    `Pour sortir : ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée dans ${channelMention(config.channels.results)}, ` +
    `ou un ticket${ticket} pour justifier ton absence.`
  );
}

// Un message par groupe de membres qui atteignent le même palier le même jour.
export function prisonLevelMessages(level, userIds, config) {
  const [singular, pluralVerb, reason] = PRISON_TEXTS[level];
  return inGroups(userIds).map(
    (group) =>
      `🔒 ${frenchList(group.map(mention))} ${group.length > 1 ? pluralVerb : singular} : ${reason}.\n` +
      wayOutOfPrison(config),
  );
}

export function prisonExitMessage(userId) {
  return `🔓 ${mention(userId)} sort de prison après ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée !`;
}

export function prisonReleaseMessage(userId) {
  return `🔓 ${mention(userId)} a été libéré de prison par l'équipe.`;
}

// --- #top-7 et #top-30 ---

const CONGRATULATIONS = [
  'Énorme travail, bravo à tous ceux qui se sont montrés !',
  'La régularité paie : félicitations aux plus présents !',
  "Chaque jour compte. Respect à ceux qui n'ont rien lâché !",
  'Vous vous êtes montrés, vous avez gagné. Bravo à tous !',
  'Félicitations aux membres les plus réguliers !',
];

export function congratulations(periodStart) {
  return CONGRATULATIONS[Math.floor(periodStart / WEEK_MS) % CONGRATULATIONS.length];
}

const RANKINGS = {
  week: { emoji: '⚡', role: 'weekWinner' },
  month: { emoji: '★', role: 'monthWinner' },
};

// sections : [{ category, entries }]. Les gagnants reçoivent le rôle de la période.
export function rankingMessage({ kind, title, congrats, sections, winners, config }) {
  const { emoji, role } = RANKINGS[kind];
  const lines = [`${emoji} **${title}**`, congrats];
  for (const { category, entries } of sections) {
    lines.push('', `**${CATEGORY_LABELS[category]}**`);
    if (entries.length === 0) lines.push('_Personne pour cette période._');
    entries.forEach((entry, index) => lines.push(`${index + 1}. ${mention(entry.userId)} — ${plural(entry.score, 'point')}`));
  }
  if (winners.length > 0) {
    lines.push(
      '',
      `${emoji} ${frenchList(winners.map(mention))} ${winners.length > 1 ? 'remportent' : 'remporte'} ` +
        `${roleMention(config.roles[role])} : −${DISCOUNTS[role]} % sur la formation !`,
    );
  }
  return lines.join('\n');
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
