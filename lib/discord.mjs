// Message Discord au porteur du projet à chaque paiement réussi (facultatif).
// Réglage : DISCORD_WEBHOOK_URL, l'adresse du webhook d'un salon (Modifier le salon → Intégrations → Webhooks).

export function discordConfigure(env = process.env) {
  return Boolean(env.DISCORD_WEBHOOK_URL);
}

export async function envoyerDiscord(content, env = process.env, fetcher = fetch) {
  if (!env.DISCORD_WEBHOOK_URL) throw new Error("Discord n'est pas configuré");
  // Aucune mention (@everyone, rôles…) ne doit partir, même si un client l'écrit dans son nom.
  const res = await fetcher(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) throw new Error(`webhook Discord : ${res.status}`);
}
