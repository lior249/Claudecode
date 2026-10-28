// Tous les textes publiés par PlugBot.

import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, WARNING_DAYS_BEFORE } from './stats.js';
import { WEEK_MS } from './time.js';

export const MAX_LENGTH = 2000;
// Nombre maximum de mentions par message groupé, pour rester sous la limite de Discord.
const MENTIONS_PER_MESSAGE = 50;

export const CATEGORY_LABELS = { free: 'Free', plug: 'Accompagnement' };

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
  if (prison.inPrison && prison.daysToLeave > 0) {
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

// Le texte d'alerte, suivi de la liste des membres concernés.
// Si la liste est trop longue, la suite part dans d'autres messages.
export function prisonWarningMessages(userIds, config) {
  const header = [
    '⚠️ **Alerte : tu vas en prison.**',
    `Dans ${WARNING_DAYS_BEFORE} jours, tu iras en prison, parce que tu n'as posté aucun résultat montrant que tu es actif sur TikTok.`,
    `Si tu veux éviter ça, poste une vidéo et envoie le résultat dans les ${WARNING_DAYS_BEFORE} jours qui viennent. Sinon, tu rejoindras la prison.`,
    '(La prison te coupe tous les accès principaux du Discord : écrire dans les salons, rejoindre les lives, accéder aux réductions, etc.)',
    `Pour éviter que ça arrive, envoie juste un seul résultat dans ${channelMention(config.channels.results)}, le plus vite possible.`,
    '',
    `Voici tous ceux qui iront en prison dans ${WARNING_DAYS_BEFORE} jours s'ils ne postent aucun résultat :`,
  ].join('\n');
  return inGroups(userIds).map((group, index) => {
    const mentions = group.map(mention).join(' ');
    return index === 0 ? `${header}\n${mentions}` : mentions;
  });
}

function wayOutOfPrison(config) {
  return `Pour sortir : ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée dans ${channelMention(config.channels.results)}.`;
}

// Un message par groupe de membres qui entrent en prison le même jour après le même délai.
export function prisonEntryMessages(days, userIds, config) {
  return inGroups(userIds).map(
    (group) =>
      `🔒 ${frenchList(group.map(mention))} ${group.length > 1 ? "viennent d'entrer" : "vient d'entrer"} en prison : ` +
      `${days} jours sans show-up.\n${wayOutOfPrison(config)}`,
  );
}

export function prisonFinalMessages(userIds, config) {
  return inGroups(userIds).map(
    (group) =>
      `🔒 ${frenchList(group.map(mention))} ${group.length > 1 ? 'sont' : 'est'} définitivement en prison : ` +
      `${FINAL_PRISON_DAYS} jours sans show-up.\n${wayOutOfPrison(config)}`,
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

// sections : [{ category, entries }], l'accompagnement d'abord.
// Le premier Free gagne le rôle de la période et sa réduction ; le premier de l'accompagnement est félicité.
export function rankingMessage({ kind, title, congrats, sections, config }) {
  const { emoji, role } = RANKINGS[kind];
  const lines = [`${emoji} **${title}**`, congrats];
  for (const { category, entries } of sections) {
    lines.push('', `**${CATEGORY_LABELS[category]}**`);
    if (entries.length === 0) lines.push('_Personne pour cette période._');
    entries.forEach((entry, index) => lines.push(`${index + 1}. ${mention(entry.userId)} — ${plural(entry.score, 'point')}`));
  }
  const winners = sections.filter((section) => section.entries.length > 0);
  if (winners.length > 0) lines.push('');
  for (const { category, entries } of winners) {
    const winner = mention(entries[0].userId);
    lines.push(
      category === 'free'
        ? `${emoji} ${winner} remporte ${roleMention(config.roles[role])} : −${DISCOUNTS[role]} % sur la formation !`
        : `🏆 ${winner} remporte le classement ${CATEGORY_LABELS[category]} !`,
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
