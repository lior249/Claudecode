'use strict';

// Événements (challenges) : créés par le coach, avec une bannière (dans le défilé en haut des pages) et une affiche (page de
// l'événement), des conditions de participation (un trophée minimum par famille), des inscriptions et un classement propre :
// les revenus générés pendant l'événement par les inscrits.
//  - le début : entre 3 et 15 jours après la création (le temps de s'y préparer) ;
//  - la durée : de 3 à 30 jours ;
//  - au plus 5 événements à venir ou en cours en même temps.

const { TROPHEES, FAMILLES } = require('./trophees');

const DEBUT_MIN = 3; const DEBUT_MAX = 15; const DUREE_MIN = 3; const DUREE_MAX = 30; const MAX_ACTIFS = 5;
const JOUR = 864e5;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ecart = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / JOUR);
const ajouter = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

function creerEvenements({ db, maintenant = () => new Date() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, description TEXT NOT NULL, objectif TEXT,
    banniere TEXT, affiche TEXT, couleur TEXT, debut TEXT NOT NULL, fin TEXT NOT NULL, conditions TEXT, cree_le TEXT NOT NULL, retire_le TEXT);
  CREATE TABLE IF NOT EXISTS inscriptions_evenement (evenement_id INTEGER NOT NULL, discord_id TEXT NOT NULL, inscrit_le TEXT NOT NULL,
    PRIMARY KEY (evenement_id, discord_id));`);
  const aujourdhui = () => maintenant().toISOString().slice(0, 10);
  const lire = (e) => (e ? { ...e, conditions: JSON.parse(e.conditions || '{}') } : null);
  const q = {
    un: db.prepare('SELECT * FROM evenements WHERE id = ?'),
    actifs: db.prepare('SELECT * FROM evenements WHERE retire_le IS NULL AND fin >= ? ORDER BY debut, id'),
    tous: db.prepare('SELECT * FROM evenements ORDER BY id DESC LIMIT 50'),
    creer: db.prepare('INSERT INTO evenements (titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    retirer: db.prepare('UPDATE evenements SET retire_le = ? WHERE id = ?'),
    inscrire: db.prepare('INSERT OR IGNORE INTO inscriptions_evenement (evenement_id, discord_id, inscrit_le) VALUES (?, ?, ?)'),
    desinscrire: db.prepare('DELETE FROM inscriptions_evenement WHERE evenement_id = ? AND discord_id = ?'),
    inscrits: db.prepare('SELECT * FROM inscriptions_evenement WHERE evenement_id = ? ORDER BY inscrit_le'),
    inscrit: db.prepare('SELECT 1 FROM inscriptions_evenement WHERE evenement_id = ? AND discord_id = ?'),
  };
  const api = {
    DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS,
    bornes() { const a = aujourdhui(); return { debutMin: ajouter(a, DEBUT_MIN), debutMax: ajouter(a, DEBUT_MAX) }; },
    // État d'un événement : à venir, en cours, terminé.
    etat(e) { const a = aujourdhui(); return e.retire_le ? 'retire' : a < e.debut ? 'a_venir' : a > e.fin ? 'termine' : 'en_cours'; },
    un(id) { return lire(q.un.get(Number(id))); },
    actifs() { return q.actifs.all(aujourdhui()).map(lire); },
    tous() { return q.tous.all().map(lire); },
    creer({ titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions = {} }) {
      const t = String(titre || '').trim().slice(0, 80); const d = String(description || '').trim().slice(0, 3000);
      if (!t || !d) return { erreur: 'Donne un titre et une description.' };
      if (!DATE.test(String(debut)) || !DATE.test(String(fin))) return { erreur: 'Choisis la date de début et la date de fin.' };
      const a = aujourdhui();
      if (ecart(a, debut) < DEBUT_MIN) return { erreur: `L'événement commence au plus tôt dans ${DEBUT_MIN} jours (le temps de s'y préparer).` };
      if (ecart(a, debut) > DEBUT_MAX) return { erreur: `L'événement commence au plus tard dans ${DEBUT_MAX} jours.` };
      const duree = ecart(debut, fin) + 1;
      if (duree < DUREE_MIN) return { erreur: `Un événement dure au moins ${DUREE_MIN} jours.` };
      if (duree > DUREE_MAX) return { erreur: `Un événement dure au plus ${DUREE_MAX} jours.` };
      if (api.actifs().length >= MAX_ACTIFS) return { erreur: `Il y a déjà ${MAX_ACTIFS} événements à venir ou en cours.` };
      // Conditions : au plus un trophée par famille.
      const cond = {};
      for (const [fam] of FAMILLES) { const c = String(conditions[fam] || ''); if (TROPHEES.some((x) => x.cle === c && x.famille === fam)) cond[fam] = c; }
      const r = q.creer.run(t, d, String(objectif || '').trim().slice(0, 200) || null, banniere || null, affiche || null,
        /^#[0-9a-f]{6}$/i.test(String(couleur || '')) ? couleur : '#1a1a1a', debut, fin, JSON.stringify(cond), maintenant().toISOString());
      return { evenement: api.un(Number(r.lastInsertRowid)) };
    },
    retirer(id) { q.retirer.run(maintenant().toISOString(), Number(id)); },
    // Conditions : pour chaque famille, avoir le trophée demandé ou un plus élevé de la même famille.
    conditionsRemplies(e, obtenus = []) {
      const cles = new Set(obtenus.map((t) => t.cle));
      return Object.entries(e.conditions || {}).map(([fam, cle]) => {
        const famille = TROPHEES.filter((t) => t.famille === fam);
        const i = famille.findIndex((t) => t.cle === cle);
        return { famille: fam, trophee: TROPHEES.find((t) => t.cle === cle), ok: famille.slice(Math.max(0, i)).some((t) => cles.has(t.cle)) };
      });
    },
    inscrire(e, discordId, obtenus) {
      if (!e || e.retire_le) return { erreur: 'Événement introuvable.' };
      if (api.etat(e) === 'termine') return { erreur: 'Cet événement est terminé.' };
      if (!api.conditionsRemplies(e, obtenus).every((c) => c.ok)) return { erreur: 'Il te manque un trophée pour participer.' };
      q.inscrire.run(e.id, String(discordId), maintenant().toISOString());
      return { ok: true };
    },
    desinscrire(e, discordId) { if (e && api.etat(e) === 'a_venir') q.desinscrire.run(e.id, String(discordId)); },
    inscrits(id) { return q.inscrits.all(Number(id)); },
    estInscrit(id, discordId) { return Boolean(q.inscrit.get(Number(id), String(discordId))); },
  };
  return api;
}

module.exports = { creerEvenements, DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS };
