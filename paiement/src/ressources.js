'use strict';

const { lienCompte } = require('./tiktok');

// Ressources de l'accompagnement Elite, pour les élèves et le coach :
//  - niches : nom et sujet, type de contenu (L1 repost amélioré / L2 commentaire), pays recommandés, RPM min et max ($),
//    comptes exemples, contre-exemples et comptes sources (L1) ;
//  - méthodes pour 10K abonnés : nom facultatif, type (vidéo, carrousel, CTA), meilleure pour L1 / L2 (décidé par le coach), exemples ;
//  - tutoriels : montage, ciblage, scripting, astuce, autre.
// Les élèves aiment (like) les ressources et proposent une niche ou une méthode : elle attend l'accord du coach (À traiter),
// puis devient publique. L'élève la modifie tant qu'elle n'est pas validée ; le coach peut toujours la modifier.

const TYPES = {
  niche: { nom: 'Niches', un: 'une niche', categories: [['L1', 'L1 · repost amélioré'], ['L2', 'L2 · commentaire'], ['L1L2', 'L1 et L2']] },
  methode: { nom: 'Méthodes 10K', un: 'une méthode', categories: [['video', 'Vidéo'], ['carrousel', 'Carrousel'], ['cta', 'CTA']] },
  tutoriel: { nom: 'Tutoriels', un: 'un tutoriel', categories: [['montage', 'Montage'], ['ciblage', 'Ciblage'], ['scripting', 'Scripting'], ['astuce', 'Astuce'], ['autre', 'Autre']] },
};
const PAYS = ['Allemagne', 'France', 'Angleterre', 'États-Unis', 'Brésil', 'Mexique', 'Corée du Sud', 'Japon'];
const DRAPEAUX = { Allemagne: '🇩🇪', France: '🇫🇷', Angleterre: '🇬🇧', 'États-Unis': '🇺🇸', Brésil: '🇧🇷', Mexique: '🇲🇽', 'Corée du Sud': '🇰🇷', Japon: '🇯🇵' };
const POUR = [['L1', 'L1'], ['L2', 'L2'], ['L1L2', 'L1 et L2']];
// Les élèves proposent des niches et des méthodes ; les tutoriels viennent du coach.
const PROPOSABLES = ['niche', 'methode'];

