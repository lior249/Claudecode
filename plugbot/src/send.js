import { splitMessage } from './messages.js';

async function sendParts(channel, content, allowedMentions) {
  for (const part of splitMessage(content)) {
    await channel.send({ content: part, allowedMentions });
  }
}

// Envoie un texte en le découpant si besoin. Sans liste, tous les membres mentionnés sont notifiés.
// Les rôles mentionnés ne sont jamais notifiés.
export async function send(channel, content, notifiedUserIds) {
  await sendParts(channel, content, notifiedUserIds ? { users: notifiedUserIds } : { parse: ['users'] });
}

// Annonce des salons top : le @everyone du texte notifie tout le serveur.
export async function announce(channel, content) {
  await sendParts(channel, content, { parse: ['everyone', 'users'] });
}
