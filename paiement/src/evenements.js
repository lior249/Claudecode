'use strict';

// Événements (challenges) : créés par le coach, des conditions de participation (un trophée minimum par famille), des
// inscriptions et un classement propre. Ce sont des COURSES : pour chaque stat suivie, un palier à atteindre ; les N premiers
// (N = nombre de gagnants, 1 à 3) qui l'atteignent gagnent le badge (or, argent, bronze), dès qu'ils l'atteignent.
//  - le coach choisit des délais, pas des dates : l'attente avant le début (1 à 14 jours : le temps de réunir les trophées
//    demandés) et la durée (1 à 30 jours, ou indéfinie : jusqu'à ce que tous les gagnants aient atteint le palier) ;
//    les dates se calculent à la mise en ligne (un brouillon n'a pas de date) ; l'heure de début est facultative (GMT) ;
//  - au plus 5 événements à venir ou en cours en même temps.
// (Les anciens événements sans palier : podium à la fin.)
// Stats suivies : une seule (monostat) ou plusieurs (multistat : un classement et un podium par stat) parmi revenus, vues, abonnés.
// Tout le monde part de 0 au début de l'événement (calcul d'après les updates du soir validées). Avec les 3 stats (challenge
// global), les rappels quotidiens des inscrits deviennent ceux du challenge. À la fin : le podium de chaque stat reçoit le badge
// de l'événement (or, argent, bronze), un « badge spécial ».

const { TROPHEES, FAMILLES } = require('./trophees');

