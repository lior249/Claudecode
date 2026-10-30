// Tous les textes publiés par PlugBot.

import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, PRISON_DAYS } from './stats.js';
import { EVENING_HOUR, EVENING_MINUTE, WEEK_MS, dayAndMonth, monthName } from './time.js';

export const MAX_LENGTH = 2000;
// Nombre maximum de mentions par message groupé, pour rester sous la limite de Discord.
const MENTIONS_PER_MESSAGE = 50;

export const CATEGORY_LABELS = { free: 'Free', plug: 'Accompagnement' };

// Ce que débloque chaque rôle de récompense.
export const REWARDS = {
  streak: '−15 % sur la formation',
  weekWinner: '−25 % sur la formation',
  monthWinner: "−35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement",
};

// Heure des publications et de la fin des challenges, telle qu'affichée aux membres : « 20 h 30 ».
const EVENING_TIME = `${EVENING_HOUR} h${EVENING_MINUTE ? ` ${String(EVENING_MINUTE).padStart(2, '0')}` : ''}`;
const EVENING = `${EVENING_TIME} (GMT)`;

// Les annonces des salons top et le récap du dimanche commencent par @everyone :
// tout le serveur est notifié.
const EVERYONE = '@everyone';

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

// Un texte suivi de la liste des membres concernés. Si la liste est trop longue,
// la suite part dans d'autres messages.
function withMentionList(header, userIds) {
  return inGroups(userIds).map((group, index) => {
    const mentions = group.map(mention).join(' ');
    return index === 0 ? `${header}\n${mentions}` : mentions;
  });
}

function totals({ total, week }) {
  return `🏅 Total : **${plural(total, 'point')}** · 📅 Semaine : **${plural(week, 'point')}**`;
}

// --- #show-up ---

