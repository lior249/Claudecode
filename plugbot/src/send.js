import { splitMessage } from './messages.js';

// Envoie un texte en le découpant si besoin. Sans liste, tous les membres mentionnés sont notifiés.
// Les rôles mentionnés ne sont jamais notifiés.
export async function send(channel, content, notifiedUserIds) {
  const allowedMentions = notifiedUserIds ? { users: notifiedUserIds } : { parse: ['users'] };
  for (const part of splitMessage(content)) {
    await channel.send({ content: part, allowedMentions });
  }
}
