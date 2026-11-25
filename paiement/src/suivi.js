'use strict';

// Étape 4 de l'accompagnement Elite : publication et suivi quotidien (docs/ACCOMPAGNEMENT-ELITE.md).
//  - le membre choisit 3 heures fixes (création, publication, compte rendu), dans son fuseau horaire ;
//  - chaque jour, il déclare ses vidéos publiées (liens + capture du compte) : au moins une par jour ;
//  - le lendemain, il envoie le compte rendu de ce jour-là (statistiques, revenus, capture des revenus, question) ;
//  - le coach valide ou demande des modifications ; les revenus validés font avancer les objectifs,
//    GOAT (1 000 € sur 28 jours) et les rôles de revenus (1 500, 5 000, 10 000 € au total), confirmés par le coach.

const JOUR = 24 * 3600 * 1000;
const OBJECTIFS = [50, 500, 1000, 1500];
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
// « lundi 24 novembre » : les dates du suivi telles que le membre et le coach les lisent.
const jourLisible = (jour) => new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const decalerJour = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

function creerSuivi({ db, parcours, maintenant = () => new Date() }) {
  const q = {
    heures: db.prepare('UPDATE parcours SET fuseau = ?, heure_creation = ?, heure_publication = ?, heure_compte_rendu = ?, maj_le = ? WHERE discord_id = ?'),
    publier: db.prepare('INSERT OR IGNORE INTO publications (discord_id, jour, lien, cree_le) VALUES (?, ?, ?, ?)'),
    publicationsJour: db.prepare('SELECT * FROM publications WHERE discord_id = ? AND jour = ? ORDER BY id'),
    joursPublies: db.prepare('SELECT jour, COUNT(*) n FROM publications WHERE discord_id = ? GROUP BY jour ORDER BY jour'),
    capture: db.prepare('INSERT INTO captures_jour (discord_id, jour, image, cree_le) VALUES (?, ?, ?, ?) ON CONFLICT(discord_id, jour) DO UPDATE SET image = excluded.image'),
    captureJour: db.prepare('SELECT * FROM captures_jour WHERE discord_id = ? AND jour = ?'),
    cr: db.prepare('SELECT * FROM comptes_rendus WHERE id = ?'),
    crJour: db.prepare('SELECT * FROM comptes_rendus WHERE discord_id = ? AND jour = ?'),
    crMembre: db.prepare('SELECT * FROM comptes_rendus WHERE discord_id = ? ORDER BY jour DESC'),
    crAttente: db.prepare("SELECT * FROM comptes_rendus WHERE etat = 'attente' ORDER BY envoye_le"),
    crEnregistrer: db.prepare(`INSERT INTO comptes_rendus (discord_id, jour, etat, abonnes_total, vues_total, abonnes_jour, vues_jour, pays_vues, pays_abonnes, capture_revenus, question, envoye_le, cree_le)
      VALUES (?, ?, 'attente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_id, jour) DO UPDATE SET etat = 'attente', abonnes_total = excluded.abonnes_total, vues_total = excluded.vues_total,
        abonnes_jour = excluded.abonnes_jour, vues_jour = excluded.vues_jour, pays_vues = excluded.pays_vues, pays_abonnes = excluded.pays_abonnes,
        capture_revenus = excluded.capture_revenus, question = excluded.question, envoye_le = excluded.envoye_le, decide_le = NULL`),
    statVideo: db.prepare(`INSERT INTO stats_videos (compte_rendu_id, publication_id, vues, abonnes, heure, visionnage_s, retention_10s, revenus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(compte_rendu_id, publication_id) DO UPDATE SET vues = excluded.vues, abonnes = excluded.abonnes, heure = excluded.heure,
        visionnage_s = excluded.visionnage_s, retention_10s = excluded.retention_10s, revenus = excluded.revenus`),
    statsCr: db.prepare('SELECT s.*, p.lien FROM stats_videos s JOIN publications p ON p.id = s.publication_id WHERE s.compte_rendu_id = ? ORDER BY p.id'),
    decider: db.prepare('UPDATE comptes_rendus SET etat = ?, decide_le = ? WHERE id = ?'),
    revenusValides: db.prepare(`SELECT COALESCE(SUM(s.revenus), 0) total FROM stats_videos s JOIN comptes_rendus c ON c.id = s.compte_rendu_id
      WHERE c.discord_id = ? AND c.etat = 'valide' AND c.jour >= ?`),
    dernierCr: db.prepare("SELECT * FROM comptes_rendus WHERE discord_id = ? AND etat != 'corriger' ORDER BY jour DESC LIMIT 1"),
    paysCr: db.prepare("SELECT pays_abonnes FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide'"),
    recompense: db.prepare('SELECT * FROM recompenses WHERE discord_id = ? AND role = ?'),
    recompenses: db.prepare('SELECT * FROM recompenses WHERE discord_id = ?'),
    atteint: db.prepare('INSERT OR IGNORE INTO recompenses (discord_id, role, atteint_le) VALUES (?, ?, ?)'),
    confirmer: db.prepare('UPDATE recompenses SET confirme_le = ? WHERE discord_id = ? AND role = ? AND confirme_le IS NULL'),
    aConfirmer: db.prepare('SELECT * FROM recompenses WHERE confirme_le IS NULL ORDER BY atteint_le'),
    etape: db.prepare('UPDATE parcours SET etape = ?, etape_depuis = ?, maj_le = ? WHERE discord_id = ?'),
  };
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

    // Déclaration des vidéos publiées aujourd'hui : liens TikTok + capture du compte (une par jour).
    declarer(discordId, { liens = [], capture }) {
      const p = parcours.get(discordId);
      if (!p || p.etape < 4) return { erreur: 'Tu n\'es pas encore autorisé à publier.' };
      if (!p.heure_publication) return { erreur: 'Choisis d\'abord tes heures.' };
      const propres = [...new Set(liens.map((l) => String(l).trim()).filter(Boolean))];
      if (!propres.length) return { erreur: 'Colle le lien de ta vidéo TikTok.' };
      for (const l of propres) if (!/^https:\/\/([a-z0-9-]+\.)*tiktok\.com\/\S+$/i.test(l) || l.length > 400) return { erreur: `Ce lien n'est pas un lien TikTok : ${l.slice(0, 80)}` };
      const jour = api.aujourdhui(p);
      const deja = q.captureJour.get(discordId, jour);
      if (!capture && !deja) return { erreur: 'Ajoute la capture de ton compte : elle prouve tes publications du jour.' };
      if (capture) q.capture.run(discordId, jour, capture, iso());
      for (const l of propres.slice(0, 20)) q.publier.run(discordId, jour, l, iso());
      return { jour, publications: q.publicationsJour.all(discordId, jour) };
    },
    publications(discordId, jour) { return q.publicationsJour.all(discordId, jour); },
    captureDuJour(discordId, jour) { return q.captureJour.get(discordId, jour) || null; },

    // Jours dont le compte rendu reste à faire (publiés avant aujourd'hui, sans compte rendu) ou à corriger.
    comptesRendusAFaire(discordId) {
      const p = parcours.get(discordId);
      if (!p || !p.fuseau) return [];
      const aujourdhui = api.aujourdhui(p);
      return q.joursPublies.all(discordId).filter((j) => j.jour < aujourdhui).map((j) => ({ jour: j.jour, videos: j.n, cr: q.crJour.get(discordId, j.jour) || null }))
        .filter((x) => !x.cr || x.cr.etat === 'corriger');
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

    enregistrerCompteRendu(discordId, jour, d) {
      const p = parcours.get(discordId);
      if (!p || p.etape < 4) return { erreur: 'Tu n\'es pas encore à l\'étape 4.' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour >= api.aujourdhui(p)) return { erreur: 'Le compte rendu se fait le lendemain de la publication.' };
      const videos = q.publicationsJour.all(discordId, jour);
      if (!videos.length) return { erreur: 'Aucune vidéo déclarée ce jour-là.' };
      const deja = q.crJour.get(discordId, jour);
      if (deja && deja.etat === 'valide') return { erreur: 'Ce compte rendu est déjà validé.' };
      const nombres = ['abonnes_total', 'vues_total', 'abonnes_jour', 'vues_jour'].map((k) => entier(d[k]));
      if (nombres.some((n) => n === null)) return { erreur: 'Remplis les chiffres de ton compte (abonnés et vues).' };
      const pays = (v) => [0, 1, 2].map((i) => String((v || [])[i] || '').trim().slice(0, 40)).filter(Boolean);
      const paysVues = pays(d.pays_vues);
      const paysAbonnes = pays(d.pays_abonnes);
      if (!paysVues.length || !paysAbonnes.length) return { erreur: 'Indique au moins le premier pays de tes vues et de tes abonnés.' };
      if (!d.capture_revenus && !(deja && deja.capture_revenus)) return { erreur: 'Ajoute la capture de ta page des revenus TikTok.' };
      const stats = [];
      for (const v of videos) {
        const s = (d.videos || {})[v.id] || {};
        const ligne = { vues: entier(s.vues), abonnes: entier(s.abonnes), heure: HEURE.test(String(s.heure || '')) ? s.heure : null,
          visionnage: entier(s.visionnage_s), retention: decimal(s.retention_10s), revenus: decimal(s.revenus) };
        if (Object.values(ligne).some((x) => x === null)) return { erreur: 'Remplis toutes les statistiques de chaque vidéo.' };
        if (ligne.retention > 100) return { erreur: 'La rétention est un pourcentage (de 0 à 100).' };
        stats.push([v.id, ligne]);
      }
      const question = String(d.question || '').trim().slice(0, 1000) || null;
      q.crEnregistrer.run(discordId, jour, ...nombres, JSON.stringify(paysVues), JSON.stringify(paysAbonnes),
        d.capture_revenus || (deja && deja.capture_revenus), question, iso(), iso());
      const cr = q.crJour.get(discordId, jour);
      for (const [pid, l] of stats) q.statVideo.run(cr.id, pid, l.vues, l.abonnes, l.heure, l.visionnage, l.retention, l.revenus);
      return { compteRendu: api.compteRendu(discordId, jour) };
    },

    decider(id, decision, { texte, images = [] } = {}) {
      const cr = q.cr.get(Number(id));
      if (!cr) return { erreur: 'Compte rendu introuvable.' };
      if (cr.etat !== 'attente') return { erreur: 'Ce compte rendu a déjà été traité.' };
      if (!['valider', 'corriger'].includes(decision)) return { erreur: 'Décision inconnue.' };
      const mot = String(texte || '').trim();
      if (decision === 'corriger' && !mot) return { erreur: 'Écris ce qu\'il doit corriger.' };
      q.decider.run(decision === 'valider' ? 'valide' : 'corriger', iso(), cr.id);
      if (mot || images.length) parcours.ajouterRemarque(cr.discord_id, { texte: `Compte rendu du ${jourLisible(cr.jour)} : ${mot || '(image)'}`, images, type: decision === 'valider' ? 'valide' : 'corriger' });
      return { compteRendu: api.compteRendu(cr.discord_id, cr.jour), nouvelles: decision === 'valider' ? api.verifierRecompenses(cr.discord_id) : [] };
    },
    enAttente() { return q.crAttente.all().map((cr) => ({ ...cr, parcours: parcours.get(cr.discord_id) })); },

    // Statistiques de la fiche (comptes rendus validés).
    stats(discordId) {
      const p = parcours.get(discordId);
      if (!p) return null;
      const aujourdhui = p.fuseau ? api.aujourdhui(p) : maintenant().toISOString().slice(0, 10);
      const dernier = q.dernierCr.get(discordId);
      const compte = {};
      for (const r of q.paysCr.all(discordId)) { const premier = JSON.parse(r.pays_abonnes || '[]')[0]; if (premier) compte[premier] = (compte[premier] || 0) + 1; }
      const paysPrincipal = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
      const jours = q.joursPublies.all(discordId);
      const debut = p.etape >= 4 && p.etape3_le ? p.etape3_le.slice(0, 10) : null;
      const joursDepuis = debut ? Math.max(1, Math.round((Date.parse(`${aujourdhui}T12:00:00Z`) - Date.parse(`${debut}T12:00:00Z`)) / JOUR) + 1) : 0;
      const total = q.revenusValides.get(discordId, '0000-00-00').total;
      return {
        abonnes: dernier ? dernier.abonnes_total : null,
        vues: dernier ? dernier.vues_total : null,
        paysPrincipal: paysPrincipal ? paysPrincipal[0] : null,
        revenusTotal: Math.round(total * 100) / 100,
        revenus28: Math.round(q.revenusValides.get(discordId, decalerJour(aujourdhui, -(FENETRE_GOAT_JOURS - 1))).total * 100) / 100,
        joursPublies: jours.length,
        videosPubliees: jours.reduce((n, j) => n + j.n, 0),
        joursDepuisEtape4: joursDepuis,
        objectifs: OBJECTIFS.map((o) => ({ montant: o, atteint: total >= o })),
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
      if (!p.heure_creation) {
        return { cle: 'heures', titre: 'Choisis tes 3 heures', texte: 'Création, publication et compte rendu : Bob te le rappellera chaque jour à ces heures.',
          lien: '/parcours/etape-4', bouton: 'Choisir mes heures', delai: { fin: new Date(new Date(p.etape_depuis).getTime() + 12 * 3600 * 1000).toISOString(), duree: 12 * 3600 * 1000 } };
      }
      const aFaire = api.comptesRendusAFaire(p.discord_id);
      if (aFaire.length) {
        const x = aFaire[0];
        return { cle: `cr-${x.jour}`, titre: x.cr && x.cr.etat === 'corriger' ? `Corrige ton compte rendu du ${jourLisible(x.jour)}` : `Envoie ton compte rendu du ${jourLisible(x.jour)}`,
          texte: aFaire.length > 1 ? `${aFaire.length} comptes rendus à envoyer ou à corriger.` : 'Les résultats de tes vidéos de ce jour-là.',
          lien: `/parcours/compte-rendu/${x.jour}`, bouton: 'Faire mon compte rendu' };
      }
      if (!q.publicationsJour.all(p.discord_id, api.aujourdhui(p)).length) {
        return { cle: 'publier', titre: 'Publie ta vidéo du jour', texte: 'Au moins une vidéo par jour, puis déclare-la ici avec son lien et la capture de ton compte.',
          lien: '/parcours/etape-4', bouton: 'Déclarer ma vidéo' };
      }
      return { cle: 'ok', titre: 'Ta vidéo du jour est déclarée', texte: 'Demain, à ton heure de compte rendu, tu enverras ses résultats.', lien: '/parcours/etape-4', bouton: 'Ouvrir l\'étape 4' };
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

module.exports = { creerSuivi, jourDans, heureDans, jourLisible, QUESTIONS, OBJECTIFS, ROLES_REVENUS };