// week, month, total : { points, rank }. Le rang est celui de la catégorie du membre (0 = hors classement).
// Le message finit par un encouragement, avec les salons des classements et le guide.
export function showupMessage({ userId, chain, category, prison, week, month, total, config, prisonExitChannelId }) {
  const { channels, links } = config;
  const ranking = (emoji, name, { points, rank }) =>
    `${emoji} Classement ${name} : **${plural(points, 'point')}** — ` +
    (rank ? `${ordinal(rank)} du classement ${CATEGORY_LABELS[category]}` : 'hors classement');
  const lines = [
    `🔥 ${mention(userId)} vient de show up !`,
    `⛓️ Chaîne : **${plural(chain, 'jour')} d'affilée**`,
    ranking('📅', 'semaine', week),
    ranking('🗓️', 'mois', month),
    ranking('🏅', 'total', total),
  ];
  if (prison.inPrison && prison.internal) {
    const exit = prisonExitChannelId ? channelMention(prisonExitChannelId) : 'le salon de sortie de la prison interne';
    lines.push(`🔒 Toujours en prison interne : pour en sortir, ouvre un ticket dans ${exit} et explique-toi.`);
  } else if (prison.inPrison && prison.daysToLeave > 0) {
    lines.push(
      `🔒 Toujours en prison : encore **${plural(prison.daysToLeave, 'jour')}** de show-up d'affilée pour sortir.`,
    );
  }
  lines.push(
    '',
    `🏆 Regarde les classements ${channelMention(channels.week)} et ${channelMention(channels.month)} pour savoir si tu es dans le top ${RANKING_SIZES.week} ou pas. ` +
      "Seuls les meilleurs gagneront des prix, alors n'abandonne pas !",
    `📖 Pour en savoir plus, regarde ${channelMention(links.guide)}.`,
  );
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

// Message au gagnant d'une récompense (reward : streak, weekWinner ou monthWinner).
// Il ne notifie que le gagnant et l'envoie vers son salon bonus, réservé au rôle gagné.
export function winnerMessage(reward, userId, config) {
  const challenges = {
    streak: `le challenge des ${config.streakRoleDays} jours d'affilée (🔥🔥🔥)`,
    weekWinner: 'le challenge de la semaine (top 7)',
    monthWinner: 'le challenge du mois (top 30)',
  };
  const bonusChannels = { streak: 'bonusStreak', weekWinner: 'bonusWeek', monthWinner: 'bonusMonth' };
  return [
    `🎉 Hourra ${mention(userId)} ! Tu viens de gagner ${challenges[reward]}.`,
    `Tu gagnes ${REWARDS[reward]}.`,
    `Retrouve tes bénéfices dans ${channelMention(config.links[bonusChannels[reward]])}.`,
  ].join('\n');
}

// Chaque dimanche soir, dans #show-up.
export function weeklyRecapMessage(config) {
  const { roles, links, streakRoleDays } = config;
  return [
    EVERYONE,
    '🏆 **Voici ce que tu gagnes en postant tes résultats sur la plateforme :**',
    '',
    `★ **Top 30** : le top 30 récapitule les ${CHALLENGES.month.size} meilleurs membres du serveur sur les 30 derniers jours. ` +
      `Termine 1er du classement Free et tu gagnes le rôle ${roleMention(roles.monthWinner)}, qui te débloque ${REWARDS.monthWinner}.`,
    '',
    `⚡ **Top 7** : le top 7 récapitule les ${CHALLENGES.week.size} meilleurs membres du serveur sur les 7 derniers jours. ` +
      `Termine 1er du classement Free et tu gagnes le rôle ${roleMention(roles.weekWinner)}, qui te débloque ${REWARDS.weekWinner}.`,
    '',
    `🔥 **${streakRoleDays} jours d'affilée** : poste un résultat tous les jours pendant ${streakRoleDays} jours d'affilée ` +
      `et tu gagnes le rôle ${roleMention(roles.streak)}, qui te débloque ${REWARDS.streak}.`,
    '',
    "⚠️ Attention : tous les membres inactifs qui ne passent pas à l'action vont intégrer la prison.",
    '',
    `Pour comprendre ces classements en détail, regarde ${channelMention(links.guide)}.`,
  ].join('\n');
}

// --- #la-prison ---

// Chaque jour à 18 h : les membres à 5 jours ou moins de la prison, chacun mentionné sous le nombre
// de jours qu'il lui reste. groups : [{ daysLeft, userIds }], du plus urgent au moins urgent.
export function prisonCountdownMessage(groups, config) {
  const lines = [
    '⚠️ **Alerte : tu vas bientôt aller en prison.**',
    "Ça fait trop longtemps que tu n'as posté aucun résultat montrant que tu es actif sur TikTok.",
    '(La prison te coupe tous les accès principaux du Discord : écrire dans les salons, rejoindre les lives, accéder aux réductions, etc.)',
    `Pour éviter que ça arrive, envoie juste un seul résultat dans ${channelMention(config.channels.results)}, le plus vite possible.`,
    `Pour comprendre exactement ce que signifie aller en prison, regarde ${channelMention(config.links.guide)}.`,
  ];
  for (const { daysLeft, userIds } of groups) {
    lines.push(
      '',
      daysLeft === 1
        ? "🚨 Il te reste **1 jour** avant d'aller en prison : c'est ton dernier jour, poste avant minuit (GMT) !"
        : `⏳ Il te reste **${plural(daysLeft, 'jour')}** avant d'aller en prison :`,
      ...inGroups(userIds).map((group) => group.map(mention).join(' ')),
    );
  }
  return lines.join('\n');
}

// exitChannelId : pour les membres du parcours de l'accompagnement, qui sortent par un ticket de justification.
function wayOutOfPrison(config, exitChannelId) {
  const how = exitChannelId
    ? `ouvre un ticket dans ${channelMention(exitChannelId)} et explique pourquoi tu n'as pas posté.`
    : `poste un résultat dans ${channelMention(config.channels.results)} pendant ${DAYS_TO_LEAVE_PRISON} jours d'affilée.`;
  return [
    `Voici comment en sortir : ${how}`,
    `Si tu veux plus de détails, va voir ${channelMention(config.links.guide)}.`,
  ].join('\n');
}

// Un message par groupe de membres qui entrent en prison le même jour après le même délai.
export function prisonEntryMessages(days, userIds, config, exitChannelId) {
  const header = [
    `🔒 **Tu viens de rejoindre la prison : ${days} jours sans show-up.**`,
    wayOutOfPrison(config, exitChannelId),
    '',
    'Voici ceux qui viennent de rejoindre la prison :',
  ].join('\n');
  return withMentionList(header, userIds);
}

export function prisonFinalMessages(userIds, config) {
  const header = [
    `🔒 **Définitivement en prison : ${FINAL_PRISON_DAYS} jours sans show-up.**`,
    wayOutOfPrison(config),
    '',
    'Voici ceux qui sont maintenant définitivement en prison :',
  ].join('\n');
  return withMentionList(header, userIds);
}

export function prisonExitMessage(userId) {
  return `🔓 ${mention(userId)} sort de prison après ${DAYS_TO_LEAVE_PRISON} jours de show-up d'affilée !`;
}

export function prisonReleaseMessage(userId) {
  return `🔓 ${mention(userId)} a été libéré de prison par l'équipe.`;
}

// --- #top-7, #top-30 et #top-all-time ---

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
  week: { emoji: '⚡', role: 'weekWinner', size: 10 },
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
  return `${emoji} ${prefix} ${roleMention(config.roles[role])} : ${REWARDS[role]} !`;
}

