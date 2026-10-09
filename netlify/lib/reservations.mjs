// Logique des deux points d'accès, séparée de Netlify pour être testée avec un faux stockage.
import { AGENDA, cleCreneau, creneauxAVenir, libelleCreneau, lireReservation, messageDiscord } from "./agenda.mjs";
import { discordConfigure, envoyerDiscord } from "./discord.mjs";

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function creneauxPris(store) {
  const { blobs } = await store.list({ prefix: "creneaux/" });
  return new Set(blobs.map((b) => b.key));
}

async function creneauxLibres(store, now) {
  const pris = await creneauxPris(store);
  return creneauxAVenir(now).filter((iso) => !pris.has(cleCreneau(iso)));
}

// GET /api/creneaux
export async function listerCreneaux(store, now = new Date()) {
  return json(200, { dureeMinutes: AGENDA.dureeMinutes, creneaux: await creneauxLibres(store, now) });
}

// POST /api/reserver  { nom, instagram, creneau, site (piège à robots, doit rester vide) }
export async function reserver(req, store, { now = new Date(), env = process.env, fetcher = fetch } = {}) {
  if (req.method !== "POST") return json(405, { erreur: "Méthode non autorisée." });
  let corps;
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: "Demande invalide." });
  }
  if (corps?.site) return json(200, { ok: true });
  if (!discordConfigure(env)) return json(503, { erreur: "Les réservations sont fermées pour le moment." });

  const r = lireReservation(corps, await creneauxLibres(store, now));
  if (r.erreur) return json(400, { erreur: r.erreur });

  const cle = cleCreneau(r.creneau);
  const { modified } = await store.set(cle, JSON.stringify({ ...r, creeLe: now.toISOString() }), { onlyIfNew: true });
  if (!modified) return json(409, { erreur: "Ce créneau vient d'être pris. Choisis-en un autre." });

  try {
    await envoyerDiscord(messageDiscord(r), env, fetcher);
  } catch (e) {
    // Sans message Discord, personne ne rappellerait : on libère le créneau.
    console.error("réservation non transmise", e);
    await store.delete(cle);
    return json(502, { erreur: "La réservation n'a pas pu être envoyée. Réessaie dans un instant." });
  }
  return json(200, { ok: true, creneau: r.creneau, libelle: `${libelleCreneau(r.creneau)} (${AGENDA.nomFuseau})` });
}
