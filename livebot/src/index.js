// Point d'entrée de LiveBot : annonce les lives de l'accompagnement avec un sondage de présence.

import { Client, Events, GatewayIntentBits } from 'discord.js';
import { STATE_FILE, loadConfig } from './config.js';
import { acquireLock } from './lock.js';
import { announcement } from './message.js';
import { dueAnnouncement } from './schedule.js';
import { readLastAnnouncedDay, writeLastAnnouncedDay } from './state.js';

const TICK_MS = 60 * 1000;
const PERMISSION_LABELS = {
  ViewChannel: 'Voir le salon',
  SendMessages: 'Envoyer des messages',
  SendPolls: 'Créer des sondages',
  MentionEveryone: 'Mentionner @everyone, @here et tous les rôles',
};

const config = loadConfig();

if (!(await acquireLock())) {
  console.error('[LiveBot] Un autre LiveBot tourne déjà : celui-ci s’arrête pour ne pas annoncer deux fois. Tape « pm2 list » pour voir les bots lancés.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function checkPermissions(channel, me) {
  const needs = ['ViewChannel', 'SendMessages', 'SendPolls'];
  const role = config.roleId ? channel.guild.roles.cache.get(config.roleId) : null;
  if (config.roleId && !role) console.error(`[LiveBot] Rôle introuvable : ${config.roleId}.`);
  // Un rôle non mentionnable ne peut être notifié qu'avec la permission @everyone.
  if (role && !role.mentionable) needs.push('MentionEveryone');
  const missing = channel.permissionsFor(me).missing(needs);
  if (missing.length > 0) {
    console.error(`[LiveBot] Permissions à corriger dans #${channel.name} : ${missing.map((perm) => PERMISSION_LABELS[perm]).join(', ')}.`);
  } else {
    console.log('[LiveBot] Permissions OK.');
  }
}

async function tick(channel) {
  const now = Date.now();
  const due = dueAnnouncement(now, readLastAnnouncedDay(STATE_FILE));
  if (!due) return;
  // Le jour est noté avant l'envoi : en cas d'erreur, rien n'est publié deux fois.
  writeLastAnnouncedDay(STATE_FILE, due.day);
  const { content, poll } = announcement({ liveAt: due.liveAt, now, roleId: config.roleId });
  try {
    await channel.send({
      content,
      poll: {
        question: { text: poll.question },
        answers: poll.answers,
        duration: poll.durationHours,
        allowMultiselect: false,
      },
      allowedMentions: { roles: config.roleId ? [config.roleId] : [] },
    });
    console.log('[LiveBot] Live annoncé.');
  } catch (error) {
    console.error("[LiveBot] L'annonce n'a pas pu être envoyée :", error.message);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  const channel = await readyClient.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.guild) {
    console.error(`[LiveBot] Salon introuvable : ${config.channelId}. Vérifie CHANNEL_ID et que le bot voit ce salon.`);
    process.exit(1);
  }
  checkPermissions(channel, await channel.guild.members.fetchMe());
  await tick(channel);
  setInterval(() => tick(channel), TICK_MS);
  console.log(`[LiveBot] Connecté en tant que ${readyClient.user.tag}.`);
});

process.on('unhandledRejection', (error) => console.error('[LiveBot] Erreur non gérée :', error));

await client.login(config.token);
