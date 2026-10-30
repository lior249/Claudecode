// Tous les textes du parcours de l'accompagnement.

import {
  AVAILABILITY,
  CTA_METHODS,
  ENGAGEMENT,
  EQUIPMENT,
  JOURNEY_DAYS,
  LEVELS,
  MIN_POST_DAYS,
  MORNING_HOUR,
  STAGES,
  TARGET_COUNTRIES,
  WEEKDAYS,
  labelOf,
  stageOf,
} from './catalog.js';
import { countryLabel, hourLabel } from './clock.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Nombre maximum de mentions par ligne, pour rester sous la limite de Discord.
const MENTIONS_PER_LINE = 50;

const mention = (userId) => `<@${userId}>`;
const channel = (channelId) => `<#${channelId}>`;
const seconds = (timestamp) => Math.floor(timestamp / 1000);
// Discord affiche ces dates dans l'heure locale de chacun : « 5 novembre 2026 à 22:00 », « dans 3 jours ».
export const when = (timestamp) => `<t:${seconds(timestamp)}:f>`;
export const fromNow = (timestamp) => `<t:${seconds(timestamp)}:R>`;
const onDay = (timestamp) => `<t:${seconds(timestamp)}:D>`;

function stageName(number) {
  const { emoji, label } = stageOf(number);
  return `${emoji} ${label}`;
}

function mentionLines(userIds) {
  const lines = [];
  for (let i = 0; i < userIds.length; i += MENTIONS_PER_LINE) lines.push(userIds.slice(i, i + MENTIONS_PER_LINE).map(mention).join(' '));
  return lines;
}

export function deadlineOf(record) {
  return record.deadlineFrom + JOURNEY_DAYS * DAY_MS;
}

// --- #parcours ---

export function panelText() {
  return [
    "🧭 **Ton parcours dans l'accompagnement**",
    "4 étapes, à passer dans l'ordre. Clique sur une étape pour ouvrir ton ticket : seuls toi et ton coach le voyez.",
    '',
    '🎬 **Visionnage** : regarde toute la formation et remplis ta fiche.',
    '🧭 **Positionnement** : choisis ta niche, ton pays cible et ta méthode CTA.',
    '🎥 **Confirmation** : fais valider la qualité de tes vidéos avant de poster.',
    '🚀 **Engagement** : poste tes vidéos, les jours que tu as choisis.',
    '',
    `⏳ Tu as **${JOURNEY_DAYS} jours** pour arriver à l'étape Engagement. Sinon, c'est la prison interne.`,
  ].join('\n');
}

// Réponse (visible par le membre seul) quand il clique sur une étape.
export function stageLockedText(current) {
  return `🔒 Termine d'abord l'étape **${stageName(current)}**.`;
}

export function stageDoneText(number, ticket) {
  const link = ticket ? ` Ton ticket : ${channel(ticket.threadId)}` : '';
  return `✅ L'étape **${stageName(number)}** est déjà validée.${link}`;
}

export function ticketOpenedText(threadId) {
  return `🎫 Ton ticket est ici : ${channel(threadId)}`;
}

// Premier message de chaque ticket d'étape.
export function stageIntro(number, { userId, deadline }) {
  const late = `⏳ Tu dois arriver à l'étape Engagement avant le ${when(deadline)} (${fromNow(deadline)}).`;
  switch (number) {
    case 1:
      return [
        `${mention(userId)} 🎬 **Étape 1 : Visionnage**`,
        '1. Remplis ta fiche : clique sur **📝 Remplir ma fiche** (ton nom complet, ton pays, ton niveau, ton matériel et ta disponibilité).',
        '2. Regarde **toute** la formation sur Whop.',
        "3. Envoie ici une capture d'écran qui montre que tu as terminé toute la formation.",
        '',
        'Ton coach vérifie et valide ton étape.',
        late,
      ].join('\n');
    case 2:
      return [
        `${mention(userId)} 🧭 **Étape 2 : Positionnement**`,
        'Explique ici tes choix, avec ce que tu as appris dans la formation :',
        '• ta **niche** et son type ;',
        `• ton **pays cible**, un seul : ${TARGET_COUNTRIES.map(([, label]) => label).join(', ')} ;`,
        `• ta **méthode CTA** : ${CTA_METHODS.map(([, label]) => label).join(', ')}.`,
        '',
        'Ton coach en discute avec toi, puis valide tes choix.',
        late,
      ].join('\n');
    case 3:
      return [
        `${mention(userId)} 🎥 **Étape 3 : Confirmation**`,
        'Prépare tes vidéos **sans les publier**, et envoie-les ici (des vidéos légères).',
        "Ton coach les corrige. Continue jusqu'à ce qu'il valide la qualité : ensuite, tu pourras poster.",
        late,
      ].join('\n');
    default:
      return [
        `${mention(userId)} 🚀 **Étape 4 : Engagement**`,
        'Maintenant, on produit du volume : la qualité est validée.',
        `Clique sur **🗓️ Choisir mes jours et mes heures** : au moins ${MIN_POST_DAYS} jours de post par semaine, et 2 heures de vérification dans ta journée (dans ton heure locale).`,
        '',
        `Chaque jour de post, tu reçois ici un message à ${hourLabel(MORNING_HOUR)}, puis une vérification à chacune de tes heures.`,
        "Un seul post dans #flex-resultats avant l'une des deux suffit pour valider ta journée.",
      ].join('\n');
  }
}

