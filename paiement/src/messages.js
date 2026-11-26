'use strict';

// Messages du coach et au coach.
//  - « Envoyer un message » : le coach écrit à un ou plusieurs élèves (titre en gras, texte mis en forme, images).
//    Chaque élève reçoit une remarque (ses Remarques du coach) et une notification (application ou Bob).
//    Accusés : 👎 non délivré, 👍 délivré, 👁️ lu (vu dans ses Remarques). Le coach peut relancer ceux qui ne l'ont pas lu.
//  - Messages des élèves au coach : rangés dans À traiter jusqu'à ce que le coach réponde (ou les marque traités).

const TITRE_MAX = 120;
const TEXTE_MAX = 4000;

function creerMessages({ db, parcours, maintenant = () => new Date() }) {
  const q = {
    envoi: db.prepare('INSERT INTO envois_messages (titre, texte, images, lien, cree_le) VALUES (?, ?, ?, ?, ?)'),
    remarque: db.prepare("INSERT INTO remarques (discord_id, type, titre, texte, images, cree_le, envoi_id) VALUES (?, 'remarque', ?, ?, ?, ?, ?)"),
    livre: db.prepare('UPDATE remarques SET livre = ? WHERE id = ?'),
    unEnvoi: db.prepare('SELECT * FROM envois_messages WHERE id = ?'),
    envois: db.prepare('SELECT * FROM envois_messages ORDER BY COALESCE(modifie_le, cree_le) DESC, id DESC LIMIT ?'),
    destinataires: db.prepare(`SELECT r.id, r.discord_id, r.livre, r.cree_le, r.modifie_le, pm.remarques_vues_le vues, pm.prenom, p.pseudo
      FROM remarques r LEFT JOIN profils_membres pm ON pm.discord_id = r.discord_id LEFT JOIN parcours p ON p.discord_id = r.discord_id
      WHERE r.envoi_id = ? ORDER BY r.id`),
    modifierEnvoi: db.prepare('UPDATE envois_messages SET titre = ?, texte = ?, modifie_le = ? WHERE id = ?'),
    modifierRemarques: db.prepare('UPDATE remarques SET titre = ?, texte = ?, modifie_le = ? WHERE envoi_id = ?'),
    ecrire: db.prepare('INSERT INTO messages_coach (discord_id, texte, images, sujet, cree_le) VALUES (?, ?, ?, ?, ?)'),
    recu: db.prepare('SELECT * FROM messages_coach WHERE id = ?'),
    aTraiter: db.prepare('SELECT * FROM messages_coach WHERE traite_le IS NULL ORDER BY cree_le'),
    deMembre: db.prepare('SELECT * FROM messages_coach WHERE discord_id = ? ORDER BY cree_le DESC LIMIT ?'),
    lu: db.prepare('UPDATE messages_coach SET lu_le = COALESCE(lu_le, ?) WHERE id = ?'),
    traite: db.prepare('UPDATE messages_coach SET traite_le = COALESCE(traite_le, ?), lu_le = COALESCE(lu_le, ?) WHERE id = ?'),
  };
  const iso = () => maintenant().toISOString();
  const images = (v) => { try { return JSON.parse(v || '[]'); } catch { return []; } };
  // Lu : l'élève a ouvert ses Remarques après l'envoi (ou après la dernière modification).
  const estLu = (d) => Boolean(d.vues && d.vues >= (d.modifie_le || d.cree_le));

  const api = {
    // Un envoi à plusieurs élèves. Renvoie l'envoi et une remarque par élève (pour les notifier).
    envoyer({ titre, texte, images: imgs = [], lien = null, ids = [] }) {
      const t = String(titre || '').trim().slice(0, TITRE_MAX) || null;
      const corps = String(texte || '').trim().slice(0, TEXTE_MAX);
      if (!corps && !imgs.length) return { erreur: 'Écris ton message.' };
      const eleves = [...new Set([].concat(ids || []).map(String))].map((id) => parcours.get(id)).filter((p) => p && !p.retire_le);
      if (!eleves.length) return { erreur: 'Choisis au moins un destinataire.' };
      const now = iso();
      const json = imgs.length ? JSON.stringify(imgs) : null;
      const envoiId = Number(q.envoi.run(t, corps || '(image)', json, lien, now).lastInsertRowid);
      const remarques = eleves.map((p) => ({ id: Number(q.remarque.run(p.discord_id, t, corps || '(image)', json, now, envoiId).lastInsertRowid), parcours: p }));
      return { envoi: api.envoi(envoiId), remarques };
    },
    marquerLivre(remarqueId, ok) { q.livre.run(ok ? 1 : 0, Number(remarqueId)); },

    envoi(id) {
      const e = q.unEnvoi.get(Number(id));
      if (!e) return null;
      const dest = q.destinataires.all(e.id).map((d) => ({ remarqueId: d.id, id: d.discord_id, nom: d.prenom || d.pseudo || d.discord_id, pseudo: d.pseudo,
        lu: estLu(d), livre: d.livre }));
      return {
        ...e, images: images(e.images), destinataires: dest,
        lus: dest.filter((d) => d.lu),
        livres: dest.filter((d) => !d.lu && d.livre === 1),
        nonLivres: dest.filter((d) => !d.lu && d.livre === 0),
        enCours: dest.filter((d) => !d.lu && (d.livre === null || d.livre === undefined)),
      };
    },
    envois(n = 30) { return q.envois.all(n).map((e) => api.envoi(e.id)); },
    // Le coach modifie un envoi (titre et texte) : toutes ses remarques changent. Renvoie ceux qui l'avaient déjà lu.
    modifier(id, { titre, texte }) {
      const e = api.envoi(id);
      if (!e) return { erreur: 'Message introuvable.' };
      const corps = String(texte || '').trim().slice(0, TEXTE_MAX);
      if (!corps) return { erreur: 'Le message ne peut pas être vide.' };
      const t = String(titre || '').trim().slice(0, TITRE_MAX) || null;
      const now = iso();
      q.modifierEnvoi.run(t, corps, now, e.id);
      q.modifierRemarques.run(t, corps, now, e.id);
      return { envoi: api.envoi(e.id), dejaLu: e.lus };
    },

    // ---- Élève → coach ----
    ecrireAuCoach(discordId, { texte, images: imgs = [], sujet = null }) {
      const corps = String(texte || '').trim().slice(0, TEXTE_MAX);
      if (!corps && !imgs.length) return { erreur: 'Écris ton message.' };
      const r = q.ecrire.run(String(discordId), corps || '(image)', imgs.length ? JSON.stringify(imgs) : null, sujet ? String(sujet).slice(0, 200) : null, iso());
      return { message: api.recu(Number(r.lastInsertRowid)) };
    },
    recu(id) { const m = q.recu.get(Number(id)); return m ? { ...m, images: images(m.images), parcours: parcours.get(m.discord_id) } : null; },
    recusATraiter() { return q.aTraiter.all().map((m) => ({ ...m, images: images(m.images), parcours: parcours.get(m.discord_id) })); },
    envoyesPar(discordId, n = 20) { return q.deMembre.all(String(discordId), n).map((m) => ({ ...m, images: images(m.images) })); },
    marquerLu(id) { q.lu.run(iso(), Number(id)); },
    marquerTraite(id) { const now = iso(); q.traite.run(now, now, Number(id)); },
  };
  return api;
}

module.exports = { creerMessages, TITRE_MAX, TEXTE_MAX };
