'use strict';

// Événements (challenges) : créés par le coach, avec une bannière (dans le défilé en haut des pages) et une affiche (page de
// l'événement), des conditions de participation (un trophée minimum par famille), des inscriptions et un classement propre :
// les revenus générés pendant l'événement par les inscrits.
//  - le début : entre 3 et 15 jours après la création (le temps de s'y préparer) ;
//  - la durée : de 3 à 30 jours ;
//  - au plus 5 événements à venir ou en cours en même temps.
// Stats suivies : une seule (monostat) ou plusieurs (multistat : un classement et un podium par stat) parmi revenus, vues, abonnés.
// Tout le monde part de 0 au début de l'événement (calcul d'après les updates du soir validées). Avec les 3 stats (challenge
// global), les rappels quotidiens des inscrits deviennent ceux du challenge. À la fin : le podium de chaque stat reçoit le badge
// de l'événement (or, argent, bronze), un « badge spécial ».

const { TROPHEES, FAMILLES } = require('./trophees');

const DEBUT_MIN = 3; const DEBUT_MAX = 15; const DUREE_MIN = 3; const DUREE_MAX = 30; const MAX_ACTIFS = 5;
const JOUR = 864e5;
const STATS = { revenus: 'Argent généré', vues: 'Vues', abonnes: 'Abonnés gagnés' };
const RANGS = { 1: 'or', 2: 'argent', 3: 'bronze' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ecart = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / JOUR);
const ajouter = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