// « de novembre 2026 », mais « d'octobre 2026 » devant une voyelle.
function ofMonth(end) {
  const name = monthName(end);
  return /^[aeiou]/i.test(name) ? `d'${name}` : `de ${name}`;
}

function endLabel(kind, end) {
  return `${kind === 'week' ? 'dimanche' : 'le'} ${dayAndMonth(end)} à ${EVENING}`;
}

function periodLabel(kind, start, end) {
  return kind === 'week'
    ? `Depuis dimanche ${EVENING_TIME} et jusqu'à dimanche prochain ${EVENING}`
    : `Depuis le ${dayAndMonth(start)} à ${EVENING_TIME} et jusqu'au ${dayAndMonth(end)} à ${EVENING}`;
}

// Lundi (semaine) ou le 1er (mois), le soir : annonce du challenge standard, qui a démarré la veille au soir.
export function challengeLaunchMessage({ kind, start, end, config }) {
  const { emoji } = CHALLENGES[kind];
  const title = kind === 'week' ? 'Le challenge de la semaine est lancé !' : `Le challenge du mois ${ofMonth(end)} est lancé !`;
  return [
    EVERYONE,
    `${emoji} **${title}**`,
    `${periodLabel(kind, start, end)}, chaque résultat posté dans ${channelMention(config.channels.results)} te rapporte 1 point.`,
    kind === 'week'
      ? 'Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement en direct, en bas du salon, se met à jour à chaque résultat posté.'
      : "C'est le début du mois : participe à ce challenge pour obtenir tes résultats !",
    'Accompagnement et Free ont chacun leur classement.',
    '',
    prizeLine(kind, config, kind === 'week' ? 'Le meilleur Free de la semaine remporte' : 'Le meilleur Free du mois remporte'),
  ].join('\n');
}

// Les 10, 20 et 25 du mois : simple rappel, sans classement.
export function monthReminderMessage({ daysLeft, end, config }) {
  return [
    EVERYONE,
    `★ **Rappel : challenge du mois ${ofMonth(end)}**`,
    `Plus que ${daysLeft} jours avant la fin, ${endLabel('month', end)}.`,
    `Participe à ce challenge pour obtenir tes résultats : chaque résultat posté dans ${channelMention(config.channels.results)} te rapporte 1 point.`,
    '',
    prizeLine('month', config, 'À la fin du mois, le meilleur Free remporte'),
  ].join('\n');
}