const DEBUT_MIN = 1; const DEBUT_MAX = 14; const DUREE_MIN = 1; const DUREE_MAX = 30; const MAX_ACTIFS = 5;
const SANS_FIN = '9999-12-31';
// La bannière générée (badge + texte) : 5 couleurs au choix du coach.
const COULEURS = { texte: '#c8f23a', fond: '#000000', fondu: '#0d0d0d', halo: '#c8f23a', bouton: '#c8f23a', effet: 'halo' };
// L'effet derrière le badge (carte et fiche) : halo de lumière (rayons) ou fondu linéaire (l'accent descend du haut).
const EFFETS = { halo: 'Halo de lumière (rayons)', fondu: 'Fondu linéaire (du haut vers le bas)' };
const HEX = /^#[0-9a-f]{6}$/i;
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
  for (const [n, t] of [['statut', "TEXT NOT NULL DEFAULT 'publie'"], ['stats', 'TEXT'], ['regles_points', 'TEXT'], ['regles_validation', 'TEXT'], ['badge_nom', 'TEXT'], ['badge_or', 'TEXT'], ['badge_argent', 'TEXT'], ['badge_bronze', 'TEXT'], ['cloture_le', 'TEXT'],
    ['gagnants', 'INTEGER NOT NULL DEFAULT 3'], ['paliers', 'TEXT'], ['attente_jours', 'INTEGER'], ['duree_jours', 'INTEGER'], ['heure', 'TEXT'], ['couleurs', 'TEXT']]) {
    if (!cols.includes(n)) db.exec(`ALTER TABLE evenements ADD COLUMN ${n} ${t}`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS badges_evenement (discord_id TEXT NOT NULL, evenement_id INTEGER NOT NULL, stat TEXT NOT NULL, rang INTEGER NOT NULL,
    valeur REAL, obtenu_le TEXT NOT NULL, vu_le TEXT, PRIMARY KEY (discord_id, evenement_id, stat))`);
  // Course : qui a atteint le palier de chaque stat, et quand (l'ordre d'arrivée fait le classement des gagnants).
  db.exec(`CREATE TABLE IF NOT EXISTS arrivees_evenement (evenement_id INTEGER NOT NULL, stat TEXT NOT NULL, discord_id TEXT NOT NULL,
    valeur REAL, arrive_le TEXT NOT NULL, PRIMARY KEY (evenement_id, stat, discord_id))`);
  const aujourdhui = () => maintenant().toISOString().slice(0, 10);
  const lire = (e) => (e ? { ...e, conditions: JSON.parse(e.conditions || '{}'), stats: JSON.parse(e.stats || '["revenus"]'), paliers: JSON.parse(e.paliers || '{}'),
    couleurs: { ...COULEURS, ...(e.couleur && !e.couleurs ? { halo: e.couleur } : {}), ...JSON.parse(e.couleurs || '{}') },
    gagnants: Math.min(3, Math.max(1, Number(e.gagnants) || 3)), indefinie: e.fin === SANS_FIN || (e.statut === 'brouillon' && e.duree_jours === 0) } : null);
  const estCourse = (e) => Object.keys(e.paliers || {}).length > 0;
  const q = {
    un: db.prepare('SELECT * FROM evenements WHERE id = ?'),
    actifs: db.prepare("SELECT * FROM evenements WHERE retire_le IS NULL AND cloture_le IS NULL AND statut = 'publie' AND fin >= ? ORDER BY debut, id"),
    tous: db.prepare('SELECT * FROM evenements ORDER BY id DESC LIMIT ?'),
    publier: db.prepare("UPDATE evenements SET statut = 'publie', debut = ?, fin = ?, heure = ? WHERE id = ? AND statut = 'brouillon'"),
    supprimer: db.prepare("DELETE FROM evenements WHERE id = ? AND statut = 'brouillon'"),
    creer: db.prepare(`INSERT INTO evenements (titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions, cree_le, stats, regles_points, regles_validation,
      badge_nom, badge_or, badge_argent, badge_bronze) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    badges: db.prepare(`SELECT b.*, e.titre, e.badge_nom, e.badge_or, e.badge_argent, e.badge_bronze, e.couleur FROM badges_evenement b JOIN evenements e ON e.id = b.evenement_id
      WHERE b.discord_id = ? ORDER BY b.obtenu_le DESC, b.rang`),
    donner: db.prepare('INSERT OR IGNORE INTO badges_evenement (discord_id, evenement_id, stat, rang, valeur, obtenu_le) VALUES (?, ?, ?, ?, ?, ?)'),
    vus: db.prepare('UPDATE badges_evenement SET vu_le = ? WHERE discord_id = ? AND vu_le IS NULL'),
    cloturer: db.prepare('UPDATE evenements SET cloture_le = ? WHERE id = ? AND cloture_le IS NULL'),
    aCloturer: db.prepare("SELECT * FROM evenements WHERE retire_le IS NULL AND cloture_le IS NULL AND statut = 'publie' AND fin < ?"),
    courses: db.prepare("SELECT * FROM evenements WHERE retire_le IS NULL AND cloture_le IS NULL AND statut = 'publie' AND paliers IS NOT NULL AND paliers != '{}'"),
    arrivees: db.prepare('SELECT * FROM arrivees_evenement WHERE evenement_id = ? AND stat = ? ORDER BY arrive_le, rowid'),
    arriver: db.prepare('INSERT OR IGNORE INTO arrivees_evenement (evenement_id, stat, discord_id, valeur, arrive_le) VALUES (?, ?, ?, ?, ?)'),
    enCoursDe: db.prepare(`SELECT e.* FROM evenements e JOIN inscriptions_evenement i ON i.evenement_id = e.id
      WHERE i.discord_id = ? AND e.retire_le IS NULL AND e.cloture_le IS NULL AND e.statut = 'publie' AND e.debut <= ? AND e.fin >= ? ORDER BY e.debut`),
    retirer: db.prepare('UPDATE evenements SET retire_le = ? WHERE id = ?'),
    inscrire: db.prepare('INSERT OR IGNORE INTO inscriptions_evenement (evenement_id, discord_id, inscrit_le) VALUES (?, ?, ?)'),
    desinscrire: db.prepare('DELETE FROM inscriptions_evenement WHERE evenement_id = ? AND discord_id = ?'),
    inscrits: db.prepare('SELECT * FROM inscriptions_evenement WHERE evenement_id = ? ORDER BY inscrit_le'),
    inscrit: db.prepare('SELECT 1 FROM inscriptions_evenement WHERE evenement_id = ? AND discord_id = ?'),
  };
  const api = {
    DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS, SANS_FIN,
    estCourse,
    bornes() { const a = aujourdhui(); return { debutMin: ajouter(a, DEBUT_MIN), debutMax: ajouter(a, DEBUT_MAX) }; },
    // État d'un événement : à venir (avant le jour et l'heure de début), en cours, terminé (date passée ou course finie).
    etat(e) {
      if (e.statut === 'brouillon') return 'brouillon';
      if (e.retire_le) return 'retire';
      if (e.cloture_le) return 'termine';
      const now = maintenant(); const a = aujourdhui();
      if (a < e.debut || (a === e.debut && e.heure && now.toISOString().slice(11, 16) < e.heure)) return 'a_venir';
      return a > e.fin ? 'termine' : 'en_cours';
    },
    un(id) { return lire(q.un.get(Number(id))); },
    actifs() { return q.actifs.all(aujourdhui()).map(lire); },
    tous(n = 200) { return q.tous.all(n).map(lire); },
    STATS, RANGS,
    estGlobal(e) { return Object.keys(STATS).every((x) => (e.stats || []).includes(x)); },
    // Délais en jours (pas de dates) : attente avant le début, durée (0 = indéfinie). enLigne : mis en ligne tout de suite.
    creer({ titre, description, objectif, banniere, affiche, couleur, debut, fin, conditions = {}, stats = [], reglesPoints, reglesValidation, badgeNom, badges = {},
      attenteJours, dureeJours, indefinie = false, heure, gagnants = 3, paliers = {}, enLigne = false, couleurs = {} }) {
      const t = String(titre || '').trim().slice(0, 80); const d = String(description || '').trim().slice(0, 3000);
      if (!t || !d) return { erreur: 'Donne un titre et une description.' };
      const parDelais = attenteJours !== undefined || dureeJours !== undefined || indefinie;
      const brouillon = parDelais ? !enLigne : !debut && !fin;
      if (!parDelais && !brouillon) { const v = api.verifierDates(debut, fin); if (v.erreur) return v; }
      const att = Math.round(Number(attenteJours)); const dur = indefinie ? 0 : Math.round(Number(dureeJours));
      if (parDelais) {
        if (!(att >= DEBUT_MIN && att <= DEBUT_MAX)) return { erreur: `L'attente avant le début : de ${DEBUT_MIN} à ${DEBUT_MAX} jours.` };
        if (!indefinie && !(dur >= DUREE_MIN && dur <= DUREE_MAX)) return { erreur: `La durée : de ${DUREE_MIN} à ${DUREE_MAX} jours, ou indéfinie.` };
      }
      const hr = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(heure || '')) ? String(heure) : null;
      const g = Math.min(3, Math.max(1, Math.round(Number(gagnants)) || 3));
      // Conditions : au plus un trophée par famille.
      const cond = {};
      for (const [fam] of FAMILLES) { const c = String(conditions[fam] || ''); if (TROPHEES.some((x) => x.cle === c && x.famille === fam)) cond[fam] = c; }
      const st = Object.keys(STATS).filter((x) => [].concat(stats || []).includes(x));
      if (!st.length) return { erreur: 'Choisis au moins une stat à suivre (argent, vues ou abonnés).' };
      // Course : un palier par stat suivie.
      const pal = {};
      for (const s of st) {
        const n = Number(String((paliers || {})[s] ?? '').replace(/[\s\u00a0\u202f$,]/g, ''));
        if (Number.isFinite(n) && n > 0) pal[s] = n;
      }
      if (parDelais && Object.keys(pal).length !== st.length) return { erreur: `Donne le palier à atteindre pour chaque stat suivie (${st.map((x) => STATS[x]).join(', ')}).` };
      if (indefinie && !Object.keys(pal).length) return { erreur: 'Une durée indéfinie demande un palier à atteindre.' };
      const rv = String(reglesValidation || '').trim().slice(0, 2000);
      const rp = String(reglesPoints || '').trim().slice(0, 2000) || (Object.keys(pal).length ? api.phraseCourse({ stats: st, paliers: pal, gagnants: g }) : '');
      if (!rp) return { erreur: 'Écris comment on gagne (attribution des points).' };
      const bn = String(badgeNom || '').trim().slice(0, 60) || t;
      const r = q.creer.run(t, d, String(objectif || '').trim().slice(0, 200) || null, banniere || null, affiche || null,
        /^#[0-9a-f]{6}$/i.test(String(couleur || '')) ? couleur : '#1a1a1a', debut || '', fin || '', JSON.stringify(cond), maintenant().toISOString(),
        JSON.stringify(st), rp, rv || null, bn, badges.or || null, badges.argent || null, badges.bronze || null);
      const id = Number(r.lastInsertRowid);
      const coul = Object.fromEntries(Object.keys(COULEURS).filter((k) => HEX.test(String((couleurs || {})[k] || ''))).map((k) => [k, couleurs[k]]));
      if (EFFETS[(couleurs || {}).effet]) coul.effet = couleurs.effet;
      db.prepare('UPDATE evenements SET gagnants = ?, paliers = ?, attente_jours = ?, duree_jours = ?, heure = ?, couleurs = ? WHERE id = ?')
        .run(g, Object.keys(pal).length ? JSON.stringify(pal) : null, parDelais ? att : null, parDelais ? dur : null, hr, Object.keys(coul).length ? JSON.stringify(coul) : null, id);
      if (coul.halo) db.prepare('UPDATE evenements SET couleur = ? WHERE id = ?').run(coul.halo, id);
      if (brouillon || parDelais) db.prepare("UPDATE evenements SET statut = 'brouillon', debut = '', fin = '' WHERE id = ?").run(id);
      if (parDelais && !brouillon) {
        const p = api.publier(id);
        if (p.erreur) return { ...p, evenement: api.un(id), brouillonGarde: true };
      }
      return { evenement: api.un(id) };
    },
    // L'étendard du challenge : le badge du plus haut niveau envoyé (or, sinon argent, sinon bronze).
    etendard(e) { return e.badge_or || e.badge_argent || e.badge_bronze || null; },
    // « Les inscriptions se terminent dans 5 jours » (avant le début), puis « Se termine dans 3 jours ».
    compteRebours(e) {
      const etat = api.etat(e);
      const dans = (jour, heure) => Math.max(0, Math.ceil((Date.parse(`${jour}T${heure || '00:00'}:00Z`) - maintenant().getTime()) / JOUR));
      const jours = (n) => (n <= 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : `dans ${n} jours`);
      if (etat === 'a_venir') return { etat, texte: `Les inscriptions se terminent ${jours(dans(e.debut, e.heure))}`, n: dans(e.debut, e.heure) };
      if (etat === 'en_cours') {
        if (e.fin === SANS_FIN) return { etat, texte: 'En cours : jusqu\'à ce que les gagnants atteignent le palier', n: null };
        const n = dans(ajouter(e.fin, 1), e.heure);
        return { etat, texte: n <= 1 ? 'Se termine aujourd\'hui' : `Se termine dans ${n} jours`, n };
      }
      return { etat, texte: etat === 'termine' ? 'Terminé' : '', n: null };
    },
    // « Les 3 premiers à atteindre $1 000 gagnent le badge. »
    phraseCourse(e) {
      const g = e.gagnants || 3;
      const qui = g === 1 ? 'Le premier' : `Les ${g} premiers`;
      const buts = (e.stats || []).filter((s) => e.paliers && e.paliers[s]).map((s) => api.palierLisible(s, e.paliers[s]));
      if (buts.length <= 1) return `${qui} à atteindre ${buts[0] || 'le palier'} depuis le début du challenge ${g === 1 ? 'gagne' : 'gagnent'} le badge.`;
      return `Une course par stat : ${buts.map((x) => `${qui.toLowerCase()} à ${x}`).join(', ')}, depuis le début du challenge, ${g === 1 ? 'gagne' : 'gagnent'} le badge.`;
    },
    palierLisible(s, v) {
      const n = Number(v) || 0;
      return s === 'revenus' ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} ${s === 'vues' ? 'vues' : 'abonnés'}`;
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
    // Mise en ligne : les dates partent d'aujourd'hui (délais du brouillon) ; anciens brouillons : dates données.
    publier(id, debut, fin) {
      const e = api.un(id);
      if (!e || e.statut !== 'brouillon') return { erreur: 'Ce brouillon n\'existe plus.' };
      if (e.attente_jours != null) {
        if (api.actifs().length >= MAX_ACTIFS) return { erreur: `Il y a déjà ${MAX_ACTIFS} événements à venir ou en cours.` };
        const deb = ajouter(aujourdhui(), e.attente_jours);
        const fi = e.duree_jours ? ajouter(deb, e.duree_jours - 1) : SANS_FIN;
        q.publier.run(deb, fi, e.heure || maintenant().toISOString().slice(11, 16), e.id);
        return { evenement: api.un(e.id) };
      }
      const v = api.verifierDates(debut, fin);
      if (v.erreur) return v;
      q.publier.run(debut, fin, e.heure || null, e.id);
      return { evenement: api.un(e.id) };
    },
    // Changer la bannière après coup (facultative).
    changerBanniere(id, image) { db.prepare('UPDATE evenements SET banniere = ? WHERE id = ?').run(image || null, Number(id)); },
    // Course : arrivées (dans l'ordre) et gagnants d'une stat.
    arrivees(e, st) { return q.arrivees.all(e.id, st); },
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
      const now = maintenant().toISOString();
      for (const brut of q.courses.all()) {
        const e = lire(brut);
        const etat = api.etat(e);
        if (etat === 'a_venir') continue;
        if (etat === 'en_cours') {
          // Nouveaux arrivés au palier (les plus hauts d'abord s'ils arrivent ensemble).
          const ins = api.inscrits(e.id).map((i) => ({ id: i.discord_id, ...valeurDe(e, i.discord_id) }));
          for (const st of e.stats) {
            const palier = e.paliers[st]; if (!palier) continue;
            ins.filter((x) => (x[st] || 0) >= palier).sort((a, b) => (b[st] || 0) - (a[st] || 0)).forEach((x) => q.arriver.run(e.id, st, x.id, x[st] || 0, now));
          }
        }
        let complet = true;
        for (const st of e.stats) {
          const arr = q.arrivees.all(e.id, st).slice(0, e.gagnants);
          if (arr.length < e.gagnants) complet = false;
          arr.forEach((x, i) => { if (q.donner.run(x.discord_id, e.id, st, i + 1, x.valeur, now).changes) donnes.push({ discordId: x.discord_id, evenement: e, stat: st, rang: i + 1 }); });
        }
        if (complet || etat === 'termine') q.cloturer.run(now, e.id);
      }
      for (const brut of q.aCloturer.all(aujourdhui())) {
        const e = lire(brut);
        if (estCourse(e)) continue;
        if (!q.cloturer.run(maintenant().toISOString(), e.id).changes) continue;
        const c = api.classements(e, (id) => valeurDe(e, id));
        for (const st of e.stats) {
          for (const x of c[st].filter((y) => y.valeur > 0).slice(0, e.gagnants)) {
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

module.exports = { creerEvenements, DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS, STATS, RANGS, SANS_FIN, COULEURS, EFFETS };