function creerEvenements({ db, maintenant = () => new Date() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS evenements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, titre TEXT NOT NULL, description TEXT NOT NULL, objectif TEXT,
    banniere TEXT, affiche TEXT, couleur TEXT, debut TEXT NOT NULL, fin TEXT NOT NULL, conditions TEXT, cree_le TEXT NOT NULL, retire_le TEXT);
  CREATE TABLE IF NOT EXISTS inscriptions_evenement (evenement_id INTEGER NOT NULL, discord_id TEXT NOT NULL, inscrit_le TEXT NOT NULL,
    PRIMARY KEY (evenement_id, discord_id));`);
  const cols = db.prepare('PRAGMA table_info(evenements)').all().map((c) => c.name);
  for (const [n, t] of [['statut', "TEXT NOT NULL DEFAULT 'publie'"], ['stats', 'TEXT'], ['regles_points', 'TEXT'], ['regles_validation', 'TEXT'], ['badge_nom', 'TEXT'], ['badge_or', 'TEXT'], ['badge_argent', 'TEXT'], ['badge_bronze', 'TEXT'], ['cloture_le', 'TEXT']]) {
    if (!cols.includes(n)) db.exec(`ALTER TABLE evenements ADD COLUMN ${n} ${t}`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS badges_evenement (discord_id TEXT NOT NULL, evenement_id INTEGER NOT NULL, stat TEXT NOT NULL, rang INTEGER NOT NULL,
    valeur REAL, obtenu_le TEXT NOT NULL, vu_le TEXT, PRIMARY KEY (discord_id, evenement_id, stat))`);
  const aujourdhui = () => maintenant().toISOString().slice(0, 10);
  const lire = (e) => (e ? { ...e, conditions: JSON.parse(e.conditions || '{}'), stats: JSON.parse(e.stats || '["revenus"]') } : null);
  const q = {
    un: db.prepare('SELECT * FROM evenements WHERE id = ?'),
    actifs: db.prepare("SELECT * FROM evenements WHERE retire_le IS NULL AND statut = 'publie' AND fin >= ? ORDER BY debut, id"),
    tous: db.prepare('SELECT * FROM evenements ORDER BY id DESC LIMIT ?'),
    publier: db.prepare("UPDATE evenements SET statut = 'publie', debut = ?, fin = ? WHERE id = ? AND statut = 'brouillon'"),
    supprimer: db.prepare("DELETE FROM evenements WHERE id = ? AND statut = 'brouillon'"),
    creer: db.prepare(`INSERT INTO evenements (titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions, cree_le, stats, regles_points, regles_validation,
      badge_nom, badge_or, badge_argent, badge_bronze) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    badges: db.prepare(`SELECT b.*, e.titre, e.badge_nom, e.badge_or, e.badge_argent, e.badge_bronze, e.couleur FROM badges_evenement b JOIN evenements e ON e.id = b.evenement_id
      WHERE b.discord_id = ? ORDER BY b.obtenu_le DESC, b.rang`),
    donner: db.prepare('INSERT OR IGNORE INTO badges_evenement (discord_id, evenement_id, stat, rang, valeur, obtenu_le) VALUES (?, ?, ?, ?, ?, ?)'),
    vus: db.prepare('UPDATE badges_evenement SET vu_le = ? WHERE discord_id = ? AND vu_le IS NULL'),
    cloturer: db.prepare('UPDATE evenements SET cloture_le = ? WHERE id = ? AND cloture_le IS NULL'),
    aCloturer: db.prepare("SELECT * FROM evenements WHERE retire_le IS NULL AND cloture_le IS NULL AND statut = 'publie' AND fin < ?"),
    enCoursDe: db.prepare(`SELECT e.* FROM evenements e JOIN inscriptions_evenement i ON i.evenement_id = e.id
      WHERE i.discord_id = ? AND e.retire_le IS NULL AND e.statut = 'publie' AND e.debut <= ? AND e.fin >= ? ORDER BY e.debut`),
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
    etat(e) { const a = aujourdhui(); return e.statut === 'brouillon' ? 'brouillon' : e.retire_le ? 'retire' : a < e.debut ? 'a_venir' : a > e.fin ? 'termine' : 'en_cours'; },
    un(id) { return lire(q.un.get(Number(id))); },
    actifs() { return q.actifs.all(aujourdhui()).map(lire); },
    tous(n = 200) { return q.tous.all(n).map(lire); },
    STATS, RANGS,
    estGlobal(e) { return Object.keys(STATS).every((x) => (e.stats || []).includes(x)); },
    creer({ titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions = {}, stats = [], reglesPoints, reglesValidation, badgeNom, badges = {} }) {
      const t = String(titre || '').trim().slice(0, 80); const d = String(description || '').trim().slice(0, 3000);
      if (!t || !d) return { erreur: 'Donne un titre et une description.' };
      // Sans dates : un brouillon (les dates se choisissent à la publication).
      const brouillon = !debut && !fin;
      if (!brouillon) { const v = api.verifierDates(debut, fin); if (v.erreur) return v; }
      // Conditions : au plus un trophée par famille.
      const cond = {};
      for (const [fam] of FAMILLES) { const c = String(conditions[fam] || ''); if (TROPHEES.some((x) => x.cle === c && x.famille === fam)) cond[fam] = c; }
      const st = Object.keys(STATS).filter((x) => [].concat(stats || []).includes(x));
      if (!st.length) return { erreur: 'Choisis au moins une stat à suivre (argent, vues ou abonnés).' };
      const rp = String(reglesPoints || '').trim().slice(0, 2000); const rv = String(reglesValidation || '').trim().slice(0, 2000);
      if (!rp) return { erreur: 'Écris comment on gagne (attribution des points).' };
      const bn = String(badgeNom || '').trim().slice(0, 60) || t;
      const r = q.creer.run(t, d, String(objectif || '').trim().slice(0, 200) || null, banniere || null, affiche || null,
        /^#[0-9a-f]{6}$/i.test(String(couleur || '')) ? couleur : '#1a1a1a', debut || '', fin || '', JSON.stringify(cond), maintenant().toISOString(),
        JSON.stringify(st), rp, rv || null, bn, badges.or || null, badges.argent || null, badges.bronze || null);
      const id = Number(r.lastInsertRowid);
      if (brouillon) db.prepare("UPDATE evenements SET statut = 'brouillon', debut = '', fin = '' WHERE id = ?").run(id);
      return { evenement: api.un(id) };
    },
    retirer(id) { q.retirer.run(maintenant().toISOString(), Number(id)); },
    // Les dates : début dans 3 à 15 jours, durée 3 à 30 jours, au plus 5 événements à venir ou en cours.
    verifierDates(debut, fin) {
      if (!DATE.test(String(debut)) || !DATE.test(String(fin))) return { erreur: 'Choisis la date de début et la date de fin.' };
      const a = aujourdhui();
      if (ecart(a, debut) < DEBUT_MIN) return { erreur: `L'événement commence au plus tôt dans ${DEBUT_MIN} jours (le temps de s'y préparer).` };
      if (ecart(a, debut) > DEBUT_MAX) return { erreur: `L'événement commence au plus tard dans ${DEBUT_MAX} jours.` };
      const duree = ecart(debut, fin) + 1;
      if (duree < DUREE_MIN) return { erreur: `Un événement dure au moins ${DUREE_MIN} jours.` };
      if (duree > DUREE_MAX) return { erreur: `Un événement dure au plus ${DUREE_MAX} jours.` };
      if (api.actifs().length >= MAX_ACTIFS) return { erreur: `Il y a déjà ${MAX_ACTIFS} événements à venir ou en cours.` };
      return { ok: true };
    },
    publier(id, debut, fin) {
      const e = api.un(id);
      if (!e || e.statut !== 'brouillon') return { erreur: 'Ce brouillon n\'existe plus.' };
      const v = api.verifierDates(debut, fin);
      if (v.erreur) return v;
      q.publier.run(debut, fin, e.id);
      return { evenement: api.un(e.id) };
    },
    supprimerBrouillon(id) { q.supprimer.run(Number(id)); },
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
    // Les événements en cours où ce membre est inscrit.
    enCoursPour(discordId) { const a = aujourdhui(); return q.enCoursDe.all(String(discordId), a, a).map(lire); },
    // Classement par stat : valeurDe(discordId) → { revenus, vues, abonnes } depuis le début de l'événement.
    classements(e, valeurDe) {
      const ins = api.inscrits(e.id).map((i) => ({ id: i.discord_id, ...valeurDe(i.discord_id) }));
      return Object.fromEntries(e.stats.map((st) => [st, ins.slice().sort((a, b) => (b[st] || 0) - (a[st] || 0)).map((x, i) => ({ ...x, rang: i + 1, valeur: x[st] || 0 }))]));
    },
    // Événements terminés : le podium de chaque stat reçoit le badge (or, argent, bronze). valeurDe(e, id). Renvoie les badges donnés.
    cloturer(valeurDe) {
      const donnes = [];
      for (const brut of q.aCloturer.all(aujourdhui())) {
        const e = lire(brut);
        if (!q.cloturer.run(maintenant().toISOString(), e.id).changes) continue;
        const c = api.classements(e, (id) => valeurDe(e, id));
        for (const st of e.stats) {
          for (const x of c[st].filter((y) => y.valeur > 0).slice(0, 3)) {
            if (q.donner.run(x.id, e.id, st, x.rang, x.valeur, maintenant().toISOString()).changes) donnes.push({ discordId: x.id, evenement: e, stat: st, rang: x.rang });
          }
        }
      }
      return donnes;
    },
    // Badges spéciaux d'un membre (les plus récents d'abord), avec l'image de son rang.
    badgesDe(discordId) {
      return q.badges.all(String(discordId)).map((b) => ({ ...b, metal: RANGS[b.rang], image: b[`badge_${RANGS[b.rang]}`] || null,
        titre: b.badge_nom || b.titre, sous: `${['', '1er', '2e', '3e'][b.rang]} · ${STATS[b.stat] || b.stat} · ${b.titre}` }));
    },
    badgesVus(discordId) { q.vus.run(maintenant().toISOString(), String(discordId)); },
  };
  return api;
}

module.exports = { creerEvenements, DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS, STATS, RANGS };
