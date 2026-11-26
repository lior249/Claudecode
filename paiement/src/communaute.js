'use strict';

// Communauté des élèves Elite : suivis (10 places), concurrences (3 au plus, elles prennent une place de suivi),
// chaîne d'activité (updates du compte envoyés jour après jour) et suggestions (en vogue, profils proches).
const MAX_SUIVIS = 10;
const MAX_CONCURRENTS = 3;
const CHAINE_MIN = 3; // la flamme s'allume à 3 jours d'affilée
const PALIERS = [1000, 1500, 5000, 10000];
// Profils proches sur les 10 derniers jours : écart de revenus et de vues au plus.
const FENETRE_PROCHES = 10;
const ECART_REVENUS = 200;
const ECART_VUES = 500000;
const JOUR = 86400000;

const decaler = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * JOUR).toISOString().slice(0, 10);

function creerCommunaute({ db, parcours, suivi, maintenant = () => new Date() }) {
  const q = {
    suivis: db.prepare('SELECT * FROM suivis WHERE suiveur = ? ORDER BY cree_le'),
    suiveurs: db.prepare('SELECT * FROM suivis WHERE suivi = ?'),
    suit: db.prepare('SELECT * FROM suivis WHERE suiveur = ? AND suivi = ?'),
    suivre: db.prepare("INSERT OR IGNORE INTO suivis (suiveur, suivi, type, cree_le) VALUES (?, ?, 'suivi', ?)"),
    lier: db.prepare(`INSERT INTO suivis (suiveur, suivi, type, cree_le) VALUES (?, ?, 'concurrent', ?)
                      ON CONFLICT(suiveur, suivi) DO UPDATE SET type = 'concurrent'`),
    delier: db.prepare("UPDATE suivis SET type = 'suivi' WHERE suiveur = ? AND suivi = ?"),
    retirer: db.prepare("DELETE FROM suivis WHERE suiveur = ? AND suivi = ? AND type = 'suivi'"),
    concurrence: db.prepare('SELECT * FROM concurrences WHERE id = ?'),
    entre: db.prepare("SELECT * FROM concurrences WHERE statut IN ('attente', 'accepte') AND ((de = ? AND vers = ?) OR (de = ? AND vers = ?))"),
    actives: db.prepare("SELECT * FROM concurrences WHERE statut = 'accepte' AND (de = ? OR vers = ?) ORDER BY decide_le"),
    envoyees: db.prepare("SELECT * FROM concurrences WHERE statut = 'attente' AND de = ? ORDER BY cree_le"),
    recues: db.prepare("SELECT * FROM concurrences WHERE statut = 'attente' AND vers = ? ORDER BY cree_le"),
    inviter: db.prepare("INSERT INTO concurrences (de, vers, objectif, statut, cree_le) VALUES (?, ?, ?, 'attente', ?)"),
    decider: db.prepare('UPDATE concurrences SET statut = ?, decide_le = ? WHERE id = ? AND statut = ?'),
    finir: db.prepare("UPDATE concurrences SET statut = 'fini', gagnant = ?, fini_le = ? WHERE id = ? AND statut = 'accepte'"),
    joursCr: db.prepare("SELECT jour FROM comptes_rendus WHERE discord_id = ? AND envoye_le IS NOT NULL ORDER BY jour DESC"),
    finies: db.prepare("SELECT * FROM concurrences WHERE statut = 'fini' AND (de = ? OR vers = ?) AND fini_le >= ?"),
    videosPeriode: db.prepare('SELECT ok_vues, ok_revenus FROM publications WHERE discord_id = ? AND jour >= ? AND ok_vues IS NOT NULL'),
    videosValidees: db.prepare("SELECT * FROM publications WHERE discord_id = ? AND res_etat = 'valide' AND res_decide_le >= ? ORDER BY res_decide_le DESC LIMIT 10"),
  };
  const iso = () => maintenant().toISOString();
  const aujourdhuiDe = (p) => (p && p.fuseau ? suivi.aujourdhui(p) : maintenant().toISOString().slice(0, 10));
  const actif = (id) => { const p = parcours.get(id); return p && !p.retire_le ? p : null; };

  // Chaîne : jours consécutifs avec un compte rendu envoyé. Le compte rendu d'hier peut encore arriver aujourd'hui ;
  // au-delà, un jour manqué et elle repart de zéro.
  function chaine(id) {
    const p = parcours.get(id);
    if (!p) return 0;
    const jours = q.joursCr.all(id).map((x) => x.jour);
    if (!jours.length || jours[0] < decaler(aujourdhuiDe(p), -2)) return 0;
    let n = 1;
    for (let i = 1; i < jours.length && jours[i] === decaler(jours[i - 1], -1); i++) n++;
    return n;
  }
  const flamme = (n) => n >= CHAINE_MIN;

  // Revenus et vues sur une période (comptes rendus envoyés, hors à corriger).
  function periode(id, jours) {
    const p = parcours.get(id);
    const depuis = decaler(aujourdhuiDe(p), -(jours - 1));
    const v = q.videosPeriode.all(id, depuis);
    return { revenus: Math.round(v.reduce((t, x) => t + (x.ok_revenus || 0), 0) * 100) / 100, vues: v.reduce((t, x) => t + (x.ok_vues || 0), 0), comptesRendus: v.length };
  }

  const concurrentsDe = (id) => q.actives.all(id, id).map((c) => ({ ...c, autre: c.de === id ? c.vers : c.de }));
  // La concurrence se débloque à l'étape 4, avec au moins un compte rendu envoyé.
  const peutConcourir = (id) => { const p = actif(id); return Boolean(p && p.etape >= 4 && q.joursCr.all(id).length); };
  const placesPrises = (id) => q.suivis.all(id).length + q.envoyees.all(id).filter((c) => !q.suit.get(id, c.vers)).length;

  const api = {
    MAX_SUIVIS, MAX_CONCURRENTS, CHAINE_MIN,
    chaine, flamme, periode, peutConcourir,
    suivis(id) { return q.suivis.all(id); },
    suiveurs(id) { return q.suiveurs.all(id); },
    suit(id, autre) { return Boolean(q.suit.get(id, autre)); },
    concurrents: concurrentsDe,
    invitationsRecues(id) { return q.recues.all(id); },
    invitationsEnvoyees(id) { return q.envoyees.all(id); },

    suivre(id, autre) {
      if (!actif(id) || !actif(autre) || id === autre) return { erreur: 'Ce membre n\'est pas dans l\'accompagnement.' };
      if (q.suit.get(id, autre)) return { ok: true };
      if (placesPrises(id) >= MAX_SUIVIS) return { erreur: `Tu suis déjà ${MAX_SUIVIS} personnes : retire quelqu'un pour suivre ce membre.` };
      q.suivre.run(id, autre, iso());
      return { ok: true };
    },
    nePlusSuivre(id, autre) {
      const s = q.suit.get(id, autre);
      if (s && s.type === 'concurrent') return { erreur: 'C\'est ton concurrent : abandonne d\'abord la concurrence.' };
      q.retirer.run(id, autre);
      return { ok: true };
    },

    // Prochain palier commun : 1 000, 1 500, 5 000 ou 10 000 $ au-dessus des deux.
    objectifPour(a, b) {
      const haut = Math.max((suivi.stats(a) || {}).revenusTotal || 0, (suivi.stats(b) || {}).revenusTotal || 0);
      return PALIERS.find((x) => x > haut) || Math.ceil((haut + 1) / 10000) * 10000;
    },
    inviter(id, autre) {
      if (id === autre) return { erreur: 'Choisis un autre membre.' };
      if (!peutConcourir(id)) return { erreur: 'La concurrence se débloque à l\'étape 4, après ton premier compte rendu.' };
      if (!peutConcourir(autre)) return { erreur: 'Ce membre n\'a pas encore débloqué la concurrence.' };
      if (q.entre.get(id, autre, autre, id)) return { erreur: 'Une concurrence existe déjà entre vous.' };
      if (concurrentsDe(id).length + q.envoyees.all(id).length >= MAX_CONCURRENTS) return { erreur: `${MAX_CONCURRENTS} concurrents au plus (invitations comprises).` };
      if (!q.suit.get(id, autre) && placesPrises(id) >= MAX_SUIVIS) return { erreur: `Tes ${MAX_SUIVIS} places de suivi sont prises : retire quelqu'un d'abord.` };
      const objectif = api.objectifPour(id, autre);
      const r = q.inviter.run(id, autre, objectif, iso());
      return { ok: true, concurrence: q.concurrence.get(Number(r.lastInsertRowid)) };
    },
    repondre(id, concurrenceId, oui) {
      const c = q.concurrence.get(Number(concurrenceId));
      if (!c || c.vers !== id || c.statut !== 'attente') return { erreur: 'Invitation introuvable.' };
      if (oui) {
        if (concurrentsDe(id).length >= MAX_CONCURRENTS) return { erreur: `Tu as déjà ${MAX_CONCURRENTS} concurrents.` };
        if (!q.suit.get(id, c.de) && placesPrises(id) >= MAX_SUIVIS) return { erreur: `Tes ${MAX_SUIVIS} places de suivi sont prises : retire quelqu'un d'abord.` };
        if (concurrentsDe(c.de).length >= MAX_CONCURRENTS) return { erreur: 'Ce membre a déjà trop de concurrents.' };
      }
      q.decider.run(oui ? 'accepte' : 'refuse', iso(), c.id, 'attente');
      if (oui) { q.lier.run(c.de, c.vers, iso()); q.lier.run(c.vers, c.de, iso()); }
      return { ok: true, concurrence: q.concurrence.get(c.id) };
    },
    annuler(id, concurrenceId) {
      const c = q.concurrence.get(Number(concurrenceId));
      if (!c || (c.de !== id && c.vers !== id) || !['attente', 'accepte'].includes(c.statut)) return { erreur: 'Concurrence introuvable.' };
      q.decider.run('abandon', iso(), c.id, c.statut);
      if (c.statut === 'accepte') { q.delier.run(c.de, c.vers); q.delier.run(c.vers, c.de); }
      return { ok: true, concurrence: c };
    },
    // Après un compte rendu validé : qui a atteint l'objectif de sa concurrence en premier ?
    verifierConcurrences(id) {
      const total = (suivi.stats(id) || {}).revenusTotal || 0;
      const gagnees = [];
      for (const c of concurrentsDe(id)) {
        if (total < c.objectif) continue;
        if (q.finir.run(id, iso(), c.id).changes) {
          q.delier.run(c.de, c.vers); q.delier.run(c.vers, c.de);
          gagnees.push({ ...c, gagnant: id });
        }
      }
      return gagnees;
    },

    // En vogue : les meilleurs revenus (puis vues) des 7 derniers jours, que je ne suis pas encore.
    enVogue(id, n = 5) {
      return parcours.tous().filter((p) => p.discord_id !== id && !q.suit.get(id, p.discord_id))
        .map((p) => ({ parcours: p, ...periode(p.discord_id, 7), chaine: chaine(p.discord_id) }))
        .filter((x) => x.comptesRendus > 0)
        .sort((a, b) => b.revenus - a.revenus || b.vues - a.vues).slice(0, n);
    },
    // Profils proches sur 10 jours (revenus à 200 $ près, vues à 500 000 près) : à défier.
    proches(id, n = 5) {
      if (!peutConcourir(id)) return [];
      const moi = periode(id, FENETRE_PROCHES);
      return parcours.tous().filter((p) => p.discord_id !== id && peutConcourir(p.discord_id) && !q.entre.get(id, p.discord_id, p.discord_id, id))
        .map((p) => ({ parcours: p, ...periode(p.discord_id, FENETRE_PROCHES) }))
        .filter((x) => x.comptesRendus > 0 && Math.abs(x.revenus - moi.revenus) <= ECART_REVENUS && Math.abs(x.vues - moi.vues) <= ECART_VUES)
        .sort((a, b) => Math.abs(a.revenus - moi.revenus) - Math.abs(b.revenus - moi.revenus)).slice(0, n);
    },

    // Le fil « Leurs dernières nouvelles » : résultats validés de ceux que je suis (21 jours), concurrences gagnées.
    fil(id, n = 30) {
      const depuis = new Date(maintenant().getTime() - 21 * JOUR).toISOString();
      const items = [];
      for (const s of q.suivis.all(id)) {
        for (const v of q.videosValidees.all(s.suivi, depuis)) items.push({ auteur: s.suivi, concurrent: s.type === 'concurrent', quand: v.res_decide_le, ...api.nouvelle(v) });
      }
      for (const c of q.finies.all(id, id, depuis)) items.push({ auteur: c.gagnant, concurrent: true, quand: c.fini_le, type: 'gagne', valeur: c.objectif });
      return items.sort((a, b) => String(b.quand).localeCompare(String(a.quand))).slice(0, n);
    },
    // Message pour ceux qui le suivent, après un compte rendu validé : l'argent d'abord, sinon les vues, sinon « a posté ».
    // D'après les résultats validés d'une vidéo.
    nouvelle(v) {
      if (v && v.ok_revenus > 0) return { type: 'gain', valeur: v.ok_revenus };
      if (v && v.ok_vues > 0) return { type: 'vues', valeur: v.ok_vues };
      return { type: 'poste', valeur: null };
    },
  };
  return api;
}

module.exports = { creerCommunaute, MAX_SUIVIS, MAX_CONCURRENTS, CHAINE_MIN };
