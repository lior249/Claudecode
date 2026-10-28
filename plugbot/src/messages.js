// Tous les textes publiés par PlugBot.

import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, WARNING_DAYS_BEFORE } from './stats.js';
import { WEEK_MS, dayAndMonth, monthName } from './time.js';

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

// `weekOpen` est faux entre dimanche 18 h et lundi 18 h, quand le challenge de la semaine est en pause.
export function showupMessage({ userId, chain, week, total, rank, category, prison, weekOpen = true }) {
  let weekPart = `**${plural(week, 'point')}**`;
  if (!weekOpen) weekPart = 'le challenge reprend lundi à 18 h';
  else if (rank) weekPart += ` (${ordinal(rank)} ${CATEGORY_LABELS[category]})`;
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

const CHALLENGES = {
  week: { emoji: '⚡', role: 'weekWinner', size: 5 },
  month: { emoji: '★', role: 'monthWinner', size: 10 },
};

// Une liste par catégorie (sections : [{ category, entries }], l'accompagnement d'abord).
function sectionLines(sections, empty) {
  const lines = [];
  for (const { category, entries } of sections) {
    lines.push('', `**${CATEGORY_LABELS[category]}**`);
    if (entries.length === 0) lines.push(empty);
    entries.forEach((entry, index) => lines.push(`${index + 1}. ${mention(entry.userId)} — ${plural(entry.score, 'point')}`));
  }
  return lines;
}

function prizeLine(kind, config, prefix) {
  const { emoji, role } = CHALLENGES[kind];
  return `${emoji} ${prefix} ${roleMention(config.roles[role])} : −${DISCOUNTS[role]} % sur la formation !`;
}

function endLabel(kind, end) {
  return kind === 'week' ? 'dimanche à 18 h (UTC)' : `le ${dayAndMonth(end)} à 18 h (UTC)`;
}

function untilLabel(kind, end) {
  return kind === 'week' ? "Jusqu'à dimanche 18 h (UTC)" : `Jusqu'au ${dayAndMonth(end)} à 18 h (UTC)`;
}

// Lundi 18 h (semaine) ou le 1er à 18 h (mois) : le challenge standard est lancé.
export function challengeLaunchMessage({ kind, end, config }) {
  const { emoji } = CHALLENGES[kind];
  const title = kind === 'week' ? 'Le challenge de la semaine est lancé !' : `Le challenge du mois de ${monthName(end)} est lancé !`;
  return [
    `${emoji} **${title}**`,
    `${untilLabel(kind, end)}, chaque résultat posté dans ${channelMention(config.channels.results)} te rapporte 1 point.`,
    kind === 'week'
      ? 'Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement est mis à jour tous les soirs.'
      : "C'est le début du mois : participe à ce challenge pour obtenir tes résultats !",
    'Accompagnement et Free ont chacun leur classement.',
    '',
    prizeLine(kind, config, kind === 'week' ? 'Le meilleur Free de la semaine remporte' : 'Le meilleur Free du mois remporte'),
  ].join('\n');
}

// Point d'étape pendant le challenge (tous les soirs pour la semaine, régulièrement pour le mois).
export function standingsMessage({ kind, sections, daysLeft, end, config }) {
  const { emoji } = CHALLENGES[kind];
  const title = kind === 'week' ? 'Challenge de la semaine — classement du jour' : `Challenge du mois de ${monthName(end)} — point d'étape`;
  const remaining = daysLeft <= 1 ? 'Dernier jour' : `Plus que ${daysLeft} jours`;
  return [
    `${emoji} **${title}**`,
    `${remaining} avant la fin, ${endLabel(kind, end)}. Chaque résultat compte : rien n'est encore joué !`,
    ...sectionLines(sections, "_Personne pour l'instant. Sois le premier !_"),
    '',
    prizeLine(kind, config, kind === 'week' ? 'À la fin de la semaine, le meilleur Free remporte' : 'À la fin du mois, le meilleur Free remporte'),
  ].join('\n');
}

// Fin du challenge. Le premier Free gagne le rôle de la période et sa réduction ;
// le premier de l'accompagnement est félicité.
export function rankingMessage({ kind, title, congrats, sections, config }) {
  const { emoji } = CHALLENGES[kind];
  const lines = [`${emoji} **${title}**`, congrats, ...sectionLines(sections, '_Personne pour cette période._')];
  const winners = sections.filter((section) => section.entries.length > 0);
  if (winners.length > 0) lines.push('');
  for (const { category, entries } of winners) {
    const winner = mention(entries[0].userId);
    lines.push(
      category === 'free'
        ? prizeLine(kind, config, `${winner} remporte`)
        : `🏆 ${winner} remporte le classement ${CATEGORY_LABELS[category]} !`,
    );
  }
  return lines.join('\n');
}

// Chaque dimanche à 18 h, dans #top-all-time.
export function allTimeMessage({ sections }) {
  return [
    '👑 **Classement all-time**',
    'Les membres les plus réguliers depuis le lancement de PlugBot. Chaque résultat posté te fait monter !',
    ...sectionLines(sections, "_Personne pour l'instant._"),
    '',
    "Les membres en prison n'apparaissent pas dans ce classement.",
  ].join('\n');
}

export const RANKING_SIZES = { week: CHALLENGES.week.size, month: CHALLENGES.month.size, allTime: 10 };

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
