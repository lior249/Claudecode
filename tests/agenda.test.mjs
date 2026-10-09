import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENDA, cleCreneau, creneauxAVenir, libelleCreneau, lireReservation, messageDiscord, pseudoInstagram, zonedToUtc } from "../lib/agenda.mjs";

const agenda = { ...AGENDA, fuseau: "Europe/Paris", nomFuseau: "heure de Paris", joursAffiches: 3, delaiMinimumHeures: 2, horaires: { 1: ["10:00-11:00"], 2: ["18:00-19:30"] } };

test("convertit l'heure locale en UTC, heure d'été comprise", () => {
  assert.equal(zonedToUtc("2026-10-12", "10:00", "Europe/Paris").toISOString(), "2026-10-12T08:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-14", "10:00", "Europe/Paris").toISOString(), "2026-12-14T09:00:00.000Z");
  assert.equal(zonedToUtc("2026-10-12", "10:00", "Africa/Lome").toISOString(), "2026-10-12T10:00:00.000Z");
});

test("découpe les plages en créneaux et respecte le délai minimum", () => {
  // Lundi 12 octobre 2026, 8 h 30 à Paris : le délai de 2 h écarte 10 h 00, garde 10 h 30.
  const now = new Date("2026-10-12T06:30:00Z");
  assert.deepEqual(creneauxAVenir(now, agenda), [
    "2026-10-12T08:30:00.000Z",
    "2026-10-13T16:00:00.000Z",
    "2026-10-13T16:30:00.000Z",
    "2026-10-13T17:00:00.000Z",
  ]);
});

test("ne propose rien les jours sans horaires", () => {
  const dimanche = new Date("2026-10-11T08:00:00Z");
  assert.ok(creneauxAVenir(dimanche, { ...agenda, joursAffiches: 1 }).length === 0);
});

test("clé de stockage sans caractères gênants", () => {
  assert.equal(cleCreneau("2026-10-12T08:30:00.000Z"), "creneaux/2026-10-12T08-30-00-000Z");
});

test("libellé en français", () => {
  assert.equal(libelleCreneau("2026-10-12T08:30:00.000Z", "Europe/Paris"), "lundi 12 octobre à 10 h 30");
});

test("lit le pseudo Instagram sous plusieurs formes", () => {
  assert.equal(pseudoInstagram("@flo.hustle_24"), "flo.hustle_24");
  assert.equal(pseudoInstagram("https://www.instagram.com/flohustle24/?hl=fr"), "flohustle24");
  assert.equal(pseudoInstagram("  flohustle24 "), "flohustle24");
  assert.equal(pseudoInstagram("pas valide !"), null);
  assert.equal(pseudoInstagram(""), null);
});

test("vérifie le formulaire", () => {
  const libres = ["2026-10-12T08:30:00.000Z"];
  assert.deepEqual(lireReservation({ nom: "  Jean   Dupont ", instagram: "@jean", creneau: libres[0] }, libres), { nom: "Jean Dupont", instagram: "jean", creneau: libres[0] });
  assert.match(lireReservation({ nom: "J", instagram: "jean", creneau: libres[0] }, libres).erreur, /nom/);
  assert.match(lireReservation({ nom: "Jean", instagram: "", creneau: libres[0] }, libres).erreur, /Instagram/);
  assert.match(lireReservation({ nom: "Jean", instagram: "jean", creneau: "2026-10-12T09:00:00.000Z" }, libres).erreur, /plus disponible/);
  assert.match(lireReservation(null, libres).erreur, /invalide/);
});

test("message Discord : nom, Instagram, jour et heure, sans mise en forme injectée", () => {
  const m = messageDiscord({ nom: "**Jean** @everyone", instagram: "jean_d", creneau: "2026-10-12T08:30:00.000Z" }, agenda);
  assert.match(m, /Nom : \\\*\\\*Jean\\\*\\\* @everyone/);
  assert.match(m, /Instagram : @jean\\_d — <https:\/\/www\.instagram\.com\/jean_d\/>/);
  assert.match(m, /Appel : lundi 12 octobre à 10 h 30 \(heure de Paris\), 30 min/);
});
