// Aperçu : publie l'annonce du prochain live dans un salon de test, sans notifier personne.
// Le sondage d'aperçu dure 1 heure.
// Utilisation : npm run apercu -- <identifiant du salon de test>

import { REST, Routes } from 'discord.js';
import { loadConfig } from './config.js';
import { announcement } from './message.js';
import { nextLive } from './schedule.js';

const channelId = process.argv[2];
if (!/^\d+$/.test(channelId ?? '')) {
  console.error("Indique l'identifiant du salon de test : npm run apercu -- 123456789012345678");
  process.exit(1);
}

const config = loadConfig();
const now = Date.now();
const { content, poll } = announcement({ liveAt: nextLive(now), now, roleId: config.roleId });
const body = {
  content: `🧪 **Aperçu de l'annonce du prochain live**\n${content}`,
  poll: {
    question: { text: poll.question },
    answers: poll.answers.map(({ text, emoji }) => ({ poll_media: { text, emoji: { name: emoji } } })),
    duration: 1,
    allow_multiselect: false,
  },
  allowed_mentions: { parse: [] },
};

try {
  await new REST().setToken(config.token).post(Routes.channelMessages(channelId), { body });
  console.log('[LiveBot] Aperçu envoyé.');
} catch (error) {
  console.error("[LiveBot] L'aperçu n'a pas pu être envoyé :", error.message);
  process.exit(1);
}
