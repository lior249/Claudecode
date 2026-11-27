'use strict';

const { lienVideo } = require('./tiktok');

// Étape 4 de l'accompagnement Elite : publication et suivi quotidien (docs/ACCOMPAGNEMENT-ELITE.md).
//  - le membre choisit 3 heures fixes (création, publication, compte rendu), dans son fuseau horaire ;
//  - chaque jour, il déclare ses vidéos publiées (leur lien, une seule fois par vidéo) : au moins une par jour ;
//  - le lendemain, il envoie le compte rendu de ce jour-là (statistiques, revenus, capture des revenus, question) ;
//  - le coach valide ou demande des modifications ; les revenus validés font avancer les objectifs,
//    GOAT (1 000 € sur 28 jours) et les rôles de revenus (1 500, 5 000, 10 000 € au total), confirmés par le coach.

const JOUR = 24 * 3600 * 1000;
// Les objectifs, dans l'ordre : on montre le premier pas encore atteint.
const OBJECTIFS = [['vues', 1e4], ['abonnes', 1e3], ['vues', 1e5], ['abonnes', 5e3], ['abonnes', 1e4], ['vues', 1e6],
  ['revenus', 50], ['revenus', 100], ['revenus', 500], ['revenus', 1000], ['revenus', 1500], ['revenus', 5000], ['revenus', 10000]]
  .map(([type, seuil]) => ({ type, seuil, montant: type === 'revenus' ? seuil : null,
    libelle: type === 'revenus' ? `$${seuil.toLocaleString('en-US')}` : `${seuil.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} ${type === 'vues' ? 'vues' : 'abonnés'}` }));