export function profileSavedText() {
  return '✅ Ta fiche est enregistrée. Tu peux la modifier à tout moment avec le même bouton.';
}

// --- La validation d'une étape ---

export function closeQuestion({ userId, stage, missing }) {
  const lines = [`Clôturer l'étape **${stageName(stage)}** de ${mention(userId)} ?`];
  if (missing.length > 0) lines.push(`⚠️ Sa fiche est incomplète : il manque ${missing.join(', ')}.`);
  return lines.join('\n');
}

export function stageClosedText({ userId, stage, parcoursChannelId }) {
  const next = stageOf(stage + 1);
  return [
    `${mention(userId)} ✅ **Bravo, l'étape ${stageName(stage)} est validée !**`,
    `L'étape suivante est débloquée : clique sur **${next.emoji} ${next.label}** dans ${channel(parcoursChannelId)}.`,
  ].join('\n');
}

export function missingProfile(record) {
  const missing = [];
  if (!record.fullName) missing.push('son nom complet');
  if (!record.homeCountry) missing.push('son pays');
  if (!record.level) missing.push('son niveau');
  if (!record.equipment) missing.push('son matériel');
  if (!record.availability) missing.push('sa disponibilité');
  return missing;
}

// --- L'Engagement ---

export function planningText(record) {
  const days = WEEKDAYS.filter(([day]) => record.postDays.includes(day)).map(([, label]) => label.toLowerCase());
  return `${days.join(', ')} · vérifications à ${hourLabel(record.check1)} et ${hourLabel(record.check2)} (${countryLabel(record.homeCountry)})`;
}

export function planningSavedText(record) {
  return [
    `🗓️ **Ton planning est enregistré :** ${planningText(record)}.`,
    'Les rappels commencent demain. Tu peux le modifier à tout moment avec le même bouton.',
  ].join('\n');
}

export function morningText({ userId, record }) {
  return [
    `${mention(userId)} 🚀 **Aujourd'hui, tu postes !**`,
    `Vérifications à ${hourLabel(record.check1)} et à ${hourLabel(record.check2)}. Un seul post dans #flex-resultats avant l'une des deux suffit pour valider ta journée.`,
  ].join('\n');
}

export function postedText(userId) {
  return `${mention(userId)} ✅ **Post reçu, ta journée est validée !** Continue comme ça 🔥`;
}

export function firstCheckMissedText({ userId, record }) {
  return `${mention(userId)} ⏰ **Première vérification : pas encore de post aujourd'hui.** Prochaine vérification à ${hourLabel(record.check2)}.`;
}

export function secondCheckMissedText(userId) {
  return `${mention(userId)} ❌ **Pas de post à la 2ᵉ vérification.** Tu peux encore poster aujourd'hui, mais ce sera noté « en retard ».`;
}

// Le récap de la journée, à minuit GMT. rows : [{ userId, status }] ; status : first, second, late, missed, rest, prison.
export function dailyRecap({ day, rows }) {
  const groups = [
    ['first', '✅ **Avant la 1ʳᵉ vérification**'],
    ['second', '✅ **Avant la 2ᵉ vérification**'],
    ['late', '🕒 **En retard** (après la 2ᵉ vérification)'],
    ['missed', "❌ **N'ont pas posté**"],
    ['rest', '😴 **Jour de repos**'],
    ['prison', '🔒 **En prison**'],
  ];
  const lines = [`📊 **Engagement — récap du ${day.split('-').reverse().join('/')}**`];
  for (const [status, title] of groups) {
    const userIds = rows.filter((row) => row.status === status).map((row) => row.userId);
    if (userIds.length > 0) lines.push('', `${title} (${userIds.length})`, ...mentionLines(userIds));
  }
  return lines.join('\n');
}

