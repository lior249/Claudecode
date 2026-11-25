'use strict';

// Rôles donnés à la main : quelqu'un a le rôle d'un programme sans avoir payé sur le site.
// Bob demande au coach « Lui donner accès au site quand même ? ». Oui : il a accès comme un abonné par carte.
// Non : pas d'accès au site (son rôle Discord reste ; son parcours Elite, s'il en avait un, est fermé sans rien effacer).
// Ceux qui avaient déjà accès avant la validation (« anciens ») le gardent en attendant la réponse.
function creerAccesManuels({ db, parcours, coaching, maintenant = () => new Date() }) {
  const q = {
    get: db.prepare('SELECT * FROM acces_manuels WHERE discord_id = ? AND programme = ?'),
    demander: db.prepare(`INSERT OR IGNORE INTO acces_manuels (discord_id, programme, pseudo, statut, donne_par, demande_le)
                          VALUES (?, ?, ?, 'attente', ?, ?)`),
    aPrevenir: db.prepare("SELECT * FROM acces_manuels WHERE statut = 'attente' AND prevenu_le IS NULL ORDER BY ancien, demande_le"),
    prevenu: db.prepare('UPDATE acces_manuels SET prevenu_le = ? WHERE discord_id = ? AND programme = ?'),
    enAttente: db.prepare("SELECT * FROM acces_manuels WHERE statut = 'attente' ORDER BY ancien, demande_le"),
    refuses: db.prepare("SELECT * FROM acces_manuels WHERE statut = 'refuse' ORDER BY decide_le DESC LIMIT 50"),
    decider: db.prepare('UPDATE acces_manuels SET statut = ?, decide_le = ? WHERE discord_id = ? AND programme = ? AND statut = ?'),
    oublier: db.prepare("DELETE FROM acces_manuels WHERE discord_id = ? AND programme = ? AND statut = 'attente'"),
    carte: db.prepare('SELECT * FROM abonnes_carte WHERE discord_id = ? AND programme = ?'),
    carteOuvrir: db.prepare(`INSERT INTO abonnes_carte (discord_id, programme, pseudo, depuis, source) VALUES (?, ?, ?, ?, 'main')
                             ON CONFLICT(discord_id, programme) DO UPDATE SET perdu_le = NULL, termine_le = NULL, pseudo = COALESCE(excluded.pseudo, pseudo)`),
    carteFermer: db.prepare('UPDATE abonnes_carte SET termine_le = ? WHERE discord_id = ? AND programme = ? AND termine_le IS NULL'),
  };
  const iso = () => maintenant().toISOString();
  const carteActive = (id, programme) => { const c = q.carte.get(id, programme); return Boolean(c && !c.perdu_le && !c.termine_le); };

  // Ouvre le site : comme un abonné par carte (et son parcours Elite, retrouvé là où il en était).
  function ouvrir(id, programme, pseudo) {
    if (!carteActive(id, programme)) q.carteOuvrir.run(id, programme, pseudo || null, iso());
    if (programme === 'elite' && parcours) parcours.assurer(id, { pseudo });
  }

  return {
    get(id, programme) { return q.get.get(id, programme) || null; },
    // Nouvelle question pour le coach ; false si elle existe déjà (en attente ou déjà décidée).
    demander(id, programme, { pseudo, donnePar } = {}) { return q.demander.run(id, programme, pseudo || null, donnePar || null, iso()).changes === 1; },
    aPrevenir() { return q.aPrevenir.all(); },
    marquerPrevenu(id, programme) { q.prevenu.run(iso(), id, programme); },
    enAttente() { return q.enAttente.all(); },
    refuses() { return q.refuses.all(); },
    // Il a finalement payé par carte sur Whop : la question n'a plus lieu d'être.
    oublier(id, programme) { return q.oublier.run(id, programme).changes === 1; },
    // Accès déjà accordé (rôle retiré puis redonné) : le site se rouvre sans redemander.
    rouvrir(id, programme, pseudo) {
      const a = q.get.get(id, programme);
      if (!a || a.statut !== 'accorde') return false;
      ouvrir(id, programme, pseudo || a.pseudo);
      return true;
    },
    // La réponse du coach. Un « Non » peut devenir « Oui » plus tard ; un « Oui » est définitif ici (il retire le rôle sur Discord).
    decider(id, programme, oui) {
      const a = q.get.get(id, programme);
      if (!a) return { erreur: 'Demande introuvable.' };
      if (a.statut === 'accorde') return { erreur: 'Déjà fait : accès au site donné.' };
      if (a.statut === 'refuse' && !oui) return { erreur: 'Déjà fait : accès au site refusé.' };
      const avait = carteActive(id, programme) || Boolean(programme === 'elite' && parcours && (parcours.get(id) || {}).retire_le === null);
      if (q.decider.run(oui ? 'accorde' : 'refuse', iso(), id, programme, a.statut).changes !== 1) return { erreur: 'Déjà décidé.' };
      if (oui) ouvrir(id, programme, a.pseudo);
      else {
        q.carteFermer.run(iso(), id, programme);
        if (programme === 'elite') {
          if (parcours) parcours.retirer(id);
          if (coaching) coaching.supprimerMembre(id);
        }
      }
      // « ouvert » : il n'avait pas accès, Bob lui annonce que le site est ouvert.
      return { ok: true, acces: q.get.get(id, programme), ouvert: oui && !avait, retire: !oui && avait };
    },
  };
}

module.exports = { creerAccesManuels };