const ROLES_REVENUS = [1500, 5000, 10000];
const SEUIL_GOAT = 1000;
const FENETRE_GOAT_JOURS = 28;
const QUESTIONS = [
  'Mes vidéos ne font pas autant de vues que je l\'espérais.',
  'Mon compte bloque entre 0 et 200 vues.',
  'Je ne gagne pas assez d\'abonnés.',
  'Est-ce que j\'ai mal appliqué quelque chose sur mes vidéos ?',
];
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Montant recopié de TikTok : « $1,308.95 », « 1 308,95 », « 186 », « 186.5 »… → nombre (null si illisible).
function lireMontant(v) {
  let s = String(v ?? '').trim().replace(/[$€\s\u00a0\u202f]/g, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  const virgule = s.lastIndexOf(',');
  const point = s.lastIndexOf('.');
  if (virgule >= 0 && point >= 0) s = virgule > point ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (virgule >= 0) s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (point >= 0 && !(/\.\d{1,2}$/.test(s) && s.split('.').length === 2)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
// Gains du jour à partir des totaux du tableau de bord (vue Par mois) : total − total précédent du même mois ;
// le premier total d'un mois est le gain de ce jour (le compte part de 0 à l'étape 4).
function gainsDepuisTotaux(lignes) {
  let mois = null; let precedent = 0;
  return lignes.map((l) => {
    const m = l.jour.slice(0, 7);
    if (m !== mois) { mois = m; precedent = 0; }
    const gain = Math.round((l.total_mois - precedent) * 100) / 100;
    precedent = l.total_mois;
    return { jour: l.jour, total: l.total_mois, gain, etat: l.etat };
  });
}

function fuseauValide(f) {
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: f }).format(new Date()); return true; } catch { return false; }
}
// Date (AAAA-MM-JJ) et heure (HH:MM) d'un instant dans le fuseau du membre.
function jourDans(fuseau, d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function heureDans(fuseau, d) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: fuseau || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return h.replace(/^24/, '00');
}
// Minuit (fin du jour) chez le membre : l'instant où son « jour » se termine.
function finDuJour(fuseau, jour) {
  const suivant = new Date(Date.parse(`${jour}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const essai = Date.parse(`${suivant}T00:00:00Z`);
  const local = (t) => {
    const d = new Date(t);
    return Date.parse(`${jourDans(fuseau, d)}T${new Intl.DateTimeFormat('en-GB', { timeZone: fuseau || 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d)}Z`);
  };
  return new Date(essai - (local(essai) - essai));
}
// « lundi 24 novembre » : les dates du suivi telles que le membre et le coach les lisent.
const jourLisible = (jour) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const moisLisible = (jour) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
const decalerJour = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

function creerSuivi({ db, parcours, maintenant = () => new Date() }) {
  const q = {
    heures: db.prepare('UPDATE parcours SET fuseau = ?, heure_creation = ?, heure_publication = ?, heure_compte_rendu = ?, maj_le = ? WHERE discord_id = ?'),
    publier: db.prepare('INSERT OR IGNORE INTO publications (discord_id, jour, lien, cree_le) VALUES (?, ?, ?, ?)'),
    lienConnu: db.prepare('SELECT 1 FROM publications WHERE lien = ?'),
    publicationsJour: db.prepare('SELECT * FROM publications WHERE discord_id = ? AND jour = ? ORDER BY id'),
    joursPublies: db.prepare('SELECT jour, COUNT(*) n FROM publications WHERE discord_id = ? GROUP BY jour ORDER BY jour'),
    capture: db.prepare('INSERT INTO captures_jour (discord_id, jour, image, cree_le) VALUES (?, ?, ?, ?) ON CONFLICT(discord_id, jour) DO UPDATE SET image = excluded.image'),
    captureJour: db.prepare('SELECT * FROM captures_jour WHERE discord_id = ? AND jour = ?'),
    cr: db.prepare('SELECT * FROM comptes_rendus WHERE id = ?'),
    crJour: db.prepare('SELECT * FROM comptes_rendus WHERE discord_id = ? AND jour = ?'),
    crMembre: db.prepare('SELECT * FROM comptes_rendus WHERE discord_id = ? ORDER BY jour DESC'),
    crAttente: db.prepare("SELECT * FROM comptes_rendus WHERE etat = 'attente' ORDER BY envoye_le"),
    crEnregistrer: db.prepare(`INSERT INTO comptes_rendus (discord_id, jour, etat, total_mois, abonnes_total, vues_total, abonnes_jour, vues_jour, pays_vues, pays_abonnes, capture_revenus, question, envoye_le, cree_le)
      VALUES (?, ?, 'attente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_id, jour) DO UPDATE SET etat = 'attente', total_mois = excluded.total_mois, abonnes_total = excluded.abonnes_total, vues_total = excluded.vues_total,
        abonnes_jour = excluded.abonnes_jour, vues_jour = excluded.vues_jour, pays_vues = excluded.pays_vues, pays_abonnes = excluded.pays_abonnes,
        capture_revenus = excluded.capture_revenus, question = excluded.question, envoye_le = excluded.envoye_le, decide_le = NULL`),
    statVideo: db.prepare(`INSERT INTO stats_videos (compte_rendu_id, publication_id, vues, abonnes, heure, visionnage_s, retention_10s, revenus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(compte_rendu_id, publication_id) DO UPDATE SET vues = excluded.vues, abonnes = excluded.abonnes, heure = excluded.heure,
        visionnage_s = excluded.visionnage_s, retention_10s = excluded.retention_10s, revenus = excluded.revenus`),
    statsCr: db.prepare('SELECT s.*, p.lien FROM stats_videos s JOIN publications p ON p.id = s.publication_id WHERE s.compte_rendu_id = ? ORDER BY p.id'),
    decider: db.prepare('UPDATE comptes_rendus SET etat = ?, decide_le = ? WHERE id = ?'),
    totaux: db.prepare("SELECT jour, total_mois, etat FROM comptes_rendus WHERE discord_id = ? AND total_mois IS NOT NULL AND etat != 'corriger' ORDER BY jour"),
    dernierCr: db.prepare("SELECT * FROM comptes_rendus WHERE discord_id = ? AND etat != 'corriger' ORDER BY jour DESC LIMIT 1"),
    paysCr: db.prepare("SELECT pays_abonnes FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide'"),
    recompense: db.prepare('SELECT * FROM recompenses WHERE discord_id = ? AND role = ?'),
    recompenses: db.prepare('SELECT * FROM recompenses WHERE discord_id = ?'),
    atteint: db.prepare('INSERT OR IGNORE INTO recompenses (discord_id, role, atteint_le) VALUES (?, ?, ?)'),
    confirmer: db.prepare('UPDATE recompenses SET confirme_le = ? WHERE discord_id = ? AND role = ? AND confirme_le IS NULL'),
    aConfirmer: db.prepare('SELECT * FROM recompenses WHERE confirme_le IS NULL ORDER BY atteint_le'),
    etape: db.prepare('UPDATE parcours SET etape = ?, etape_depuis = ?, maj_le = ? WHERE discord_id = ?'),
    // Résultats par vidéo.
    pub: db.prepare('SELECT * FROM publications WHERE id = ?'),
    pubsMembre: db.prepare('SELECT * FROM publications WHERE discord_id = ? ORDER BY jour DESC, id DESC'),
    pubResultat: db.prepare("UPDATE publications SET res_vues = ?, res_revenus = ?, res_captures = ?, res_etat = 'attente', res_envoye_le = ?, res_decide_le = NULL WHERE id = ?"),
    pubDecision: db.prepare('UPDATE publications SET res_etat = ?, res_decide_le = ?, ok_vues = CASE WHEN ? THEN res_vues ELSE ok_vues END, ok_revenus = CASE WHEN ? THEN res_revenus ELSE ok_revenus END WHERE id = ?'),
    pubsAttente: db.prepare("SELECT * FROM publications WHERE res_etat = 'attente' ORDER BY res_envoye_le"),
    revenusVideos: db.prepare('SELECT COALESCE(SUM(ok_revenus), 0) r, COALESCE(SUM(ok_vues), 0) v FROM publications WHERE discord_id = ?'),
    updatesMembre: db.prepare("SELECT jour, etat, vues_28j, revenus_28j FROM comptes_rendus WHERE discord_id = ? AND (revenus_28j IS NOT NULL OR vues_28j IS NOT NULL) AND etat IN ('valide', 'attente') ORDER BY jour"),
    dernierUpdate: db.prepare("SELECT * FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide' AND revenus_28j IS NOT NULL ORDER BY jour DESC LIMIT 1"),
    dernierVues: db.prepare("SELECT vues_28j FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide' AND vues_28j IS NOT NULL ORDER BY jour DESC LIMIT 1"),
    abonnesValides: db.prepare("SELECT abonnes FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide' AND abonnes IS NOT NULL ORDER BY jour DESC LIMIT 1"),
    updateEnregistrer: db.prepare(`INSERT INTO comptes_rendus (discord_id, jour, etat, vues_28j, revenus_28j, capture_revenus, question, envoye_le, cree_le)
      VALUES (?, ?, 'attente', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_id, jour) DO UPDATE SET etat = 'attente', vues_28j = excluded.vues_28j, revenus_28j = excluded.revenus_28j,
        capture_revenus = excluded.capture_revenus, question = excluded.question, envoye_le = excluded.envoye_le, decide_le = NULL`),
  };
  const DELAI_RESULTAT = 24 * 3600 * 1000;
  const captures = (pub) => { try { return JSON.parse(pub.res_captures || '[]'); } catch { return []; } };
  const iso = () => maintenant().toISOString();
  const entier = (v) => { const n = Number(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
  const decimal = (v) => { const n = Number(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };

  const api = {
    QUESTIONS,
    OBJECTIFS,
    ROLES_REVENUS,
    SEUIL_GOAT,
    jourDans,
    heureDans,

    aujourdhui(p) { return jourDans(p.fuseau, maintenant()); },

    choisirHeures(discordId, { creation, publication, compteRendu, fuseau }) {
      if (![creation, publication, compteRendu].every((h) => HEURE.test(String(h || '')))) return { erreur: 'Choisis tes trois heures.' };
      const f = fuseauValide(fuseau) ? fuseau : 'UTC';
      q.heures.run(f, creation, publication, compteRendu, iso(), discordId);
      return { parcours: parcours.get(discordId) };
    },

    // Déclaration des vidéos publiées aujourd'hui : leurs liens TikTok (un lien déjà déclaré est refusé).
    declarer(discordId, { liens = [], capture }) {
      const p = parcours.get(discordId);
      if (!p || p.etape < 4) return { erreur: 'Tu n\'es pas encore autorisé à publier.' };
      if (!p.heure_publication) return { erreur: 'Choisis d\'abord tes heures.' };
      const bruts = liens.map((l) => String(l).trim()).filter(Boolean);
      if (!bruts.length) return { erreur: 'Colle le lien de ta vidéo TikTok.' };
      const propres = [];
      for (const l of bruts) {
        const v = lienVideo(l);
        if (!v) return { erreur: `Ce lien n'est pas un lien TikTok : ${l.slice(0, 80)}` };
        // Chaque vidéo une seule fois : un lien déjà déclaré (par lui ou par un autre) est refusé.
        if (q.lienConnu.get(v)) return { erreur: 'Cette vidéo a déjà été postée : colle le lien d\'une nouvelle vidéo.' };
        if (!propres.includes(v)) propres.push(v);
      }
      const jour = api.aujourdhui(p);
      if (capture) q.capture.run(discordId, jour, capture, iso()); // la capture du compte n'est plus demandée
      for (const l of propres.slice(0, 20)) q.publier.run(discordId, jour, l, iso());
      return { jour, publications: q.publicationsJour.all(discordId, jour) };
    },
    publications(discordId, jour) { return q.publicationsJour.all(discordId, jour); },
    captureDuJour(discordId, jour) { return q.captureJour.get(discordId, jour) || null; },

    // Jours dont le compte rendu reste à faire (publiés avant aujourd'hui, sans compte rendu) ou à corriger.
    // Updates du compte à faire : celui d'aujourd'hui (à partir de son heure), et ceux à corriger.
    comptesRendusAFaire(discordId) {
      const p = parcours.get(discordId);
      if (!p || !p.fuseau || p.etape < 4 || !p.heure_compte_rendu) return [];
      const aujourdhui = api.aujourdhui(p);
      const liste = q.crMembre.all(discordId).filter((c) => c.etat === 'corriger').map((c) => ({ jour: c.jour, cr: c }));
      const heure = heureDans(p.fuseau, maintenant());
      if (!q.crJour.get(discordId, aujourdhui) && heure >= p.heure_compte_rendu) liste.unshift({ jour: aujourdhui, cr: null });
      return liste;
    },
    // Vidéos dont les résultats sont à remplir (24 h après la publication) ou à corriger.
    videosAFaire(discordId) {
      const limite = maintenant().getTime() - DELAI_RESULTAT;
      return q.pubsMembre.all(discordId).filter((v) => (!v.res_etat && Date.parse(v.cree_le) <= limite) || v.res_etat === 'corriger').reverse();
    },
    videos(discordId) { return q.pubsMembre.all(discordId).map((v) => ({ ...v, captures: captures(v), pret: Date.parse(v.cree_le) <= maintenant().getTime() - DELAI_RESULTAT })); },
    video(id) { const v = q.pub.get(Number(id)); return v ? { ...v, captures: captures(v), pret: Date.parse(v.cree_le) <= maintenant().getTime() - DELAI_RESULTAT } : null; },
    resultatsEnAttente() { return q.pubsAttente.all().map((v) => ({ ...v, captures: captures(v), parcours: parcours.get(v.discord_id) })); },
    // Résultats d'une vidéo : capture (ajoutée aux précédentes), vues et revenus. 24 h après la publication ; mise à jour possible ensuite.
    // Résultats d'une vidéo (24 h après) : la capture, les vues, les abonnés gagnés ; et, une fois monétisé, les revenus et le RPM.
    // Monétisé mais TikTok n'a pas encore mis à jour les revenus : rappel à l'heure choisie (rappelRevenus), rien n'est envoyé.
    enregistrerResultat(discordId, id, { vues, abonnes, revenus, rpm, capture, rappelRevenus } = {}) {
      const v = q.pub.get(Number(id));
      if (!v || v.discord_id !== discordId) return { erreur: 'Vidéo introuvable.' };
      if (Date.parse(v.cree_le) > maintenant().getTime() - DELAI_RESULTAT) return { erreur: 'Les résultats se donnent 24 h après la publication.' };
      const p = parcours.get(discordId);
      const monetise = Boolean(p && p.monetisation_etat === 'acceptee');
      if (monetise && rappelRevenus) {
        const quand = new Date(rappelRevenus);
        if (Number.isNaN(quand.getTime()) || quand <= maintenant()) return { erreur: 'Choisis une heure de rappel à venir.' };
        db.prepare('UPDATE publications SET revenus_rappel_le = ? WHERE id = ?').run(quand.toISOString(), v.id);
        return { video: api.video(v.id), rappel: quand.toISOString() };
      }
      const nv = entier(vues);
      const na = entier(abonnes);
      if (nv === null) return { erreur: 'Indique le nombre de vues de la vidéo.' };
      if (na === null) return { erreur: 'Indique les abonnés gagnés avec cette vidéo, 0 si aucun.' };
      let nr = null; let nrpm = null;
      if (monetise) {
        nr = lireMontant(revenus); nrpm = lireMontant(rpm);
        if (nr === null || nr < 0) return { erreur: 'Indique les revenus de la vidéo ($), 0 si rien.' };
        if (nrpm === null || nrpm < 0) return { erreur: 'Indique le RPM de la vidéo ($).' };
      }
      const liste = captures(v);
      if (capture && !liste.includes(capture)) liste.push(capture);
      if (!liste.length) return { erreur: 'Ajoute la capture des résultats de la vidéo.' };
      q.pubResultat.run(nv, nr, JSON.stringify(liste.slice(-10)), iso(), v.id);
      db.prepare('UPDATE publications SET res_abonnes = ?, res_rpm = ?, revenus_rappel_le = NULL WHERE id = ?').run(na, nrpm, v.id);
      return { video: api.video(v.id) };
    },
    // Rappels « reviens faire l'update de ta vidéo » arrivés à l'heure (appelés toutes les minutes).
    rappelsRevenusDus() {
      const dus = db.prepare("SELECT * FROM publications WHERE revenus_rappel_le IS NOT NULL AND revenus_rappel_le <= ? AND (res_etat IS NULL OR res_etat = 'corriger')").all(iso());
      for (const v of dus) db.prepare('UPDATE publications SET revenus_rappel_le = NULL WHERE id = ?').run(v.id);
      return dus;
    },
    deciderResultat(id, decision, { texte, images = [] } = {}) {
      const v = q.pub.get(Number(id));
      if (!v) return { erreur: 'Vidéo introuvable.' };
      if (v.res_etat !== 'attente') return { erreur: 'Ces résultats ont déjà été traités.' };
      if (!['valider', 'corriger'].includes(decision)) return { erreur: 'Décision inconnue.' };
      const mot = String(texte || '').trim();
      if (decision === 'corriger' && !mot) return { erreur: 'Écris ce qu\'il doit corriger.' };
      const ok = decision === 'valider' ? 1 : 0;
      q.pubDecision.run(ok ? 'valide' : 'corriger', iso(), ok, ok, v.id);
      if (ok) db.prepare('UPDATE publications SET ok_abonnes = res_abonnes, ok_rpm = res_rpm WHERE id = ?').run(v.id);
      if (mot || images.length) parcours.ajouterRemarque(v.discord_id, { texte: `Résultats de ta vidéo du ${jourLisible(v.jour)} : ${mot || '(image)'}`, images, type: ok ? 'valide' : 'corriger' });
      return { video: api.video(v.id), nouvelles: ok ? api.verifierRecompenses(v.discord_id) : [] };
    },
    compteRendu(discordId, jour) {
      const cr = q.crJour.get(discordId, jour);
      return cr ? { ...cr, pays_vues: JSON.parse(cr.pays_vues || '[]'), pays_abonnes: JSON.parse(cr.pays_abonnes || '[]'), videos: q.statsCr.all(cr.id) } : null;
    },
    compteRenduParId(id) {
      const cr = q.cr.get(Number(id));
      return cr ? api.compteRendu(cr.discord_id, cr.jour) : null;
    },
    comptesRendus(discordId) { return q.crMembre.all(discordId); },

    // Update du compte (fin de journée) : capture des 28 derniers jours, vues et revenus sur 28 jours. Aujourd'hui, ou hier en retard.
    enregistrerCompteRendu(discordId, jour, d) {
      const p = parcours.get(discordId);
      if (!p || p.etape < 4) return { erreur: 'Tu n\'es pas encore à l\'étape 4.' };
      const aujourdhui = api.aujourdhui(p);
      const deja = q.crJour.get(discordId, jour);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour > aujourdhui || (jour < decalerJour(aujourdhui, -1) && !(deja && deja.etat === 'corriger'))) return { erreur: 'L\'update du compte se fait chaque jour, pour le jour même.' };
      if (deja && deja.etat === 'valide') return { erreur: 'Cet update est déjà validé.' };
      // Les abonnés actuels ; les vues des 28 derniers jours ; les revenus seulement une fois la monétisation validée.
      const monetise = p.monetisation_etat === 'acceptee';
      const abonnes = entier(d.abonnes);
      const vues = entier(d.vues_28j);
      const revenus = monetise ? lireMontant(d.revenus_28j) : null;
      if (abonnes === null) return { erreur: 'Indique tes abonnés actuels.' };
      if (vues === null) return { erreur: 'Indique les vues de ton compte sur les 28 derniers jours.' };
      if (monetise && (revenus === null || revenus < 0)) return { erreur: 'Indique tes revenus sur les 28 derniers jours ($), 0 si rien.' };
      if (!d.capture && !(deja && deja.capture_revenus)) return { erreur: 'Ajoute la capture de tes résultats des 28 derniers jours.' };
      const question = String(d.question || '').trim().slice(0, 1000) || null;
      q.updateEnregistrer.run(discordId, jour, vues, revenus, d.capture || deja.capture_revenus, question, iso(), iso());
      db.prepare('UPDATE comptes_rendus SET abonnes = ? WHERE discord_id = ? AND jour = ?').run(abonnes, discordId, jour);
      // Abonnés à jour ; cap des 10 000 franchi : le formulaire de monétisation s'ouvre.
      db.prepare('UPDATE parcours SET abonnes_actuels = ? WHERE discord_id = ?').run(abonnes, discordId);
      const dixK = abonnes >= 10000 && !p.monetisation_etat;
      if (dixK) db.prepare("UPDATE parcours SET monetisation_etat = 'a_faire' WHERE discord_id = ?").run(discordId);
      return { compteRendu: api.compteRendu(discordId, jour), dixK };
    },

    decider(id, decision, { texte, images = [] } = {}) {
      const cr = q.cr.get(Number(id));
      if (!cr) return { erreur: 'Compte rendu introuvable.' };
      if (cr.etat !== 'attente') return { erreur: 'Ce compte rendu a déjà été traité.' };
      if (!['valider', 'corriger'].includes(decision)) return { erreur: 'Décision inconnue.' };
      const mot = String(texte || '').trim();
      if (decision === 'corriger' && !mot) return { erreur: 'Écris ce qu\'il doit corriger.' };
      q.decider.run(decision === 'valider' ? 'valide' : 'corriger', iso(), cr.id);
      if (mot || images.length) parcours.ajouterRemarque(cr.discord_id, { texte: `Update du compte du ${jourLisible(cr.jour)} : ${mot || '(image)'}`, images, type: decision === 'valider' ? 'valide' : 'corriger' });
      return { compteRendu: api.compteRendu(cr.discord_id, cr.jour), nouvelles: decision === 'valider' ? api.verifierRecompenses(cr.discord_id) : [] };
    },
    enAttente() { return q.crAttente.all().map((cr) => ({ ...cr, parcours: parcours.get(cr.discord_id) })); },

    // Cumul des revenus et des vues, reconstruit à partir des updates du compte (valeurs des 28 derniers jours, plus fiables
    // que la somme des vidéos). La première update compte entièrement : c'est la base. Ensuite, chaque jour,
    //   cumul(t) = valeur 28 jours(t) + cumul(t − 28)   (ce qui est sorti de la fenêtre a déjà été compté),
    // et, tant qu'on n'a pas 28 jours de recul, au moins le cumul précédent + la hausse de la fenêtre. Jamais en baisse.
    // valides : seulement les updates validées (objectifs, rôles) ; sinon aussi celles en attente (tableau de bord).
    cumul(discordId, { valides = false } = {}) {
      const lignes = q.updatesMembre.all(discordId).filter((u) => !valides || u.etat === 'valide');
      const serie = [];
      const avant = (jour) => { let r = null; for (const x of serie) { if (x.jour <= jour) r = x; else break; } return r; };
      const arrondi = (n) => Math.round(n * 100) / 100;
      for (const u of lignes) {
        const R = Number(u.revenus_28j) || 0; const V = Number(u.vues_28j) || 0;
        const prec = serie[serie.length - 1];
        let revenus = R; let vues = V;
        if (prec) {
          const base = avant(decalerJour(u.jour, -FENETRE_GOAT_JOURS));
          revenus = Math.max(prec.revenus, prec.revenus + Math.max(0, R - prec.R), R + (base ? base.revenus : 0));
          vues = Math.max(prec.vues, prec.vues + Math.max(0, V - prec.V), V + (base ? base.vues : 0));
        }
        serie.push({ jour: u.jour, etat: u.etat, R, V, revenus: arrondi(revenus), vues: Math.round(vues) });
      }
      return serie;
    },
    // Revenus et vues gagnés depuis un jour (inclus), d'après le cumul des updates validées.
    periode(discordId, depuis) {
      const serie = api.cumul(discordId, { valides: true });
      if (!serie.length) return { revenus: 0, vues: 0, updates: 0 };
      const dernier = serie[serie.length - 1];
      const base = serie.filter((x) => x.jour < depuis).pop();
      return { revenus: Math.round((dernier.revenus - (base ? base.revenus : 0)) * 100) / 100, vues: dernier.vues - (base ? base.vues : 0),
        updates: serie.filter((x) => x.jour >= depuis).length };
    },
    // Revenus et vues gagnés entre deux jours (inclus), d'après le cumul des updates validées (classement d'un événement).
    entre(discordId, debut, fin) {
      // Tout le monde part de 0 au début : la base est la dernière update validée avant le début, sinon la première de la période.
      const serie = api.cumul(discordId, { valides: true });
      const dans = serie.filter((x) => x.jour >= debut && x.jour <= fin);
      const base = serie.filter((x) => x.jour < debut).pop() || dans[0];
      const haut = dans[dans.length - 1];
      const ab = db.prepare("SELECT jour, abonnes FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide' AND abonnes IS NOT NULL AND jour <= ? ORDER BY jour").all(discordId, fin);
      const abDans = ab.filter((x) => x.jour >= debut);
      const abBase = ab.filter((x) => x.jour < debut).pop() || abDans[0];
      const abHaut = abDans[abDans.length - 1];
      return {
        revenus: haut && base ? Math.max(0, Math.round((haut.revenus - base.revenus) * 100) / 100) : 0,
        vues: haut && base ? Math.max(0, haut.vues - base.vues) : 0,
        abonnes: abHaut && abBase ? Math.max(0, Number(abHaut.abonnes) - Number(abBase.abonnes)) : 0,
      };
    },
    // Gains jour par jour (différence de cumul d'une update à l'autre), total du mois.
    gains(discordId, { valides = false } = {}) {
      let mois = null; let cumulMois = 0; let precedent = 0;
      return api.cumul(discordId, { valides }).map((x) => {
        const gain = Math.round((x.revenus - precedent) * 100) / 100;
        precedent = x.revenus;
        if (x.jour.slice(0, 7) !== mois) { mois = x.jour.slice(0, 7); cumulMois = 0; }
        cumulMois = Math.round((cumulMois + gain) * 100) / 100;
        return { jour: x.jour, gain, total: cumulMois, etat: x.etat, cumul: x.revenus };
      });
    },
    // Données du tableau de bord (page Mon profil) : j = jour, g = gain, t = total du mois, e = état.
    tableau(discordId) {
      const p = parcours.get(discordId);
      return { aujourdhui: p && p.fuseau ? api.aujourdhui(p) : maintenant().toISOString().slice(0, 10),
        jours: api.gains(discordId).map((g) => ({ j: g.jour, g: g.gain, t: g.total, e: g.etat })) };
    },
    // Dernier total connu du même mois avant ce jour (pour afficher le calcul dans le compte rendu).
    totalPrecedent(discordId, jour) {
      const l = q.totaux.all(discordId).filter((x) => x.jour < jour && x.jour.slice(0, 7) === jour.slice(0, 7)).pop();
      return l ? { jour: l.jour, total: l.total_mois, etat: l.etat } : null;
    },

    // Statistiques de la fiche (comptes rendus validés).
    stats(discordId) {
      const p = parcours.get(discordId);
      if (!p) return null;
      const aujourdhui = p.fuseau ? api.aujourdhui(p) : maintenant().toISOString().slice(0, 10);
      const dernier = q.dernierUpdate.get(discordId);
      const compte = {};
      for (const r of q.paysCr.all(discordId)) { const premier = JSON.parse(r.pays_abonnes || '[]')[0]; if (premier) compte[premier] = (compte[premier] || 0) + 1; }
      const paysPrincipal = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
      const jours = q.joursPublies.all(discordId);
      const debut = p.etape >= 4 ? (p.etape3_le ? p.etape3_le.slice(0, 10) : (jours[0] && jours[0].jour) || null) : null;
      const joursDepuis = debut ? Math.max(1, Math.round((Date.parse(`${aujourdhui}T12:00:00Z`) - Date.parse(`${debut}T12:00:00Z`)) / JOUR) + 1) : 0;
      const arrondi = (n) => Math.round(n * 100) / 100;
      const videos = q.revenusVideos.get(discordId);
      const serie = api.cumul(discordId, { valides: true });
      const fin = serie[serie.length - 1];
      const total = fin ? fin.revenus : 0;
      const vues28 = q.dernierVues.get(discordId);
      const ab = q.abonnesValides.get(discordId);
      const abonnes = ab ? Number(ab.abonnes) : null;
      const valeurs = { vues: fin ? fin.vues : 0, abonnes: abonnes || 0, revenus: total };
      return {
        abonnes,
        vues: vues28 ? vues28.vues_28j : null,
        vuesTotal: fin ? fin.vues : 0,
        vuesVideos: videos.v,
        paysPrincipal: paysPrincipal ? paysPrincipal[0] : null,
        revenusTotal: total,
        revenus28: dernier ? arrondi(dernier.revenus_28j) : 0,
        joursPublies: jours.length,
        videosPubliees: jours.reduce((n, j) => n + j.n, 0),
        joursDepuisEtape4: joursDepuis,
        objectifs: OBJECTIFS.map((o) => ({ ...o, valeur: valeurs[o.type], atteint: valeurs[o.type] >= o.seuil })),
      };
    },

    // Seuils atteints (revenus validés) : GOAT et rôles de revenus, à confirmer par le coach. Renvoie les nouveaux.
    verifierRecompenses(discordId) {
      const s = api.stats(discordId);
      if (!s) return [];
      const nouvelles = [];
      const atteindre = (role) => { if (q.atteint.run(discordId, role, iso()).changes) nouvelles.push(role); };
      if (s.revenus28 >= SEUIL_GOAT) atteindre('goat');
      for (const r of ROLES_REVENUS) if (s.revenusTotal >= r) atteindre(String(r));
      return nouvelles;
    },
    recompenses(discordId) { return q.recompenses.all(discordId); },
    aConfirmer() { return q.aConfirmer.all().map((r) => ({ ...r, parcours: parcours.get(r.discord_id) })); },
    confirmerRecompense(discordId, role) {
      const r = q.recompense.get(discordId, String(role));
      if (!r) return { erreur: 'Rien à confirmer.' };
      if (r.confirme_le) return { erreur: 'Déjà confirmé.' };
      q.confirmer.run(iso(), discordId, String(role));
      if (String(role) === 'goat') q.etape.run(5, iso(), iso(), discordId);
      return { ok: true, parcours: parcours.get(discordId) };
    },

    // La tâche du moment à l'étape 4 (Mon parcours, rappels de Bob).
    tache(p) {
      // Passé à l'étape 4 par le coach sans avoir envoyé sa niche : on la lui demande d'abord (dans l'ordre du parcours).
      const st = parcours.strategie ? parcours.strategie(p.discord_id) : null;
      if (st && !st.envoye && !st.valide) {
        return { cle: 'strategie', titre: p.niche_refus ? 'Propose une autre niche' : 'Envoie ta niche', texte: 'Le nom de ta niche et une capture d’un compte exemple : ton coach la valide.',
          lien: '/parcours/etape-3#strategie', bouton: 'Ma niche' };
      }
      if (!p.compte_tiktok) {
        return { cle: 'tiktok', titre: 'Ajoute le lien de ton compte TikTok', texte: 'Il le faut pour commencer l\'étape 4 : c\'est le compte que ton coach suit.', lien: '/parcours/etape-4#compte', bouton: 'Ajouter mon compte' };
      }
      if (!p.heure_creation) {
        return { cle: 'heures', titre: 'Choisis tes 3 heures', texte: 'Création, publication et compte rendu : Bob te le rappellera chaque jour à ces heures.',
          lien: '/parcours/etape-4', bouton: 'Choisir mes heures', delai: { fin: new Date(new Date(p.etape_depuis).getTime() + 12 * 3600 * 1000).toISOString(), duree: 12 * 3600 * 1000 } };
      }
      const videos = api.videosAFaire(p.discord_id);
      if (videos.length) {
        const v = videos[0];
        return { cle: `video-${v.id}-${v.res_etat || 'neuf'}`, titre: v.res_etat === 'corriger' ? `Corrige les résultats de ta vidéo du ${jourLisible(v.jour)}` : `Donne les résultats de ta vidéo du ${jourLisible(v.jour)}`,
          texte: videos.length > 1 ? `${videos.length} vidéos à mettre à jour : capture, vues et revenus.` : 'Capture de ses résultats, vues et revenus après 24 h.',
          lien: `/parcours/videos/${v.id}`, bouton: 'Mettre à jour les résultats' };
      }
      const aFaire = api.comptesRendusAFaire(p.discord_id);
      if (aFaire.length) {
        const x = aFaire[0];
        const finCr = finDuJour(p.fuseau, x.jour);
        return { cle: `cr-${x.jour}`, titre: x.cr && x.cr.etat === 'corriger' ? `Corrige ton update du compte du ${jourLisible(x.jour)}` : 'Fais l\'update de ton compte',
          texte: 'Capture de tes résultats des 28 derniers jours, vues et revenus.',
          lien: `/parcours/compte-rendu/${x.jour}`, bouton: 'Update du compte', echeance: { fin: finCr.toISOString(), duree: 86400000 } };
      }
      if (!q.publicationsJour.all(p.discord_id, api.aujourdhui(p)).length) {
        return { echeance: { fin: finDuJour(p.fuseau, api.aujourdhui(p)).toISOString(), duree: 86400000 }, cle: 'publier', titre: 'Publie ta vidéo du jour', texte: 'Au moins une vidéo par jour, puis colle son lien ici.',
          lien: '/parcours/etape-4', bouton: 'Déclarer ma vidéo' };
      }
      return { cle: 'ok', titre: 'Ta vidéo du jour est déclarée', texte: 'Dans 24 h, tu donneras ses résultats ; ce soir, l\'update de ton compte.', lien: '/parcours/etape-4', bouton: 'Ouvrir l\'étape 4' };
    },

    // Prochains rappels quotidiens (Bob) : l'heure locale atteinte et pas encore envoyée aujourd'hui.
    rappelsDuMoment(p, now = maintenant()) {
      if (!p.fuseau || !p.heure_creation) return [];
      const minutes = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
      const maintenantMin = minutes(heureDans(p.fuseau, now));
      const jour = jourDans(p.fuseau, now);
      // Envoyé dans l'heure qui suit l'heure choisie (pas en pleine nuit si Bob redémarre plus tard).
      const dansLHeure = (h) => maintenantMin >= minutes(h) && maintenantMin < minutes(h) + 60;
      return [['creation', p.heure_creation], ['publication', p.heure_publication], ['compte-rendu', p.heure_compte_rendu]]
        .filter(([, h]) => h && dansLHeure(h)).map(([type]) => ({ type, jour }));
    },
  };
  return api;
}

module.exports = { finDuJour, creerSuivi, jourDans, heureDans, jourLisible, moisLisible, lireMontant, gainsDepuisTotaux, QUESTIONS, OBJECTIFS, ROLES_REVENUS };