// Le bilan de la semaine, le lundi à minuit GMT. rows : [{ userId, kept, planned }].
export function weeklyRecap(rows) {
  const lines = ['📅 **Engagement — bilan de la semaine** (jours tenus sur jours prévus)'];
  for (const { userId, kept, planned } of [...rows].sort((a, b) => b.kept / (b.planned || 1) - a.kept / (a.planned || 1))) {
    lines.push(`${kept === planned ? '✅' : kept === 0 ? '❌' : '🟠'} ${mention(userId)} — ${kept}/${planned}`);
  }
  return lines.join('\n');
}

// --- Notifications au coach ---

export function proofNotice({ userId, stage, threadId }) {
  return `📥 ${mention(userId)} a envoyé une preuve — ${stageName(stage)} → ${channel(threadId)}`;
}

export function planningChangedNotice({ userId, record }) {
  return `🗓️ ${mention(userId)} a choisi son planning d'Engagement : ${planningText(record)}.`;
}

export function exitTicketNotice({ userId, threadId }) {
  return `🔓 ${mention(userId)} a ouvert un ticket pour sortir de la prison interne → ${channel(threadId)}`;
}

export function internalPrisonNotice(userIds, reason) {
  return [`🔒 **Prison interne** — ${reason}`, ...mentionLines(userIds)].join('\n');
}

// Tous les 3 jours. prisoners : [{ userId, ticketId }] ; soon : [{ userId, stage, deadline }].
export function digestText({ prisoners, soon }) {
  const lines = ['📋 **Le point tous les 3 jours**'];
  if (prisoners.length > 0) {
    lines.push('', `🔒 **En prison interne** (${prisoners.length})`);
    for (const { userId, ticketId } of prisoners) lines.push(`• ${mention(userId)}${ticketId ? ` — ticket : ${channel(ticketId)}` : ' — pas encore de ticket'}`);
  }
  if (soon.length > 0) {
    lines.push('', `⏳ **Délai bientôt dépassé** (${soon.length})`);
    for (const { userId, stage, deadline } of soon) lines.push(`• ${mention(userId)} — ${stageName(stage)}, délai ${fromNow(deadline)}`);
  }
  if (prisoners.length === 0 && soon.length === 0) lines.push('', 'Rien à signaler : personne en prison interne ni en retard. 👌');
  return lines.join('\n');
}

// --- La prison interne ---

// Mur des retardataires (#prison-interne), visible par tout l'accompagnement.
// reason : deadline (pas arrivé à l'Engagement à temps) ou noPosts (`days` jours sans show-up).
export function wallText(reason, userIds, exitChannelId, days) {
  const titles = {
    deadline: `🔒 **Tu n'as toujours pas atteint l'étape Engagement après ${JOURNEY_DAYS} jours dans l'accompagnement.**`,
    noPosts: `🔒 **Tu n'as rien posté depuis ${days} jours.**`,
  };
  return [
    titles[reason],
    `Peux-tu nous expliquer pourquoi ? Ouvre un ticket dans ${channel(exitChannelId)} pour retrouver l'accès à l'accompagnement.`,
    '',
    ...mentionLines(userIds),
  ].join('\n');
}

// Dans la-prison, comme pour toutes les entrées en prison.
export function deadlinePrisonText(userIds, exitChannelId) {
  return [
    `🔒 **Tu viens de rejoindre la prison : tu n'as pas atteint l'étape Engagement de l'accompagnement en ${JOURNEY_DAYS} jours.**`,
    `Voici comment en sortir : ouvre un ticket dans ${channel(exitChannelId)} et explique pourquoi.`,
    '',
    'Voici ceux qui viennent de rejoindre la prison :',
    ...mentionLines(userIds),
  ].join('\n');
}

export function exitPanelText() {
  return [
    '🔓 **Sortir de la prison interne**',
    "Tu es en prison parce que tu n'as pas avancé dans ton parcours, ou pas posté depuis trop longtemps.",
    'Clique sur le bouton pour ouvrir un ticket et expliquer pourquoi. Ton coach te répond et décide de ta sortie.',
  ].join('\n');
}

export function exitTicketIntro(userId) {
  return [
    `${mention(userId)} 🔓 **Ton ticket de sortie**`,
    "Explique ici pourquoi tu n'as pas avancé (ou pas posté). Sois honnête : ton coach lit tout et décide de ta sortie.",
  ].join('\n');
}

export function releasedText(userId) {
  return `🔓 ${mention(userId)} est libéré par son coach. Bon retour dans l'accompagnement ! Le délai repart de zéro aujourd'hui.`;
}

// --- La fiche membre ---

const COLORS = [0x95a5a6, 0x3498db, 0x9b59b6, 0xe67e22, 0x2ecc71];

