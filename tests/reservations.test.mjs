import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { BlobsServer } from "@netlify/blobs/server";
import { creneauxAVenir } from "../netlify/lib/agenda.mjs";
import { listerCreneaux, reserver } from "../netlify/lib/reservations.mjs";

// Vrai stockage Netlify Blobs, lancé en local.
let server, dir, port, n = 0;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "blobs-"));
  server = new BlobsServer({ directory: dir, token: "jeton" });
  ({ port } = await server.start());
});
after(async () => {
  await server.stop();
  await rm(dir, { recursive: true, force: true });
});
const nouveauStore = () => {
  const url = `http://localhost:${port}`;
  return getStore({ name: `test-${n++}`, siteID: "site", token: "jeton", edgeURL: url, uncachedEdgeURL: url, consistency: "strong" });
};

// Lundi 12 octobre 2026, 6 h à Lomé.
const now = new Date("2026-10-12T06:00:00Z");
const premier = creneauxAVenir(now)[0];
const env = { DISCORD_WEBHOOK_URL: "https://discord.test/webhook" };
const requete = (corps) => new Request("https://site.test/api/reserver", { method: "POST", body: JSON.stringify(corps) });

function fauxDiscord(status = 204) {
  const envois = [];
  const fetcher = async (url, init) => {
    envois.push({ url, corps: JSON.parse(init.body) });
    return new Response(null, { status });
  };
  return { envois, fetcher };
}

test("réserve un créneau, prévient Discord et le retire de la liste", async () => {
  const store = nouveauStore();
  const discord = fauxDiscord();
  const res = await reserver(requete({ nom: "Jean Dupont", instagram: "@jean.dupont", creneau: premier }), store, { now, env, fetcher: discord.fetcher });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).libelle, "lundi 12 octobre à 10 h 00 (heure de Lomé)");

  assert.equal(discord.envois.length, 1);
  assert.equal(discord.envois[0].url, env.DISCORD_WEBHOOK_URL);
  assert.deepEqual(discord.envois[0].corps.allowed_mentions, { parse: [] });
  assert.match(discord.envois[0].corps.content, /Jean Dupont[\s\S]*@jean\.dupont[\s\S]*lundi 12 octobre à 10 h 00/);

  const { creneaux } = await (await listerCreneaux(store, now)).json();
  assert.ok(!creneaux.includes(premier));
  assert.equal(creneaux.length, creneauxAVenir(now).length - 1);
});

test("refuse un créneau déjà pris", async () => {
  const store = nouveauStore();
  const discord = fauxDiscord();
  const corps = { nom: "Jean", instagram: "jean", creneau: premier };
  assert.equal((await reserver(requete(corps), store, { now, env, fetcher: discord.fetcher })).status, 200);
  const res = await reserver(requete({ ...corps, nom: "Paul" }), store, { now, env, fetcher: discord.fetcher });
  assert.equal(res.status, 400);
  assert.match((await res.json()).erreur, /plus disponible/);
  assert.equal(discord.envois.length, 1);
});

// Le créneau est pris entre la lecture de la liste et l'écriture : l'écriture conditionnelle
// (onlyIfNew, atomique chez Netlify) refuse la seconde réservation.
test("créneau pris entre la lecture et l'écriture : la seconde réservation est refusée", async () => {
  const store = nouveauStore();
  const discord = fauxDiscord();
  const corps = { nom: "Jean", instagram: "jean", creneau: premier };
  assert.equal((await reserver(requete(corps), store, { now, env, fetcher: discord.fetcher })).status, 200);
  const listeEnRetard = { list: async () => ({ blobs: [] }), set: (...a) => store.set(...a), delete: (...a) => store.delete(...a) };
  const res = await reserver(requete({ ...corps, nom: "Paul" }), listeEnRetard, { now, env, fetcher: discord.fetcher });
  assert.equal(res.status, 409);
  assert.match((await res.json()).erreur, /vient d'être pris/);
  assert.equal(discord.envois.length, 1);
});

test("si Discord échoue, le créneau est libéré", async () => {
  const store = nouveauStore();
  const res = await reserver(requete({ nom: "Jean", instagram: "jean", creneau: premier }), store, { now, env, fetcher: fauxDiscord(500).fetcher });
  assert.equal(res.status, 502);
  const { creneaux } = await (await listerCreneaux(store, now)).json();
  assert.ok(creneaux.includes(premier));
});

test("message privé par le bot quand il n'y a pas de webhook", async () => {
  const store = nouveauStore();
  const appels = [];
  const fetcher = async (url, init) => {
    appels.push({ url, auth: init.headers.Authorization, corps: JSON.parse(init.body) });
    return url.endsWith("/users/@me/channels") ? Response.json({ id: "42" }) : new Response(null, { status: 200 });
  };
  const res = await reserver(requete({ nom: "Jean", instagram: "jean", creneau: premier }), store, { now, env: { DISCORD_BOT_TOKEN: "b", DISCORD_USER_ID: "7" }, fetcher });
  assert.equal(res.status, 200);
  assert.deepEqual(appels.map((a) => a.url), ["https://discord.com/api/v10/users/@me/channels", "https://discord.com/api/v10/channels/42/messages"]);
  assert.equal(appels[0].auth, "Bot b");
  assert.deepEqual(appels[0].corps, { recipient_id: "7" });
});

test("fermé tant que Discord n'est pas configuré ; robots ignorés ; formulaire vérifié", async () => {
  const store = nouveauStore();
  const discord = fauxDiscord();
  assert.equal((await reserver(requete({ nom: "Jean", instagram: "jean", creneau: premier }), store, { now, env: {}, fetcher: discord.fetcher })).status, 503);
  assert.equal((await reserver(requete({ nom: "Bot", instagram: "bot", creneau: premier, site: "x" }), store, { now, env, fetcher: discord.fetcher })).status, 200);
  assert.equal((await reserver(requete({ nom: "Jean", instagram: "pas valide !", creneau: premier }), store, { now, env, fetcher: discord.fetcher })).status, 400);
  assert.equal((await reserver(new Request("https://site.test/api/reserver", { method: "POST", body: "{" }), store, { now, env })).status, 400);
  assert.equal(discord.envois.length, 0);
  const { creneaux } = await (await listerCreneaux(store, now)).json();
  assert.ok(creneaux.includes(premier));
});
