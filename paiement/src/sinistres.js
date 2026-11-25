'use strict';

// Sinistrés (docs/ACCOMPAGNEMENT-ELITE.md, partie 6) : une absence, c'est l'absence d'interaction sur la plateforme.
//  - 3 jours : « Pourquoi tu n'es pas là ? » ; 6 jours : « Demain, tu seras sinistré » ; 7 jours : sinistre ;
//  - pendant le sinistre, les jours continuent de compter : 7 jours de plus sans revenir = un sinistre de plus, jusqu'à 3 ;
//  - au 3e sinistre (sinistré total), plus jamais de live individuel ;
//  - le coach réhabilite après la fiche de sinistre ; en cas de force majeure, il retire les sinistres
//    et les jours d'absence sont rendus sur les 90 jours.

const JOUR = 24 * 3600 * 1000;
const SEUILS = { message: 3, avertissement: 6, sinistre: 7 };
const MAX = 3;

function creerSinistres({ db, parcours, maintenant = () => new Date() }) {
  const q = {
    activite: db.prepare('UPDATE parcours SET derniere_activite = ? WHERE discord_id = ? AND (derniere_activite IS NULL OR derniere_activite < ?)'),
    whop: db.prepare(`SELECT MAX(p.maj_le) d FROM progression_whop p JOIN membres m ON m.whop_user_id = p.whop_user_id WHERE m.discord_id = ? AND p.termine = 1`),
    ouvrirP: db.prepare('UPDATE parcours SET sinistres = ?, sinistre_depuis = ?, sinistre_total = ?, maj_le = ? WHERE discord_id = ?'),
    compteurP: db.prepare('UPDATE parcours SET sinistres = ?, sinistre_total = ?, maj_le = ? WHERE discord_id = ?'),
    fermerP: db.prepare('UPDATE parcours SET sinistre_depuis = NULL, derniere_activite = ?, maj_le = ? WHERE discord_id = ?'),
    remettreP: db.prepare('UPDATE parcours SET sinistres = 0, sinistre_total = 0, sinistre_depuis = NULL, fin_le = ?, derniere_activite = ?, maj_le = ? WHERE discord_id = ?'),
    nouveau: db.prepare("INSERT INTO sinistres (discord_id, absent_depuis, debut, numero, etat, cree_le) VALUES (?, ?, ?, ?, 'ouvert', ?)"),
    enCours: db.prepare("SELECT * FROM sinistres WHERE discord_id = ? AND etat IN ('ouvert', 'fiche', 'precisions') ORDER BY id DESC LIMIT 1"),
    tous: db.prepare('SELECT * FROM sinistres WHERE discord_id = ? ORDER BY id'),
    numero: db.prepare('UPDATE sinistres SET numero = ? WHERE id = ?'),
    fiche: db.prepare("UPDATE sinistres SET fiche_pourquoi = ?, fiche_engagements = ?, fiche_le = ?, etat = 'fiche' WHERE id = ?"),
    etat: db.prepare('UPDATE sinistres SET etat = ? WHERE id = ?'),
    fin: db.prepare("UPDATE sinistres SET etat = ?, fin = ? WHERE id = ?"),
    retirerTous: db.prepare("UPDATE sinistres SET etat = 'retire', fin = COALESCE(fin, ?) WHERE discord_id = ?"),
    fiches: db.prepare("SELECT * FROM sinistres WHERE etat = 'fiche' ORDER BY fiche_le"),
  };
  const iso = () => maintenant().toISOString();

  const api = {
    SEUILS,
    MAX,

    // Toute visite ou action du membre sur la plateforme (au plus une écriture toutes les 5 minutes).
    noterActivite(discordId) {
      const now = maintenant();
      q.activite.run(now.toISOString(), discordId, new Date(now.getTime() - 5 * 60 * 1000).toISOString());
    },
    // Dernière interaction : sur la plateforme, ou une leçon terminée sur Whop.
    derniereActivite(p) {
      const dates = [p.derniere_activite, p.etape_depuis, p.cree_le, (q.whop.get(p.discord_id) || {}).d].filter(Boolean);
      return new Date(dates.sort().pop());
    },
    joursAbsent(p) { return Math.floor((maintenant() - api.derniereActivite(p)) / JOUR); },

    enCours(discordId) { return q.enCours.get(discordId) || null; },
    historique(discordId) { return q.tous.all(discordId); },
    estSinistre(p) { return Boolean(p && p.sinistre_depuis); },

    // Nouveau sinistre (7 jours d'absence, ou déclaré par le coach).
    ouvrir(discordId, { absentDepuis } = {}) {
      const p = parcours.get(discordId);
      if (!p || p.sinistre_depuis) return { erreur: 'Déjà sinistré.' };
      const numero = Math.min(MAX, (p.sinistres || 0) + 1);
      const total = numero >= MAX ? 1 : p.sinistre_total;
      q.ouvrirP.run(numero, iso(), total, iso(), discordId);
      q.nouveau.run(discordId, (absentDepuis || api.derniereActivite(p)).toISOString(), iso(), numero, iso());
      return { parcours: parcours.get(discordId), numero, total: Boolean(total) };
    },
    // Toujours absent 7 jours de plus pendant le sinistre (sans avoir rempli sa fiche) : un sinistre de plus, jusqu'à 3.
    ajouterSiToujoursAbsent(discordId) {
      const p = parcours.get(discordId);
      const s = q.enCours.get(discordId);
      if (!p || !p.sinistre_depuis || !s || s.etat !== 'ouvert' || p.sinistres >= MAX) return null;
      const attendu = Math.min(MAX, s.numero + Math.floor((maintenant() - new Date(p.sinistre_depuis)) / (7 * JOUR)));
      if (attendu <= p.sinistres) return null;
      const total = attendu >= MAX ? 1 : 0;
      q.compteurP.run(attendu, total, iso(), discordId);
      q.numero.run(attendu, s.id);
      return { numero: attendu, total: Boolean(total) };
    },

    remplirFiche(discordId, { pourquoi, engagements }) {
      const s = q.enCours.get(discordId);
      if (!s) return { erreur: 'Tu n\'es pas sinistré.' };
      const a = String(pourquoi || '').trim();
      const b = String(engagements || '').trim();
      if (a.length < 20 || b.length < 20) return { erreur: 'Explique vraiment pourquoi tu étais absent, et ce à quoi tu t\'engages maintenant.' };
      q.fiche.run(a.slice(0, 4000), b.slice(0, 4000), iso(), s.id);
      return { sinistre: q.enCours.get(discordId) };
    },
    demanderPrecisions(discordId) {
      const s = q.enCours.get(discordId);
      if (!s || s.etat !== 'fiche') return { erreur: 'Pas de fiche de sinistre à traiter.' };
      q.etat.run('precisions', s.id);
      return { sinistre: q.enCours.get(discordId) };
    },
    rehabiliter(discordId) {
      const s = q.enCours.get(discordId);
      if (!s) return { erreur: 'Pas de sinistre en cours.' };
      q.fin.run('rehabilite', iso(), s.id);
      q.fermerP.run(iso(), iso(), discordId);
      return { parcours: parcours.get(discordId) };
    },
    // Jours d'absence de tous les sinistres (de la dernière interaction jusqu'à la réhabilitation, ou maintenant).
    joursAbsence(discordId) {
      return q.tous.all(discordId).reduce((n, s) => n + Math.max(0, Math.round((new Date(s.fin || iso()) - new Date(s.absent_depuis)) / JOUR)), 0);
    },
    // Force majeure (pendant les 90 jours) : sinistres retirés, lives individuels rendus, jours d'absence rendus.
    retirerSinistres(discordId) {
      const p = parcours.get(discordId);
      if (!p) return { erreur: 'Membre introuvable.' };
      if (new Date(p.fin_le) < maintenant() && !p.sinistre_depuis) return { erreur: 'Ses 90 jours sont terminés.' };
      const jours = api.joursAbsence(discordId);
      const fin = new Date(new Date(p.fin_le).getTime() + jours * JOUR).toISOString();
      q.retirerTous.run(iso(), discordId);
      q.remettreP.run(fin, iso(), iso(), discordId);
      return { parcours: parcours.get(discordId), joursRendus: jours };
    },
    fichesATraiter() { return q.fiches.all().map((s) => ({ ...s, parcours: parcours.get(s.discord_id) })); },
  };
  return api;
}

module.exports = { creerSinistres, SEUILS };
