// Aperçu : publie un exemple de chaque message de PlugBot dans un salon de test, sans notifier personne.
// Utilisation : npm run apercu -- <identifiant du salon de test>

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

async function main() {
  const channelId = process.argv[2];
  if (!/^\d+$/.test(channelId ?? '')) {
    console.error("Indique l'identifiant du salon de test : npm run apercu -- 123456789012345678");
    process.exit(1);
  }
  const config = loadConfig();
  const rest = new REST().setToken(config.token);
  const examples = previewMessages(config);
  for (const [where, content] of examples) {
    for (const part of splitMessage(`🧪 **Aperçu — ${where}**\n${content}`)) {
      // Aucune mention ne notifie personne, @everyone compris.
      await rest.post(Routes.channelMessages(channelId), { body: { content: part, allowed_mentions: { parse: [] } } });
    }
  }
  console.log(`[PlugBot] Aperçu envoyé : ${examples.length} messages.`);
}

// Lancé avec « npm run apercu » (et non importé, par exemple par les tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("[PlugBot] Impossible d'envoyer l'aperçu :", error.message);
    process.exit(1);
  });
}
