// Message privé Discord au porteur du projet à chaque vente (facultatif).
// Réglages (site.env) : DISCORD_BOT_TOKEN (jeton du bot Creato) et DISCORD_USER_ID (ton identifiant Discord).
// Le bot doit être sur un serveur Discord où tu es aussi, et tes messages privés doivent être ouverts aux membres de ce serveur.

const API = "https://discord.com/api/v10";

export function discordConfigure(env = process.env) {
  return Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_USER_ID);
}

// `message` : un texte, ou un objet Discord ({ content, embeds }).
export async function envoyerDiscord(message, env = process.env, fetcher = fetch) {
  if (!discordConfigure(env)) throw new Error("Discord n'est pas configuré");
  const headers = { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
  const dm = await fetcher(`${API}/users/@me/channels`, { method: "POST", headers, body: JSON.stringify({ recipient_id: env.DISCORD_USER_ID }) });
  if (!dm.ok) throw new Error(`ouverture du message privé Discord : ${dm.status}`);
  const { id } = await dm.json();
  // Aucune mention (@everyone, rôles…) ne doit partir, même si un client l'écrit dans son nom.
  const corps = typeof message === "string" ? { content: message } : message;
  const res = await fetcher(`${API}/channels/${id}/messages`, { method: "POST", headers, body: JSON.stringify({ ...corps, allowed_mentions: { parse: [] } }) });
  if (!res.ok) throw new Error(`message privé Discord : ${res.status}`);
}
