// Classements en direct : un seul message par salon top (top-7, top-30, top-all-time), modifié à
// chaque changement. Il reste toujours en bas de son salon : quand PlugBot y publie autre chose
// (lancement, annonce du soir, clôture), le classement est republié juste en dessous.

import { RANKING_SIZES, boardEmbed } from './messages.js';
import { ALL_TIME, DAY_MS, monthRange, weekRange } from './time.js';

export const BOARD_KINDS = ['week', 'month', 'allTime'];
// Code d'erreur de Discord quand le message n'existe plus (supprimé à la main, par exemple).
const UNKNOWN_MESSAGE = 10008;

function rangeOf(kind, now) {
  if (kind === 'week') return weekRange(now);
  if (kind === 'month') return monthRange(now);
  return ALL_TIME;
}

// Vrai si le message `id` a été publié après le message `than`.
function postedAfter(id, than) {
  return id != null && BigInt(id) > BigInt(than);
}

export function createBoards({ config, db, tracker, guild, channels }) {
  // Pour chaque classement : son message et le contenu affiché, pour ne le modifier que s'il change.
  const shown = new Map();

  async function findMessage(kind, channel) {
    if (shown.has(kind)) return shown.get(kind).message;
    const id = db.getMeta(`board_message_${kind}`);
    return id ? channel.messages.fetch(id).catch(() => null) : null;
  }

  async function publish(kind, now) {
    const channel = channels[kind];
    if (!channel) return;
    const range = rangeOf(kind, now);
    const embed = boardEmbed({
      kind,
      sections: tracker.rankings(guild.members.cache, now, range, RANKING_SIZES[kind]),
      range,
      trial: kind !== 'allTime' && range.start < Number(db.getMeta('launch_day')) * DAY_MS,
      config,
    });
    const content = JSON.stringify(embed);

    let message = await findMessage(kind, channel);
    if (message && postedAfter(channel.lastMessageId, message.id)) {
      await message.delete().catch(() => {});
      message = null;
    }
    if (message && shown.get(kind)?.content === content) return;

    const payload = { embeds: [{ ...embed, timestamp: new Date(now).toISOString() }], allowedMentions: { parse: [] } };
    if (message) {
      try {
        await message.edit(payload);
        shown.set(kind, { message, content });
        return;
      } catch (error) {
        if (error.code !== UNKNOWN_MESSAGE) throw error;
      }
    }
    message = await channel.send(payload);
    db.setMeta(`board_message_${kind}`, message.id);
    shown.set(kind, { message, content });
  }

  // Met les trois classements à jour. Un classement en erreur n'empêche pas les autres.
  async function refresh(now = Date.now()) {
    for (const kind of BOARD_KINDS) {
      try {
        await publish(kind, now);
      } catch (error) {
        console.error(`[PlugBot] Échec : classement en direct (${kind}).`, error);
      }
    }
  }

  return { refresh };
}
