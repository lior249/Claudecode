'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Candidatures Elite, en deux étapes :
//   formulaire (Tally) → examen → retenu → vidéo d'1 minute → validé (lien de paiement) ; refusé possible à chaque étape.
const TRANSITIONS = {
  retenir: { depuis: ['examen'], vers: 'retenu' },
  refuser: { depuis: ['examen', 'retenu', 'video'], vers: 'refuse' },
  valider: { depuis: ['video'], vers: 'valide' },
};
const TYPES_VIDEO = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg' };

function creerCandidatures({ db, config, commandes, maintenant = () => new Date() }) {
  const dossierVideos = config.fichierBase === ':memory:'
    ? path.join(require('os').tmpdir(), 'overmaxx-videos')
    : path.join(path.dirname(path.resolve(config.fichierBase)), 'videos');
  fs.mkdirSync(dossierVideos, { recursive: true });
  const tailleMax = Number(config.videoMaxMo || 150) * 1024 * 1024;

  const q = {
    parDiscord: db.prepare('SELECT * FROM candidatures WHERE discord_id = ?'),
    parId: db.prepare('SELECT * FROM candidatures WHERE id = ?'),
    inserer: db.prepare("INSERT INTO candidatures (discord_id, pseudo, statut, cree_le, maj_le) VALUES (?, ?, 'formulaire', ?, ?)"),
    pseudo: db.prepare('UPDATE candidatures SET pseudo = COALESCE(?, pseudo), maj_le = ? WHERE id = ?'),
    formulaire: db.prepare("UPDATE candidatures SET reponses = ?, statut = 'examen', maj_le = ? WHERE id = ? AND statut = 'formulaire'"),
    statut: db.prepare('UPDATE candidatures SET statut = ?, maj_le = ?, decision_le = ? WHERE id = ? AND statut = ?'),
    video: db.prepare("UPDATE candidatures SET video_fichier = ?, video_type = ?, video_taille = ?, statut = 'video', maj_le = ? WHERE id = ? AND statut = 'retenu'"),
    effacerVideo: db.prepare('UPDATE candidatures SET video_fichier = NULL WHERE id = ?'),
    invitation: db.prepare('UPDATE candidatures SET invitation_token = ? WHERE id = ?'),
    liste: db.prepare(`SELECT * FROM candidatures ORDER BY CASE statut WHEN 'video' THEN 0 WHEN 'examen' THEN 1 WHEN 'retenu' THEN 2
                       WHEN 'formulaire' THEN 3 ELSE 4 END, maj_le DESC LIMIT 200`),
  };

  function supprimerVideo(c) {
    if (!c || !c.video_fichier) return;
    try { fs.unlinkSync(path.join(dossierVideos, c.video_fichier)); } catch { /* déjà supprimée */ }
    q.effacerVideo.run(c.id);
  }

  return {
    TYPES_VIDEO,
    tailleMax,
    dossierVideos,

    parDiscord(id) { return q.parDiscord.get(id) || null; },
    parId(id) { return q.parId.get(id) || null; },
    liste() { return q.liste.all().map((c) => ({ ...c, reponses: c.reponses ? JSON.parse(c.reponses) : [] })); },

    // Après la connexion Discord : crée la candidature si elle n'existe pas encore.
    demarrer(discordId, pseudo) {
      const iso = maintenant().toISOString();
      const c = q.parDiscord.get(discordId);
      if (c) { q.pseudo.run(pseudo || null, iso, c.id); return q.parId.get(c.id); }
      q.inserer.run(discordId, pseudo || null, iso, iso);
      return q.parDiscord.get(discordId);
    },

    // Webhook Tally : formulaire reçu pour ce compte Discord.
    recevoirFormulaire(discordId, champs) {
      const c = q.parDiscord.get(discordId);
      if (!c) return null;
      if (q.formulaire.run(JSON.stringify(champs), maintenant().toISOString(), c.id).changes !== 1) return null;
      return q.parId.get(c.id);
    },

    // Enregistre la vidéo envoyée (flux) ; refuse si trop lourde ou d'un autre type.
    async enregistrerVideo(candidature, flux, { type, taille }) {
      if (!candidature || candidature.statut !== 'retenu') return { erreur: 'Tu ne peux pas envoyer de vidéo à cette étape.' };
      const ext = TYPES_VIDEO[String(type || '').split(';')[0].trim().toLowerCase()];
      if (!ext) return { erreur: 'Format non accepté. Envoie une vidéo MP4, MOV ou WEBM.' };
      if (taille && taille > tailleMax) return { erreur: `Vidéo trop lourde (maximum ${Math.round(tailleMax / 1048576)} Mo).` };
      const nom = `${candidature.id}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const chemin = path.join(dossierVideos, nom);
      let recu = 0;
      const ok = await new Promise((resolve) => {
        const sortie = fs.createWriteStream(chemin);
        let trop = false;
        flux.on('data', (morceau) => {
          recu += morceau.length;
          if (recu > tailleMax && !trop) { trop = true; flux.unpipe(sortie); sortie.destroy(); resolve(false); }
        });
        flux.on('error', () => { sortie.destroy(); resolve(false); });
        sortie.on('finish', () => resolve(!trop));
        sortie.on('error', () => resolve(false));
        flux.pipe(sortie);
      });
      if (!ok || recu === 0) {
        try { fs.unlinkSync(chemin); } catch { /* rien */ }
        return { erreur: recu > tailleMax ? `Vidéo trop lourde (maximum ${Math.round(tailleMax / 1048576)} Mo).` : 'L\'envoi a échoué. Réessaie.' };
      }
      if (q.video.run(nom, ext, recu, maintenant().toISOString(), candidature.id).changes !== 1) {
        try { fs.unlinkSync(chemin); } catch { /* rien */ }
        return { erreur: 'Tu ne peux pas envoyer de vidéo à cette étape.' };
      }
      return { ok: true, candidature: q.parId.get(candidature.id) };
    },

    cheminVideo(c) {
      return c && c.video_fichier ? path.join(dossierVideos, c.video_fichier) : null;
    },

    // Décision de l'admin. La vidéo est supprimée dès qu'une décision finale est prise.
    decider(id, decision) {
      const t = TRANSITIONS[decision];
      const c = q.parId.get(Number(id));
      if (!t || !c) return { erreur: 'Candidature introuvable.' };
      if (!t.depuis.includes(c.statut)) return { erreur: `Déjà traitée (statut : ${c.statut}).` };
      const iso = maintenant().toISOString();
      if (q.statut.run(t.vers, iso, iso, c.id, c.statut).changes !== 1) return { erreur: 'Déjà traitée.' };
      if (t.vers === 'refuse' || t.vers === 'valide') supprimerVideo(c);
      if (t.vers === 'valide') {
        const inv = commandes.creerInvitation(`Candidature ${c.pseudo || c.discord_id}`);
        q.invitation.run(inv.token, c.id);
      }
      return { ok: true, candidature: q.parId.get(c.id) };
    },

    lienPaiement(c) {
      return c && c.invitation_token ? `${config.baseUrl}${config.offres.elite.base}/paiement/${c.invitation_token}` : null;
    },
  };
}

module.exports = { creerCandidatures, TRANSITIONS };