function profileField(record) {
  if (!record.homeCountry && !record.level && !record.equipment && !record.availability) return '_Pas encore remplie._';
  return [
    `Pays : ${record.homeCountry ? countryLabel(record.homeCountry) : '—'}`,
    `Niveau : ${record.level ? labelOf(LEVELS, record.level) : '—'}`,
    `Matériel : ${record.equipment ? labelOf(EQUIPMENT, record.equipment) : '—'}`,
    `Disponibilité : ${record.availability ? labelOf(AVAILABILITY, record.availability) : '—'}`,
  ].join('\n');
}

function stageState(record, number) {
  if (record.stage > number) return '✅';
  if (record.stage === number) return '⏳ en cours';
  return '🔒 pas encore';
}

// Une fiche par membre, dans #fiches-membres. tickets : [{ kind, threadId }].
export function ficheEmbed(record, { displayName, inPrison, proofUrl, tickets }) {
  const name = record.fullName || displayName || 'Membre';
  const status =
    record.status === 'left'
      ? "🚪 N'a plus le rôle TikTok"
      : inPrison
        ? '🔒 En prison'
        : record.stage < ENGAGEMENT
          ? `⏳ Doit arriver à l'Engagement avant le ${when(deadlineOf(record))}`
          : "🚀 À l'étape Engagement";
  const fields = [{ name: '👤 Profil', value: profileField(record) }];

  const watched = record.watchedAt
    ? `✅ Validé le ${onDay(record.watchedAt)}, en ${record.watchedDays} jour${record.watchedDays > 1 ? 's' : ''}${proofUrl ? ` · [preuve](${proofUrl})` : ''}`
    : stageState(record, 1);
  fields.push({ name: '🎬 Visionnage', value: watched });

  fields.push({
    name: '🧭 Positionnement',
    value: record.positionedAt
      ? [
          `Niche : ${record.niche}`,
          `Type de niche : ${record.nicheType}`,
          `Pays cible : ${labelOf(TARGET_COUNTRIES, record.targetCountry)}`,
          `Méthode CTA : ${labelOf(CTA_METHODS, record.ctaMethod)}`,
        ].join('\n')
      : stageState(record, 2),
  });

  const confirmation = record.confirmedAt ? `✅ Validée le ${onDay(record.confirmedAt)}` : stageState(record, 3);
  fields.push({
    name: '🎥 Confirmation',
    value: [`${confirmation} · ${record.videos} envoi${record.videos > 1 ? 's' : ''} de vidéos`, record.confirmationNote ? `Note : ${record.confirmationNote}` : null]
      .filter(Boolean)
      .join('\n'),
  });

  fields.push({
    name: '🚀 Engagement',
    value: record.engagementAt
      ? `Depuis le ${onDay(record.engagementAt)}${record.postDays.length ? `\n${planningText(record)}` : '\nPlanning pas encore choisi.'}`
      : stageState(record, ENGAGEMENT),
  });

  fields.push({ name: '🔒 Prison', value: record.prisonCount ? `${record.prisonCount} passage${record.prisonCount > 1 ? 's' : ''}` : 'Jamais' });
  if (tickets.length > 0) {
    const label = (kind) => STAGES.find((stage) => stage.key === kind)?.label ?? 'Sortie de prison';
    fields.push({ name: '🎫 Tickets', value: tickets.map(({ kind, threadId }) => `${label(kind)} : ${channel(threadId)}`).join('\n').slice(0, 1024) });
  }

  return {
    color: COLORS[record.stage] ?? COLORS[0],
    title: `🗂️ ${name}`.slice(0, 256),
    description: [
      mention(record.userId),
      `Arrivé le ${onDay(record.joinedAt)}`,
      `Étape : **${stageName(record.stage)}** (depuis le ${onDay(record.stageSince)})`,
      status,
    ].join('\n'),
    fields,
  };
}

// --- Le filtre ---

export function filterPanelText() {
  return [
    '🔎 **Filtrer les membres**',
    'Choisis un critère, puis une valeur : PlugBot te montre les membres concernés (visible par toi seul).',
    'Chaque fiche ci-dessous est mise à jour automatiquement.',
  ].join('\n');
}

export function filterResultText({ title, members, guildId, fichesChannelId }) {
  if (members.length === 0) return `🔎 **${title}** : aucun membre.`;
  const lines = [`🔎 **${title}** : ${members.length} membre${members.length > 1 ? 's' : ''}`];
  for (const record of members) {
    const fiche = record.ficheMessageId ? ` · [fiche](https://discord.com/channels/${guildId}/${fichesChannelId}/${record.ficheMessageId})` : '';
    const line = `• ${mention(record.userId)}${record.fullName ? ` (${record.fullName})` : ''} — ${stageName(record.stage)}${fiche}`;
    if ([...lines, line].join('\n').length > 1900) {
      lines.push(`… et ${members.length - lines.length + 1} autres.`);
      break;
    }
    lines.push(line);
  }
  return lines.join('\n');
}
