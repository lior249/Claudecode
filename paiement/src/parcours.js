'use strict';

const { lienCompte } = require('./tiktok');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parcours de l'accompagnement Elite (docs/ACCOMPAGNEMENT-ELITE.md) :
//   étape 1 : exercices L1 et L2 (vidéo + note et retour de l'IA), validés par le coach, sans « refaire » ;
//   étape 2 : un coaching d'entrée réservé, puis le coach ouvre l'étape 3 ;
//   étape 3 : 3 vidéos, chacune « à corriger » (24 h pour renvoyer) ou validée ;
//   étape 4 : publication (livraison 2).
// Les vidéos d'une étape sont supprimées du serveur quand l'étape est validée.

const H = 3600 * 1000;
const DELAIS = { etape1: 72 * H, entree: 12 * H, etape3: 72 * H, correction: 24 * H };
const EMPLACEMENTS = { 1: ['L1', 'L2'], 3: ['V1', 'V2', 'V3'] };
// Étape 4 : faire relire une vidéo avant de la publier (facultatif), 3 en attente au plus.
const MAX_AVIS_ATTENTE = 3;
const TYPES_VIDEO = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v', 'video/mpeg': 'mpeg' };
const TYPES_IMAGE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Enregistre un flux (vidéo ou image) sur le disque, en refusant au-delà de la taille maximale.
async function enregistrerFlux(flux, chemin, tailleMax) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  let recu = 0;
  let cause = null;
  const ok = await new Promise((resolve) => {
    const sortie = fs.createWriteStream(chemin);
    let trop = false;
    flux.on('data', (morceau) => {
      recu += morceau.length;
      if (recu > tailleMax && !trop) { trop = true; flux.unpipe(sortie); sortie.destroy(); resolve(false); }
    });
    flux.on('error', (err) => { cause = err.message; sortie.destroy(); resolve(false); });
    sortie.on('finish', () => resolve(!trop));
    sortie.on('error', (err) => { cause = err.message; flux.unpipe(sortie); resolve(false); });
    flux.pipe(sortie);
  });
  if (!ok || recu === 0) {
    try { fs.unlinkSync(chemin); } catch { /* rien */ }
    return { erreur: recu > tailleMax ? `Fichier trop lourd (maximum ${Math.round(tailleMax / 1048576)} Mo).` : 'L\'envoi a échoué. Réessaie.', cause, recu };
  }
  return { ok: true, taille: recu };
}

