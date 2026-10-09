import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { creerServeur } from "../serveur.mjs";

let serveur, base, dir;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "creato-serveur-"));
  serveur = creerServeur({ donnees: dir, env: { ACCESS_CODE: "x", COMMUNITY_URL: "https://whop.test", SASPAY_API_KEY: "sk" } });
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${serveur.address().port}`;
});
after(() => {
  serveur.close();
  rmSync(dir, { recursive: true, force: true });
});

// Requête brute : le chemin est envoyé tel quel (fetch nettoierait les « .. »).
const brut = (chemin) => new Promise((ok, ko) => {
  request(`${base}${chemin}`, { method: "GET", path: chemin }, (res) => { res.resume(); ok(res.statusCode); }).on("error", ko).end();
});

test("sert la page principale et la page de paiement", async () => {
  const accueil = await fetch(`${base}/`);
  assert.equal(accueil.status, 200);
  assert.match(accueil.headers.get("content-type"), /text\/html/);
  const html = await accueil.text();
  assert.match(html, /Payer par carte/);
  assert.match(html, /Payer par mobile money/);
  assert.doesNotMatch(html, /\/paiement\//);
  const redir = await fetch(`${base}/paiement`, { redirect: "manual" });
  assert.equal(redir.status, 301);
  assert.equal(redir.headers.get("location"), "/paiement/");
  assert.match(await (await fetch(`${base}/paiement/`)).text(), /Rejoins le TikTok Elite/);
  assert.equal((await fetch(`${base}/img/resultats/01.jpg`)).headers.get("content-type"), "image/jpeg");
});

test("ne sert rien en dehors du dossier site/", async () => {
  for (const chemin of ["/../serveur.mjs", "/..%2fserveur.mjs", "/%2e%2e/package.json", "/../../etc/passwd", "/paiement/../../README.md", "/%E0%A4%A", "/..%2f..%2ftmp"]) {
    assert.equal(await brut(chemin), 404, chemin);
  }
  assert.equal((await fetch(`${base}/inexistant.html`)).status, 404);
});

test("API : état des réglages, routes inconnues, paiement par carte fermé sans clé", async () => {
  assert.deepEqual(await (await fetch(`${base}/api/sante`)).json(), { ok: true, carte: false, mobileMoney: true });
  assert.equal((await fetch(`${base}/api/creneaux`)).status, 404);
  const r = await fetch(`${base}/api/checkout`, { method: "POST", body: JSON.stringify({ moyen: "carte", firstName: "A", lastName: "B", email: "a@b.co" }) });
  assert.equal(r.status, 503);
  assert.equal((await fetch(`${base}/api/inconnue`)).status, 404);
  assert.equal((await fetch(`${base}/api/status?s=pas-un-jeton`)).status, 404);
});
