// Envoi d'un message Discord au porteur du projet.
// Deux façons, au choix dans le fichier de réglages du serveur (site.env) :
// - DISCORD_WEBHOOK_URL : message dans un salon (webhook du salon) ;
// - DISCORD_BOT_TOKEN + DISCORD_USER_ID : message privé envoyé par le bot Creato.

const API = "https://discord.com/api/v10";

export function discordConfigure(env = process.env) {
  return Boolean(env.DISCORD_WEBHOOK_URL || (env.DISCORD_BOT_TOKEN && env.DISCORD_USER_ID));
}

export async function envoyerDiscord(content, env = process.env, fetcher = fetch) {
  // Aucune mention (@everyone, rôles…) ne doit partir, même si un visiteur l'écrit.
  const message = { content, allowed_mentions: { parse: [] } };
  if (env.DISCORD_WEBHOOK_URL) {
    const res = await fetcher(env.DISCORD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) });
    if (!res.ok) throw new Error(`webhook Discord : ${res.status}`);
    return;
  }
  if (env.DISCORD_BOT_TOKEN && env.DISCORD_USER_ID) {
    const headers = { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
    const dm = await fetcher(`${API}/users/@me/channels`, { method: "POST", headers, body: JSON.stringify({ recipient_id: env.DISCORD_USER_ID }) });
    if (!dm.ok) throw new Error(`ouverture du message privé : ${dm.status}`);
    const { id } = await dm.json();
    const res = await fetcher(`${API}/channels/${id}/messages`, { method: "POST", headers, body: JSON.stringify(message) });
    if (!res.ok) throw new Error(`message privé Discord : ${res.status}`);
    return;
  }
  throw new Error("Discord n'est pas configuré");
}