function creerRessources({ db, maintenant = () => new Date() }) {
  const q = {
    une: db.prepare('SELECT * FROM ressources WHERE id = ?'),
    publiques: db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM ressources_likes l WHERE l.ressource_id = r.id) likes
      FROM ressources r WHERE r.type = ? AND (r.etat = 'public' OR r.auteur = ?) ORDER BY (r.etat = 'public') ASC, likes DESC, r.id DESC`),
    toutes: db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM ressources_likes l WHERE l.ressource_id = r.id) likes FROM ressources r WHERE r.type = ?
      ORDER BY (r.etat = 'attente') DESC, likes DESC, r.id DESC`),
    aime: db.prepare('SELECT ressource_id FROM ressources_likes WHERE discord_id = ?'),
    likes: db.prepare('SELECT COUNT(*) n FROM ressources_likes WHERE ressource_id = ?'),
    liker: db.prepare('INSERT OR IGNORE INTO ressources_likes (ressource_id, discord_id, cree_le) VALUES (?, ?, ?)'),
    deliker: db.prepare('DELETE FROM ressources_likes WHERE ressource_id = ? AND discord_id = ?'),
    creer: db.prepare(`INSERT INTO ressources (type, titre, description, categorie, pour, pays, rpm_min, rpm_max, exemples, contre_exemples, sources, lien, auteur, etat, cree_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    maj: db.prepare(`UPDATE ressources SET titre = ?, description = ?, categorie = ?, pour = ?, pays = ?, rpm_min = ?, rpm_max = ?, exemples = ?, contre_exemples = ?,
      sources = ?, lien = ?, maj_le = ? WHERE id = ?`),
    decider: db.prepare('UPDATE ressources SET etat = ?, motif = ?, decide_le = ? WHERE id = ?'),
    attente: db.prepare("SELECT * FROM ressources WHERE etat = 'attente' ORDER BY cree_le"),
  };
  const iso = () => maintenant().toISOString();
  const json = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
  const lire = (r) => (r ? { ...r, pays: json(r.pays), exemples: json(r.exemples), contre_exemples: json(r.contre_exemples), sources: json(r.sources),
    likes: r.likes !== undefined ? r.likes : q.likes.get(r.id).n } : null);
  // Liens collés un par ligne (ou séparés par des espaces) : profils TikTok nettoyés, autres liens https gardés.
  const liens = (v) => [...new Set(String(v || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
    .map((x) => lienCompte(x) || (/^https:\/\/\S+$/.test(x) ? x.slice(0, 300) : null)).filter(Boolean))].slice(0, 20);
  const montant = (v) => { const s = String(v ?? '').trim().replace(/[$\s]/g, '').replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; };

  // Vérifie et met en forme les champs d'un formulaire. Renvoie { erreur } ou { champs }.
  function champsDe(type, b, { coach }) {
    const t = TYPES[type];
    if (!t) return { erreur: 'Type de ressource inconnu.' };
    const titre = String(b.titre || '').trim().slice(0, 100) || null;
    const description = String(b.description || '').trim().slice(0, 3000) || null;
    const categorie = t.categories.some(([c]) => c === b.categorie) ? b.categorie : null;
    if (type !== 'methode' && !titre) return { erreur: type === 'niche' ? 'Donne un nom à la niche.' : 'Donne un titre au tutoriel.' };
    if (!categorie) return { erreur: type === 'niche' ? 'Choisis le type de contenu (L1 ou L2).' : 'Choisis le type.' };
    const champs = { titre, description, categorie, pour: null, pays: null, rpm_min: null, rpm_max: null, exemples: '[]', contre_exemples: '[]', sources: '[]', lien: null };
    champs.exemples = JSON.stringify(liens(b.exemples));
    if (type === 'niche') {
      if (!description) return { erreur: 'Décris le sujet de la niche.' };
      const pays = [].concat(b.pays || []).flatMap((x) => String(x).split(',')).filter((x) => PAYS.includes(x));
      champs.pays = JSON.stringify([...new Set(pays)]);
      const min = montant(b.rpm_min); const max = montant(b.rpm_max);
      if (Number.isNaN(min) || Number.isNaN(max)) return { erreur: 'Le RPM est un montant en dollars, par exemple 0.40.' };
      if (min !== null && max !== null && min > max) return { erreur: 'Le RPM minimum dépasse le maximum.' };
      Object.assign(champs, { rpm_min: min, rpm_max: max, contre_exemples: JSON.stringify(liens(b.contre_exemples)), sources: JSON.stringify(categorie === 'L2' ? [] : liens(b.sources)) });
    }
    if (type === 'methode') {
      // « Meilleure pour L1 / L2 » : seulement le coach le décide.
      if (coach) champs.pour = POUR.some(([c]) => c === b.pour) ? b.pour : null;
      if (!description && !titre) return { erreur: 'Explique la méthode.' };
    }
    if (type === 'tutoriel') {
      const l = String(b.lien || '').trim();
      if (l && !/^https:\/\/\S+$/.test(l)) return { erreur: 'Le lien doit commencer par https://.' };
      champs.lien = l ? l.slice(0, 400) : null;
      if (!description && !champs.lien) return { erreur: 'Ajoute une explication ou un lien.' };
    }
    return { champs };
  }

  const api = {
    TYPES, PAYS, DRAPEAUX, POUR, PROPOSABLES,
    une(id) { return lire(q.une.get(Number(id))); },
    // Liste d'un type : publiques (+ les propositions de l'élève) ; tout pour le coach.
    liste(type, { pour = null, coach = false } = {}) {
      if (!TYPES[type]) return [];
      return (coach ? q.toutes.all(type) : q.publiques.all(type, String(pour || ''))).map(lire);
    },
    aimees(discordId) { return new Set(q.aime.all(String(discordId)).map((x) => x.ressource_id)); },
    basculerLike(id, discordId) {
      const r = q.une.get(Number(id));
      if (!r || r.etat !== 'public') return { erreur: 'Ressource introuvable.' };
      const deja = q.deliker.run(r.id, String(discordId)).changes;
      if (!deja) q.liker.run(r.id, String(discordId), iso());
      return { aime: !deja, likes: q.likes.get(r.id).n };
    },
    // Le coach publie directement ; un élève propose (niche, méthode) : en attente de validation.
    creer(type, b, { auteur = null } = {}) {
      const coach = !auteur;
      if (!coach && !PROPOSABLES.includes(type)) return { erreur: 'Seul le coach ajoute des tutoriels.' };
      const r = champsDe(type, b, { coach });
      if (r.erreur) return r;
      const c = r.champs;
      const id = Number(q.creer.run(type, c.titre, c.description, c.categorie, c.pour, c.pays, c.rpm_min, c.rpm_max, c.exemples, c.contre_exemples, c.sources, c.lien,
        auteur, coach ? 'public' : 'attente', iso()).lastInsertRowid);
      return { ressource: api.une(id) };
    },
    peutModifier(r, { discordId, coach }) { return Boolean(r && (coach || (r.auteur && r.auteur === discordId && r.etat !== 'public'))); },
    modifier(id, b, { discordId = null, coach = false } = {}) {
      const r = api.une(id);
      if (!r) return { erreur: 'Ressource introuvable.' };
      if (!api.peutModifier(r, { discordId, coach })) return { erreur: 'Elle est validée : seul le coach peut la modifier.' };
      const x = champsDe(r.type, b, { coach });
      if (x.erreur) return x;
      const c = x.champs;
      if (!coach) c.pour = r.pour;
      q.maj.run(c.titre, c.description, c.categorie, c.pour, c.pays, c.rpm_min, c.rpm_max, c.exemples, c.contre_exemples, c.sources, c.lien, iso(), r.id);
      // Refusée puis corrigée par l'élève : elle repart en attente.
      if (!coach && r.etat === 'refuse') q.decider.run('attente', null, null, r.id);
      return { ressource: api.une(r.id) };
    },
    decider(id, decision, motif) {
      const r = api.une(id);
      if (!r) return { erreur: 'Ressource introuvable.' };
      if (r.etat !== 'attente') return { erreur: 'Elle a déjà été traitée.' };
      if (!['valider', 'refuser'].includes(decision)) return { erreur: 'Décision inconnue.' };
      const m = String(motif || '').trim().slice(0, 1000);
      if (decision === 'refuser' && !m) return { erreur: 'Écris pourquoi tu la refuses : l\'élève pourra la corriger.' };
      q.decider.run(decision === 'valider' ? 'public' : 'refuse', m || null, iso(), r.id);
      return { ressource: api.une(r.id) };
    },
    enAttente() { return q.attente.all().map(lire); },
  };
  return api;
}

module.exports = { creerRessources, TYPES, PAYS, DRAPEAUX, POUR };