// Fin du challenge. Le premier Free gagne le rôle de la période et sa réduction ;
// le premier de l'accompagnement est félicité.
export function rankingMessage({ kind, title, congrats, sections, config }) {
  const { emoji } = CHALLENGES[kind];
  const lines = [EVERYONE, `${emoji} **${title}**`, congrats, ...sectionLines(sections, '_Personne pour cette période._')];
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

// Du mardi au samedi à 20 h 30, dans #top-7, juste au-dessus du classement en direct.
// leaders : le premier de chaque catégorie cette semaine ({ category, userId }, l'accompagnement d'abord).
export function dailyRankingMessage({ leaders, config }) {
  const { channels } = config;
  const others = [`celui du mois dans ${channelMention(channels.month)}`];
  if (channels.allTime) others.push(`le classement all-time dans ${channelMention(channels.allTime)}`);
  const lines = [
    EVERYONE,
    '📊 **Venez consulter votre classement pour voir où vous vous trouvez !**',
    `👇 Le classement de la semaine est juste en dessous. Retrouvez aussi ${frenchList(others)}.`,
  ];
  if (leaders.length > 0) {
    const names = leaders.map(({ category, userId }) => `${mention(userId)} (${CATEGORY_LABELS[category]})`);
    lines.push('', `🥇 En tête cette semaine : ${frenchList(names)}. Bravo !`);
  }
  lines.push(
    '',
    `⚠️ Tous ceux qui n'ont rien posté : vous allez probablement aller en prison d'ici ${PRISON_DAYS.free} jours ` +
      `(${PRISON_DAYS.plug} jours pour l'accompagnement). Commencez à poster vos résultats dans ${channelMention(channels.results)} !`,
  );
  return lines.join('\n');
}

const MEDALS = ['🥇', '🥈', '🥉'];
const BOARD_COLORS = { week: 0xf1c40f, month: 0x9b59b6, allTime: 0xe67e22 };

function boardLines(entries) {
  if (entries.length === 0) return "_Personne pour l'instant. Sois le premier !_";
  return entries
    .map((entry, index) => `${MEDALS[index] ?? `${index + 1}.`} ${mention(entry.userId)} — ${plural(entry.score, 'point')}`)
    .join('\n');
}

// Le classement en direct d'un salon top (kind : week, month ou allTime), sous forme d'encadré.
// Le même message est modifié à chaque changement : les membres cités ne sont jamais notifiés.
// trial : le challenge a commencé avant l'arrivée de PlugBot, il ne donne pas de récompense.
export function boardEmbed({ kind, sections, range, trial, config }) {
  const live = `Mis à jour en direct, à chaque résultat posté dans ${channelMention(config.channels.results)}.`;
  let title;
  let description;
  if (kind === 'allTime') {
    title = '👑 Top all-time';
    description = ['Les membres les plus réguliers depuis le lancement de PlugBot.', live];
  } else {
    const { emoji } = CHALLENGES[kind];
    title = kind === 'week' ? `${emoji} Top 7 — challenge de la semaine` : `${emoji} Top 30 — challenge du mois ${ofMonth(range.end)}`;
    // <t:…:R> : Discord affiche le temps restant (« dans 3 jours ») et le tient à jour tout seul.
    description = [live, `⏳ Fin : ${endLabel(kind, range.end)}, <t:${Math.floor(range.end / 1000)}:R>.`, ''];
    description.push(
      trial
        ? `🧪 PlugBot est arrivé en cours de ${kind === 'week' ? 'semaine' : 'mois'} : ce classement est un essai et ne donne pas de récompense. Le premier vrai challenge commence à la fin de celui-ci.`
        : prizeLine(kind, config, kind === 'week' ? 'Le meilleur Free de la semaine remporte' : 'Le meilleur Free du mois remporte'),
    );
  }
  return {
    color: BOARD_COLORS[kind],
    title,
    description: description.join('\n'),
    fields: sections.map(({ category, entries }) => ({ name: CATEGORY_LABELS[category], value: boardLines(entries) })),
    footer: { text: "Les membres en prison n'apparaissent pas dans les classements." },
  };
}

// Nombre de membres affichés dans chaque catégorie de chaque classement.
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
