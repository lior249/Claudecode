// Aperçu : publie un exemple de chaque message de PlugBot dans un salon de test, sans notifier personne.
// Utilisation : npm run apercu -- <identifiant du salon de test>
// Pour effacer cet aperçu : npm run effacer-apercu -- <identifiant du salon>

import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import {
  allTimeMessage,
  challengeLaunchMessage,
  congratulations,
  monthReminderMessage,
  prisonEntryMessages,
  prisonExitMessage,
  prisonFinalMessages,
  prisonWarningMessages,
  rankingMessage,
  removedMessage,
  showupMessage,
  splitMessage,
  standingsMessage,
  weeklyRecapMessage,
  winnerMessage,
} from './messages.js';
import { PRISON_DAYS } from './stats.js';
import { monthName, monthRange, weekRange } from './time.js';

// Chaque message d'aperçu commence par ce texte : c'est ainsi qu'on les retrouve pour les effacer.
export const PREVIEW_PREFIX = '🧪 **Aperçu — ';

// Seuls les messages d'aperçu publiés par PlugBot lui-même peuvent être effacés.
export function isPreviewMessage(message, botId) {
  return message.author?.id === botId && message.content.startsWith(PREVIEW_PREFIX);
}

// Chaque exemple : [où et quand il est publié, texte]. Les membres d'exemple sont tous l'admin.
export function previewMessages(config, now = Date.now()) {
  const me = [...config.adminIds][0];
  const week = weekRange(now);
  const month = monthRange(now);
  const sections = [
    { category: 'plug', entries: [{ userId: me, score: 9 }] },
    { category: 'free', entries: [{ userId: me, score: 12 }, { userId: me, score: 7 }] },
  ];
  return [
    [
      'show-up — à chaque résultat posté',
      showupMessage({
        userId: me,
        chain: 12,
        category: 'free',
        prison: { inPrison: false },
        week: { points: 9, rank: 3 },
        month: { points: 31, rank: 44 },
        total: { points: 148, rank: 449 },
      }),
    ],
    ['show-up — quand tu mets ❌ sur un résultat', removedMessage({ userId: me, adminId: me, total: 147, week: 8 })],
    ["show-up — 21 jours d'affilée", winnerMessage('streak', me, config)],
    ['show-up — récap du dimanche soir', weeklyRecapMessage(config)],
    ['top-7 — lancement, le lundi soir', challengeLaunchMessage({ kind: 'week', ...week, config })],
    [
      'top-7 — classement du jour, du mardi au samedi',
      standingsMessage({ kind: 'week', sections, daysLeft: 4, end: week.end, config }),
    ],
    [
      'top-7 — clôture, le dimanche soir',
      rankingMessage({ kind: 'week', title: 'Classement de la semaine', congrats: congratulations(week.start), sections, config }),
    ],
    ['top-7 — gagnant Free, 3 minutes après la clôture', winnerMessage('weekWinner', me, config)],
    ['top-30 — lancement, le 1er du mois', challengeLaunchMessage({ kind: 'month', ...month, config })],
    [
      'top-30 — classement provisoire, le dimanche',
      standingsMessage({ kind: 'month', sections, daysLeft: 15, end: month.end, config }),
    ],
    ['top-30 — rappel, les 10, 20 et 25', monthReminderMessage({ daysLeft: 20, end: month.end, config })],
    [
      'top-30 — clôture, le dernier jour du mois',
      rankingMessage({
        kind: 'month',
        title: `Classement du mois — ${monthName(month.end)}`,
        congrats: congratulations(month.start),
        sections,
        config,
      }),
    ],
    ['top-30 — gagnant Free, 3 minutes après la clôture', winnerMessage('monthWinner', me, config)],
    ['top-all-time — le dimanche soir', allTimeMessage({ sections })],
    ['la-prison — alerte, 5 jours avant', prisonWarningMessages([me], config)[0]],
    ['la-prison — entrée en prison (Free)', prisonEntryMessages(PRISON_DAYS.free, [me], config)[0]],
    ['la-prison — 30 jours sans show-up', prisonFinalMessages([me], config)[0]],
    ['la-prison — sortie après 3 jours de posts', prisonExitMessage(me)],
  ];
}

async function sendPreview(rest, config, channelId) {
  const examples = previewMessages(config);
  for (const [where, content] of examples) {
    for (const part of splitMessage(`${PREVIEW_PREFIX}${where}**\n${content}`)) {
      // Aucune mention ne notifie personne, @everyone compris.
      await rest.post(Routes.channelMessages(channelId), { body: { content: part, allowed_mentions: { parse: [] } } });
    }
  }
  console.log(`[PlugBot] Aperçu envoyé : ${examples.length} messages.`);
}

// Efface les messages d'aperçu parmi les 100 derniers messages du salon.
async function erasePreview(rest, channelId) {
  const bot = await rest.get(Routes.user());
  const messages = await rest.get(Routes.channelMessages(channelId), { query: new URLSearchParams({ limit: '100' }) });
  const previews = messages.filter((message) => isPreviewMessage(message, bot.id));
  for (const message of previews) await rest.delete(Routes.channelMessage(channelId, message.id));
  console.log(`[PlugBot] Aperçu effacé : ${previews.length} messages supprimés.`);
}

async function main() {
  const args = process.argv.slice(2);
  const erase = args.includes('--effacer');
  const channelId = args.find((arg) => /^\d+$/.test(arg));
  if (!channelId) {
    const command = erase ? 'effacer-apercu' : 'apercu';
    console.error(`Indique l'identifiant du salon : npm run ${command} -- 123456789012345678`);
    process.exit(1);
  }
  const config = loadConfig();
  const rest = new REST().setToken(config.token);
  if (erase) await erasePreview(rest, channelId);
  else await sendPreview(rest, config, channelId);
}

// Lancé avec « npm run apercu » (et non importé, par exemple par les tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[PlugBot] L'aperçu n'a pas pu être envoyé ou effacé :", error.message);
    process.exit(1);
  });
}