function creerParcours({ db, config, maintenant = () => new Date() }) {
  const dossier = config.fichierBase === ':memory:'
    ? path.join(require('os').tmpdir(), 'overmaxx-parcours')
    : path.join(path.dirname(path.resolve(config.fichierBase)), 'parcours');
  const dossierVideos = path.join(dossier, 'videos');
  const dossierImages = path.join(dossier, 'images');
  const tailleVideo = Number(config.videoParcoursMo || 150) * 1024 * 1024;
  const tailleImage = 8 * 1024 * 1024;

  const q = {
    get: db.prepare('SELECT * FROM parcours WHERE discord_id = ?'),
    tous: db.prepare('SELECT * FROM parcours WHERE retire_le IS NULL ORDER BY etape, entree_le'),
    retirer: db.prepare('UPDATE parcours SET retire_le = ?, maj_le = ? WHERE discord_id = ? AND retire_le IS NULL'),
    rouvrir: db.prepare('UPDATE parcours SET retire_le = NULL, maj_le = ? WHERE discord_id = ? AND retire_le IS NOT NULL'),
    creer: db.prepare(`INSERT OR IGNORE INTO parcours (discord_id, pseudo, nom, etape, etape_depuis, entree_le, fin_le, cree_le, maj_le)
                       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`),
    etape: db.prepare('UPDATE parcours SET etape = ?, etape_depuis = ?, maj_le = ? WHERE discord_id = ?'),
    forcees: db.prepare('UPDATE parcours SET etapes_forcees = ?, maj_le = ? WHERE discord_id = ?'),
    dates: db.prepare('UPDATE parcours SET entree_le = ?, fin_le = ?, maj_le = ? WHERE discord_id = ?'),
    valideEtape: (n) => db.prepare(`UPDATE parcours SET etape${n}_le = ?, maj_le = ? WHERE discord_id = ?`),
    niveau: db.prepare('UPDATE parcours SET niveau = ?, maj_le = ? WHERE discord_id = ?'),
    compte: db.prepare('UPDATE parcours SET compte_tiktok = ?, niche = ?, pays = ?, maj_le = ? WHERE discord_id = ?'),
    soumission: db.prepare('SELECT * FROM soumissions WHERE id = ?'),
    soumissionDe: db.prepare('SELECT * FROM soumissions WHERE discord_id = ? AND emplacement = ?'),
    soumissionsEtape: db.prepare('SELECT * FROM soumissions WHERE discord_id = ? AND etape = ? ORDER BY emplacement'),
    enAttente: db.prepare("SELECT * FROM soumissions WHERE etat = 'attente' ORDER BY envoye_le"),
    nouvelleSoumission: db.prepare(`INSERT INTO soumissions (discord_id, etape, emplacement, etat, note, retour_ia, remarque_eleve, script, cree_le) VALUES (?, ?, ?, 'brouillon', ?, ?, ?, ?, ?)
                                    ON CONFLICT(discord_id, emplacement) DO UPDATE SET note = excluded.note, retour_ia = excluded.retour_ia,
                                      remarque_eleve = excluded.remarque_eleve, script = excluded.script`),
    videoRecue: db.prepare("UPDATE soumissions SET fichier = ?, type = ?, taille = ?, etat = 'attente', envoye_le = ?, corriger_avant = NULL WHERE id = ?"),
    decision: db.prepare('UPDATE soumissions SET etat = ?, decide_le = ?, corriger_avant = ? WHERE id = ?'),
    oublierFichier: db.prepare('UPDATE soumissions SET fichier = NULL WHERE id = ?'),
    remarque: db.prepare('INSERT INTO remarques (discord_id, soumission_id, type, texte, images, cree_le) VALUES (?, ?, ?, ?, ?, ?)'),
    remarques: db.prepare('SELECT * FROM remarques WHERE discord_id = ? ORDER BY cree_le DESC, id DESC'),
    remarquesDe: db.prepare('SELECT * FROM remarques WHERE soumission_id = ? ORDER BY cree_le DESC, id DESC'),
    imageDe: db.prepare('SELECT discord_id FROM remarques WHERE images LIKE ?'),
    imageMembre: db.prepare('SELECT discord_id FROM images_membres WHERE nom = ?'),
    noterImageMembre: db.prepare('INSERT OR IGNORE INTO images_membres (nom, discord_id, cree_le) VALUES (?, ?, ?)'),
    entree: db.prepare("SELECT * FROM seances_ponctuelles WHERE discord_id = ? AND type = 'entree' ORDER BY date DESC, heure DESC LIMIT 1"),
  };
  const iso = () => maintenant().toISOString();

  function supprimerFichier(s) {
    if (!s || !s.fichier) return;
    try { fs.unlinkSync(path.join(dossierVideos, s.fichier)); } catch { /* déjà supprimée */ }
    q.oublierFichier.run(s.id);
  }

  // Passe à l'étape suivante quand tous les envois de l'étape sont validés (vidéos supprimées).
  function verifierEtape(discordId) {
    const p = q.get.get(discordId);
    if (!p || !EMPLACEMENTS[p.etape]) return null;
    const envois = q.soumissionsEtape.all(discordId, p.etape);
    const valides = EMPLACEMENTS[p.etape].every((e) => envois.some((s) => s.emplacement === e && s.etat === 'valide'));
    if (!valides) return null;
    for (const s of envois) supprimerFichier(s);
    const suivante = p.etape + 1;
    q.valideEtape(p.etape).run(iso(), iso(), discordId);
    q.etape.run(suivante, iso(), iso(), discordId);
    return suivante;
  }

  const api = {
    DELAIS,
    EMPLACEMENTS,
    dossierImages,

    get(discordId) { return (discordId && q.get.get(discordId)) || null; },
    tous() { return q.tous.all(); },

    // Crée le parcours d'un membre Elite (une seule fois) : étape 1, 90 jours à partir de son entrée.
    assurer(discordId, { pseudo, nom, entree, fin } = {}) {
      if (!discordId) return null;
      const debut = entree ? new Date(entree) : maintenant();
      const finLe = fin ? new Date(fin) : new Date(debut.getTime() + 90 * 24 * H);
      q.creer.run(discordId, pseudo || null, nom || null, iso(), debut.toISOString(), finLe.toISOString(), iso(), iso());
      q.rouvrir.run(iso(), discordId); // accès rouvert : il retrouve son parcours là où il en était
      return q.get.get(discordId);
    },
    // Accès au site refusé : son parcours ne s'ouvre plus et sort des listes (rien n'est effacé).
    retirer(discordId) { return q.retirer.run(iso(), iso(), discordId).changes === 1; },

    soumissions(discordId, etape) { return q.soumissionsEtape.all(discordId, etape); },
    soumission(id) { return q.soumission.get(Number(id)) || null; },
    cheminVideo(s) { return s && s.fichier ? path.join(dossierVideos, s.fichier) : null; },

    // Étape 1 : note et retour de l'IA d'abord, la vidéo ensuite (envoi en deux temps, avec la barre de progression).
    // Étapes 3 et 4 : une remarque et le script de la vidéo peuvent l'accompagner (facultatifs).
    // Étape 4 : emplacement « avis » = une nouvelle vidéo à relire (R1, R2…), 3 en attente au plus.
    preparerEnvoi(discordId, emplacement, { note, retour, remarque, script } = {}) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Ton parcours Elite n\'est pas encore ouvert.' };
      if (p.etape >= 4 && (emplacement === 'avis' || /^R\d+$/.test(emplacement))) {
        const mes = q.soumissionsEtape.all(discordId, 4);
        const existante = mes.find((x) => x.emplacement === emplacement);
        if (!existante || existante.etat !== 'brouillon') {
          if (mes.filter((x) => x.etat === 'attente').length >= MAX_AVIS_ATTENTE) return { erreur: `Tu as déjà ${MAX_AVIS_ATTENTE} vidéos en attente de l'avis du coach : attends sa réponse.` };
          if (emplacement !== 'avis' && existante && existante.etat === 'valide') return { erreur: 'Déjà validée.' };
          if (emplacement === 'avis') {
            const brouillon = mes.find((x) => x.etat === 'brouillon');
            emplacement = brouillon ? brouillon.emplacement : `R${mes.reduce((n, x) => Math.max(n, Number(x.emplacement.slice(1)) || 0), 0) + 1}`;
          }
        }
        const t = (v, n) => String(v || '').trim().slice(0, n) || null;
        q.nouvelleSoumission.run(discordId, 4, emplacement, null, null, t(remarque, 2000), t(script, 8000), iso());
        return { soumission: q.soumissionDe.get(discordId, emplacement) };
      }
      if (!(EMPLACEMENTS[p.etape] || []).includes(emplacement)) return { erreur: 'Cet envoi n\'est pas ouvert à ton étape.' };
      const deja = q.soumissionDe.get(discordId, emplacement);
      if (deja && deja.etat === 'valide') return { erreur: 'Déjà validé : il ne peut plus être modifié.' };
      let n = null;
      let texte = null;
      if (p.etape === 1) {
        n = Number(note);
        if (!Number.isInteger(n) || n < 0 || n > 100) return { erreur: 'Écris la note de l\'IA, un nombre entre 0 et 100.' };
        texte = String(retour || '').trim();
        if (texte.length < 10) return { erreur: 'Colle le retour complet de l\'IA.' };
        texte = texte.slice(0, 8000);
      }
      const t = (v, m) => (p.etape === 3 ? String(v || '').trim().slice(0, m) || null : null);
      q.nouvelleSoumission.run(discordId, p.etape, emplacement, n, texte, t(remarque, 2000), t(script, 8000), iso());
      return { soumission: q.soumissionDe.get(discordId, emplacement) };
    },

    async recevoirVideo(discordId, id, flux, { type, taille }) {
      const s = q.soumission.get(Number(id));
      if (!s || s.discord_id !== discordId || s.etat === 'valide') return { erreur: 'Cet envoi n\'est pas ouvert.' };
      const ext = TYPES_VIDEO[String(type || '').split(';')[0].trim().toLowerCase()];
      if (!ext) return { erreur: 'Format non accepté. Envoie une vidéo MP4, MOV ou WEBM.' };
      if (taille && taille > tailleVideo) return { erreur: `Vidéo trop lourde (maximum ${Math.round(tailleVideo / 1048576)} Mo).` };
      const nom = `${s.discord_id}-${s.emplacement}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const r = await enregistrerFlux(flux, path.join(dossierVideos, nom), tailleVideo);
      if (r.erreur) { console.error(`[parcours] vidéo ${s.emplacement} de ${discordId} refusée : ${r.cause || r.erreur}`); return { erreur: r.erreur }; }
      supprimerFichier(s); // l'ancienne version est remplacée
      q.videoRecue.run(nom, ext, r.taille, iso(), s.id);
      // Étape 4 : seules les 3 dernières vidéos restent sur le serveur ; les plus anciennes sont effacées (leur avis reste).
      if (s.etape === 4) {
        const avecFichier = q.soumissionsEtape.all(discordId, 4).filter((x) => x.fichier).sort((a, b) => String(b.envoye_le || '').localeCompare(String(a.envoye_le || '')));
        for (const vieille of avecFichier.slice(3)) { supprimerFichier(vieille); q.oublierFichier.run(vieille.id); }
      }
      return { soumission: q.soumission.get(s.id) };
    },

    // Décision du coach : « valider » (coche verte, plus rien ne bouge) ou « corriger » (24 h pour renvoyer).
    // À l'étape 1, pas de « corriger » : le coach écrit ses remarques et valide.
    decider(id, decision, { texte, images = [], niveau } = {}) {
      const s = q.soumission.get(Number(id));
      if (!s) return { erreur: 'Envoi introuvable.' };
      if (s.etat !== 'attente') return { erreur: 'Cet envoi a déjà été traité.' };
      if (decision === 'corriger' && s.etape === 1) return { erreur: 'À l\'étape 1, les exercices ne se refont pas : écris tes remarques et valide.' };
      if (!['valider', 'corriger'].includes(decision)) return { erreur: 'Décision inconnue.' };
      const mot = String(texte || '').trim().slice(0, 8000);
      if (decision === 'corriger' && !mot) return { erreur: 'Écris ce qu\'il doit modifier.' };
      // Étape 4 (vidéo à relire) : un avis, pas de délai pour renvoyer.
      const avant = decision === 'corriger' && s.etape !== 4 ? new Date(maintenant().getTime() + DELAIS.correction).toISOString() : null;
      q.decision.run(decision === 'valider' ? 'valide' : 'corriger', iso(), avant, s.id);
      if (mot || images.length) q.remarque.run(s.discord_id, s.id, decision === 'valider' ? 'valide' : 'corriger', mot || '(image)', images.length ? JSON.stringify(images) : null, iso());
      if (s.etape === 1 && niveau && ['L1', 'L2'].includes(niveau)) q.niveau.run(niveau, iso(), s.discord_id);
      let etapeSuivante = null;
      if (decision === 'valider') {
        if (s.etape === 1 && !q.get.get(s.discord_id).niveau) q.niveau.run(api.niveauPropose(s.discord_id), iso(), s.discord_id);
        etapeSuivante = verifierEtape(s.discord_id);
      }
      return { soumission: q.soumission.get(s.id), etapeSuivante, parcours: q.get.get(s.discord_id) };
    },

    // L2 si les deux notes de l'IA sont d'au moins 80, sinon L1.
    niveauPropose(discordId) {
      const notes = ['L1', 'L2'].map((e) => (q.soumissionDe.get(discordId, e) || {}).note);
      return notes.every((n) => Number(n) >= 80) ? 'L2' : 'L1';
    },

    ajouterRemarque(discordId, { texte, images = [], soumissionId = null, type = 'remarque' }) {
      const mot = String(texte || '').trim().slice(0, 8000);
      if (!mot && !images.length) return { erreur: 'Écris ta remarque.' };
      if (!q.get.get(discordId)) return { erreur: 'Membre introuvable.' };
      const r = q.remarque.run(discordId, soumissionId, type, mot || '(image)', images.length ? JSON.stringify(images) : null, iso());
      return { id: Number(r.lastInsertRowid) };
    },
    // Le coach modifie une remarque (texte seulement) ; elle ne se supprime jamais.
    modifierRemarque(id, texte) {
      const mot = String(texte || '').trim().slice(0, 8000);
      if (!mot) return { erreur: 'La remarque ne peut pas être vide.' };
      const r = db.prepare('SELECT * FROM remarques WHERE id = ?').get(Number(id));
      if (!r) return { erreur: 'Remarque introuvable.' };
      db.prepare('UPDATE remarques SET texte = ?, modifie_le = ? WHERE id = ?').run(mot, iso(), r.id);
      return { remarque: { ...r, texte: mot } };
    },
    dernieresRemarques(n = 40) {
      return db.prepare('SELECT * FROM remarques ORDER BY COALESCE(modifie_le, cree_le) DESC, id DESC LIMIT ?').all(n)
        .map((r) => ({ ...r, images: r.images ? JSON.parse(r.images) : [], parcours: q.get.get(r.discord_id) }));
    },
    remarques(discordId) {
      return q.remarques.all(discordId).map((r) => ({ ...r, images: r.images ? JSON.parse(r.images) : [] }));
    },
    remarquesDe(soumissionId) {
      return q.remarquesDe.all(soumissionId).map((r) => ({ ...r, images: r.images ? JSON.parse(r.images) : [] }));
    },

    // Images jointes aux remarques (coach) : enregistrées à part, puis citées par leur nom.
    // Images : jointes par le coach (remarques), ou envoyées par le membre (captures du compte et des revenus).
    async recevoirImage(flux, { type, taille }, proprietaire = null) {
      const ext = TYPES_IMAGE[String(type || '').split(';')[0].trim().toLowerCase()];
      if (!ext) return { erreur: 'Image non acceptée (JPG, PNG, WEBP ou GIF).' };
      if (taille && taille > tailleImage) return { erreur: 'Image trop lourde (8 Mo maximum).' };
      const nom = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
      const r = await enregistrerFlux(flux, path.join(dossierImages, nom), tailleImage);
      if (r.erreur) return { erreur: r.erreur };
      if (proprietaire) q.noterImageMembre.run(nom, proprietaire, iso());
      return { nom };
    },
    cheminImage(nom) {
      return /^[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(String(nom)) ? path.join(dossierImages, nom) : null;
    },
    // À qui appartient une image (pour que seul le membre concerné et le coach la voient).
    proprietaireImage(nom) {
      const m = q.imageMembre.get(String(nom));
      if (m) return m.discord_id;
      const r = q.imageDe.get(`%"${String(nom).replace(/[%_"]/g, '')}"%`);
      return r ? r.discord_id : null;
    },
    // Un membre voit ses propres images, et celles jointes aux remarques et messages qu'il a reçus (un message peut aller à plusieurs élèves).
    peutVoirImage(nom, discordId) {
      const m = q.imageMembre.get(String(nom));
      if (m && m.discord_id === discordId) return true;
      return Boolean(db.prepare('SELECT 1 FROM remarques WHERE discord_id = ? AND images LIKE ?').get(String(discordId), `%"${String(nom).replace(/[%_"]/g, '')}"%`));
    },
    imageDuMembre(nom, discordId) { const m = q.imageMembre.get(String(nom)); return Boolean(m && m.discord_id === discordId); },

    // Le coach ouvre l'étape 3 après le coaching d'entrée (compte TikTok, niche, pays notés sur la fiche).
    ouvrirEtape3(discordId, { compte, niche, pays } = {}) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Membre introuvable.' };
      if (p.etape !== 2) return { erreur: 'Il n\'est pas à l\'étape 2.' };
      api.majCompte(discordId, { compte, niche, pays });
      q.valideEtape(2).run(iso(), iso(), discordId);
      q.etape.run(3, iso(), iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },
    majCompte(discordId, { compte, niche, pays } = {}) {
      const p = q.get.get(discordId);
      if (!p) return null;
      const net = (v, ancien) => (v === undefined ? ancien : String(v).trim().slice(0, 120) || null);
      let c = net(compte, p.compte_tiktok);
      if (c && compte !== undefined) { const l = lienCompte(c); if (l) c = l; } // lien du profil TikTok
      q.compte.run(c, net(niche, p.niche), net(pays, p.pays), iso(), discordId);
      return q.get.get(discordId);
    },
    // Étape 3 : l'élève choisit sa niche (une niche publique, ou la sienne proposée au coach), sa méthode 10K et son pays cible.
    // Visible par le coach seulement (jamais dans le classement ni par les autres élèves).
    choisirStrategie(discordId, { niche, methode, pays } = {}, { coach = false } = {}) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Membre introuvable.' };
      // Validé par le coach : c'est avec ce positionnement qu'on l'accompagne ; seul le coach peut le changer.
      if (!coach && p.positionnement_valide_le) return { erreur: 'Ton positionnement est validé par ton coach : il ne se change plus. Écris-lui si tu as une vraie raison.' };
      const ressource = (id, type) => (id === undefined || id === '' ? undefined
        : db.prepare("SELECT * FROM ressources WHERE id = ? AND type = ? AND (etat = 'public' OR (auteur = ? AND etat != 'refuse'))").get(Number(id), type, discordId) || null);
      const n = ressource(niche, 'niche'); const m = ressource(methode, 'methode');
      if (n === null) return { erreur: 'Choisis une niche de la liste.' };
      // Un profil L1 ne prend pas de niche L2 (commentaire) ; un profil L2 peut tout prendre.
      if (n && n.categorie === 'L2' && p.niveau === 'L1') return { erreur: 'Cette niche est en L2 (commentaire) : elle est réservée aux profils L2.' };
      if (m === null) return { erreur: 'Choisis une méthode de la liste.' };
      const PAYS = require('./ressources').PAYS;
      if (pays !== undefined && pays !== '' && !PAYS.includes(pays)) return { erreur: 'Choisis un pays de la liste.' };
      db.prepare(`UPDATE parcours SET niche_id = COALESCE(?, niche_id), niche = COALESCE(?, niche), methode_id = COALESCE(?, methode_id),
        pays_cible = COALESCE(?, pays_cible), maj_le = ? WHERE discord_id = ?`)
        .run(n ? n.id : null, n ? n.titre : null, m ? m.id : null, pays || null, iso(), discordId);
      const apres = q.get.get(discordId);
      // Complet : envoyé au coach (l'élève) ; validé d'office quand c'est le coach qui le choisit.
      if (apres.niche_id && apres.methode_id && apres.pays_cible) {
        if (coach) db.prepare('UPDATE parcours SET positionnement_le = COALESCE(positionnement_le, ?), positionnement_valide_le = ? WHERE discord_id = ?').run(iso(), iso(), discordId);
        else db.prepare('UPDATE parcours SET positionnement_le = ?, positionnement_valide_le = NULL WHERE discord_id = ?').run(iso(), discordId);
      }
      return { parcours: q.get.get(discordId), envoye: !coach && Boolean(apres.niche_id && apres.methode_id && apres.pays_cible) };
    },
    strategie(discordId) {
      const p = q.get.get(discordId);
      if (!p) return null;
      const r = (id) => (id ? db.prepare('SELECT id, type, titre, categorie, pour, etat FROM ressources WHERE id = ?').get(id) || null : null);
      const niche = r(p.niche_id); const methode = r(p.methode_id);
      return { niche, methode, pays: p.pays_cible || null, complete: Boolean(niche && methode && p.pays_cible),
        envoye: Boolean(p.positionnement_le), valide: Boolean(p.positionnement_valide_le) };
    },
    validerPositionnement(discordId) {
      const p = q.get.get(discordId);
      if (!p || !(p.niche_id && p.methode_id && p.pays_cible)) return { erreur: 'Positionnement incomplet.' };
      db.prepare('UPDATE parcours SET positionnement_valide_le = ?, positionnement_le = COALESCE(positionnement_le, ?) WHERE discord_id = ?').run(iso(), iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },
    // ---- Compte TikTok : envoyé par l'élève, validé par le coach, puis verrouillé ----
    envoyerCompte(discordId, lien) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Membre introuvable.' };
      if (p.compte_valide_le && !p.compte_change_autorise) return { erreur: 'Ton compte est validé par ton coach : demande-lui un changement si besoin (compte bloqué, shadowban…).' };
      api.majCompte(discordId, { compte: lien });
      db.prepare('UPDATE parcours SET compte_envoye_le = ?, compte_valide_le = NULL, compte_change_autorise = NULL, compte_demande = NULL, compte_demande_le = NULL WHERE discord_id = ?').run(iso(), discordId);
      return { parcours: q.get.get(discordId), changement: Boolean(p.compte_valide_le) };
    },
    validerCompte(discordId) {
      const p = q.get.get(discordId);
      if (!p || !p.compte_tiktok) return { erreur: 'Aucun compte à valider.' };
      db.prepare('UPDATE parcours SET compte_valide_le = ?, compte_change_autorise = NULL WHERE discord_id = ?').run(iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },
    demanderChangementCompte(discordId, motif) {
      const p = q.get.get(discordId);
      if (!p || !p.compte_valide_le) return { erreur: 'Ton compte n\'est pas encore validé : tu peux encore le changer toi-même.' };
      const m = String(motif || '').trim().slice(0, 1000);
      if (m.length < 5) return { erreur: 'Explique pourquoi tu dois changer de compte (compte bloqué, shadowban…).' };
      db.prepare('UPDATE parcours SET compte_demande = ?, compte_demande_le = ? WHERE discord_id = ?').run(m, iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },
    // Le coach autorise (ou refuse) un changement de compte : l'élève pourra envoyer un nouveau lien une fois.
    deciderChangementCompte(discordId, autoriser) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Membre introuvable.' };
      db.prepare('UPDATE parcours SET compte_change_autorise = ?, compte_demande = NULL, compte_demande_le = NULL WHERE discord_id = ?').run(autoriser ? 1 : null, discordId);
      return { parcours: q.get.get(discordId) };
    },
    // Pour À traiter : positionnements et comptes envoyés à valider, demandes de changement de compte.
    aValider() {
      const tous = q.tous.all().filter((p) => !p.retire_le);
      return {
        positionnements: tous.filter((p) => p.positionnement_le && !p.positionnement_valide_le),
        comptes: tous.filter((p) => p.compte_envoye_le && p.compte_tiktok && !p.compte_valide_le),
        demandes: tous.filter((p) => p.compte_demande_le),
      };
    },
    // Ce qui n'a pas été validé sur la plateforme, étape par étape (tableau des élèves).
    manquants(discordId) {
      const p = q.get.get(discordId);
      if (!p) return null;
      const etat = (e) => (q.soumissionDe.get(discordId, e) || {}).etat;
      const entree = q.entree.get(discordId);
      const entreeFaite = Boolean(entree && new Date(`${entree.date}T${entree.heure}:00.000Z`) < maintenant());
      const r = {
        1: [...['L1', 'L2'].filter((e) => etat(e) !== 'valide').map((e) => `Exercice ${e} pas validé`), ...(p.niveau ? [] : ['Profil type (L1 ou L2) pas choisi'])],
        2: entreeFaite ? [] : ['Coaching d\'entrée pas fait'],
        3: [...(p.niche_id && p.methode_id && p.pays_cible ? [] : ['Niche, méthode 10K ou pays pas choisis']),
          ...['V1', 'V2', 'V3'].filter((e) => etat(e) !== 'valide').map((e) => `Vidéo ${e.slice(1)} pas validée`)],
      };
      for (const k of [1, 2, 3]) if (p.etape > k) r[k] = []; // étapes déjà franchies
      return r;
    },
    // Le coach déplace un élève (tableau des élèves) : vers l'avant, les étapes sautées sont marquées « passées par le coach »
    // (leurs envois non validés sont laissés de côté). Le compte TikTok, l'élève le donne lui-même en arrivant à l'étape 4.
    // GOAT ne se donne jamais à la main : il se gagne avec des résultats suivis sur la plateforme.
    forcerEtape(discordId, cible, { compte, niche, pays, niveau } = {}) {
      const p = q.get.get(discordId);
      if (!p) return { erreur: 'Élève introuvable.' };
      const n = Number(cible);
      if (n >= 5) return { erreur: 'Le rôle GOAT se gagne avec des résultats suivis sur la plateforme : il ne se donne pas à la main.' };
      if (![1, 2, 3, 4].includes(n)) return { erreur: 'Étape invalide.' };
      if (p.etape >= 5) return { erreur: 'Il est GOAT : son étape ne se change plus à la main.' };
      const champs = {};
      for (const [k, v] of Object.entries({ compte, niche, pays })) if (typeof v === 'string' && v.trim()) champs[k] = v;
      if (Object.keys(champs).length) api.majCompte(discordId, champs);
      const apres = q.get.get(discordId);
      if (['L1', 'L2'].includes(niveau) && !apres.niveau) q.niveau.run(niveau, iso(), discordId);
      if (n === p.etape) return { parcours: q.get.get(discordId), forcees: [] };
      const forcees = [];
      for (let k = p.etape; k < n; k++) {
        forcees.push(k);
        if (k <= 3 && !apres[`etape${k}_le`]) q.valideEtape(k).run(iso(), iso(), discordId);
        for (const s of q.soumissionsEtape.all(discordId, k)) {
          if (s.etat === 'valide') continue;
          supprimerFichier(s);
          q.decision.run('force', iso(), null, s.id);
        }
      }
      q.etape.run(n, iso(), iso(), discordId);
      if (forcees.length) q.forcees.run(JSON.stringify([...new Set([...JSON.parse(p.etapes_forcees || '[]'), ...forcees])].sort()), iso(), discordId);
      return { parcours: q.get.get(discordId), forcees };
    },
    // Le coach complète les informations d'un élève (tableau des élèves) : compte TikTok, niche, pays, niveau, date d'entrée.
    majInfos(discordId, { compte, niche, pays, niveau, entree } = {}) {
      if (!q.get.get(discordId)) return { erreur: 'Élève introuvable.' };
      const champs = {};
      for (const [k, v] of Object.entries({ compte, niche, pays })) if (typeof v === 'string' && v.trim()) champs[k] = v;
      if (Object.keys(champs).length) api.majCompte(discordId, champs);
      if (['L1', 'L2'].includes(niveau)) q.niveau.run(niveau, iso(), discordId);
      if (entree && /^\d{4}-\d{2}-\d{2}$/.test(String(entree))) api.majEntree(discordId, `${entree}T12:00:00.000Z`);
      return { parcours: q.get.get(discordId) };
    },
    // Date d'entrée d'un élève déjà accompagné avant la plateforme (ses 90 jours partent de là).
    majEntree(discordId, entree) {
      const d = new Date(entree);
      if (Number.isNaN(d.getTime())) return { erreur: 'Date invalide.' };
      q.dates.run(d.toISOString(), new Date(d.getTime() + 90 * 24 * H).toISOString(), iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },

    // Correction manuelle de l'étape par le coach.
    changerEtape(discordId, etape) {
      const n = Number(etape);
      if (!q.get.get(discordId) || !Number.isInteger(n) || n < 1 || n > 5) return { erreur: 'Étape invalide.' };
      q.etape.run(n, iso(), iso(), discordId);
      return { parcours: q.get.get(discordId) };
    },

    entree(discordId) { return q.entree.get(discordId) || null; },

    // La tâche en cours du membre et son délai (pour Mon parcours et les rappels de Bob).
    tache(discordId) {
      const p = q.get.get(discordId);
      if (!p) return null;
      const depuis = new Date(p.etape_depuis).getTime();
      const fin = (duree) => ({ fin: new Date(depuis + duree).toISOString(), duree });
      const envois = EMPLACEMENTS[p.etape] ? q.soumissionsEtape.all(discordId, p.etape) : [];
      const etatDe = (e) => (envois.find((s) => s.emplacement === e) || {}).etat || 'vide';
      if (p.etape === 1) {
        const manquants = ['L1', 'L2'].filter((e) => ['vide', 'brouillon'].includes(etatDe(e)));
        return manquants.length
          ? { cle: 'etape1', titre: 'Envoie tes exercices L1 et L2', texte: `Regarde la première partie des modules, puis envoie ${manquants.length === 2 ? 'tes deux exercices' : `ton exercice ${manquants[0]}`}.`, lien: '/parcours/etape-1', bouton: 'Ouvrir l\'étape 1', delai: fin(DELAIS.etape1) }
          : { cle: 'attente1', titre: 'Ton coach regarde tes exercices', texte: 'Tu seras prévenu dès qu\'il les aura validés. En attendant, continue les modules.', lien: '/parcours/etape-1', bouton: 'Voir mes exercices' };
      }
      if (p.etape === 2) {
        const e = q.entree.get(discordId);
        return e
          ? { cle: 'entree-reservee', titre: 'Prépare ton coaching d\'entrée', texte: `Il a lieu le ${e.date} à ${e.heure} GMT. Viens avec tes exercices et tes disponibilités.`, lien: '/parcours/etape-2', bouton: 'Ouvrir l\'étape 2' }
          : { cle: 'entree', titre: 'Réserve ton coaching d\'entrée', texte: 'Choisis un créneau de 30 minutes avec ton coach.', lien: '/parcours/etape-2', bouton: 'Choisir mon créneau', delai: fin(DELAIS.entree) };
      }
      if (p.etape === 3) {
        const aCorriger = envois.filter((s) => s.etat === 'corriger').sort((a, b) => a.corriger_avant.localeCompare(b.corriger_avant));
        if (aCorriger.length) {
          const s = aCorriger[0];
          return { cle: `correction-${s.emplacement}-${s.decide_le}`, titre: `Corrige ta vidéo ${s.emplacement.slice(1)}`, texte: 'Ton coach demande des modifications : lis sa remarque et renvoie la nouvelle version.', lien: '/parcours/etape-3', bouton: 'Ouvrir l\'étape 3', delai: { fin: s.corriger_avant, duree: DELAIS.correction } };
        }
        if (!(p.niche_id && p.methode_id && p.pays_cible)) {
          return { cle: 'strategie', titre: 'Choisis ta niche, ta méthode et ton pays', texte: 'Ta niche, ta méthode pour atteindre 10K abonnés et le pays que tu vises : seul ton coach les voit.', lien: '/parcours/etape-3#strategie', bouton: 'Choisir', delai: fin(DELAIS.etape3) };
        }
        const manquantes = ['V1', 'V2', 'V3'].filter((e) => ['vide', 'brouillon'].includes(etatDe(e)));
        return manquantes.length
          ? { cle: 'etape3', titre: 'Envoie tes 3 vidéos', texte: `Il en reste ${manquantes.length} à envoyer. Ne publie rien pour l'instant.`, lien: '/parcours/etape-3', bouton: 'Ouvrir l\'étape 3', delai: fin(DELAIS.etape3) }
          : { cle: 'attente3', titre: 'Ton coach regarde tes vidéos', texte: 'Tu seras prévenu à chaque décision.', lien: '/parcours/etape-3', bouton: 'Voir mes vidéos' };
      }
      if (p.etape === 4) return api.suivi ? api.suivi.tache(p) : { cle: 'etape4', titre: 'Publie et suis tes vidéos', texte: 'Une vidéo par jour, puis son compte rendu le lendemain.', lien: '/parcours/etape-4', bouton: 'Ouvrir l\'étape 4' };
      return { cle: 'goat', titre: 'Tu es GOAT', texte: 'Bravo : tu as atteint l\'objectif de l\'accompagnement.', lien: '/fiche', bouton: 'Ma fiche' };
    },

    // Le suivi de l'étape 4 (src/suivi.js), branché par l'application.
    suivi: null,

    // Pour la page À traiter du coach.
    aTraiter() {
      const maintenantMs = maintenant().getTime();
      const envois = q.enAttente.all().map((s) => ({ ...s, parcours: q.get.get(s.discord_id) }));
      const etape2 = q.tous.all().filter((p) => p.etape === 2).map((p) => ({ parcours: p, entree: q.entree.get(p.discord_id) }))
        .filter((x) => x.entree && new Date(`${x.entree.date}T${x.entree.heure}:00Z`).getTime() < maintenantMs);
      const retards = q.tous.all().filter((p) => p.etape <= 4 && !p.sinistre_depuis).map((p) => ({ parcours: p, tache: api.tache(p.discord_id) }))
        .filter((x) => x.tache && x.tache.delai && new Date(x.tache.delai.fin).getTime() < maintenantMs);
      return { envois, etape2, retards, total: envois.length + etape2.length };
    },
  };
  return api;
}

module.exports = { creerParcours, enregistrerFlux, DELAIS, EMPLACEMENTS, MAX_AVIS_ATTENTE };
