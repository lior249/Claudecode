'use strict';

const crypto = require('crypto');
const express = require('express');
const { signatureValide } = require('./saspay');
const { lireJetonMembre, lienRenouvellement } = require('./liens');
const { lireSession, ouvrirSession, fermerSession, verifier, signer, lireAppareil, oublierAppareil } = require('./discord-oauth');
const P = require('./pages');
const E = require('./pages-espace');
const V = require('./pages-parcours');
const C = require('./pages-coaching');
const N = require('./pages-notifications');
const K = require('./pages-eleves');
const A = require('./pages-accueil');
const T = require('./pages-classement');
const { creerParcours } = require('./parcours');
const { creerSuivi, QUESTIONS, jourLisible } = require('./suivi');
const { creerSinistres } = require('./sinistres');
const { creerAccesManuels } = require('./acces-manuels');
const { creerCommunaute } = require('./communaute');
const { creerNotifsAdmin } = require('./admin-notifs');
const { creerMessages } = require('./messages');
const { creerRessources } = require('./ressources');
const RS = require('./pages-ressources');
const { lienCompte } = require('./tiktok');
const PF = require('./pages-profil');
const { roleLePlusHaut } = require('./pages-classement');
const { verifierReponses } = require('./formulaires');

const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const REF_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

function lireFormulaire(body) {
  return {
    nom: String(body.nom || '').trim().slice(0, 100),
    email: String(body.email || '').trim().toLowerCase().slice(0, 200),
    telephone: String(body.telephone || '').replace(/[^\d+]/g, '').slice(0, 20),
    m: typeof body.m === 'string' ? body.m.slice(0, 600) : '',
  };
}

const retourSur = (r, defaut = '/coaching') => (typeof r === 'string' && /^\/(?![/\\])/.test(r) && !/[\u0000-\u001f]/.test(r) ? r.slice(0, 300) : defaut);

// Le bouton pointe DIRECTEMENT vers discord.com : sur téléphone, c'est ce qui ouvre l'application Discord
// (une redirection depuis notre site ouvrirait la page web de Discord, qui redemande l'identifiant et le mot de passe).

function creerApp({ config, commandes, whop, coaching, oauth, bob, candidatures, parcours: parcoursDonne, suivi: suiviDonne, sinistres: sinistresDonnes, push: pushDonne, accesManuels, communaute: communauteDonnee }) {
  const parcours = parcoursDonne || creerParcours({ db: commandes.db, config });
  const suivi = suiviDonne || creerSuivi({ db: commandes.db, parcours });
  const sinistres = sinistresDonnes || creerSinistres({ db: commandes.db, parcours });
  if (!parcours.suivi) parcours.suivi = suivi;
  const push = pushDonne || require('./push').creerPush({ db: commandes.db, config });
  // Rôles donnés à la main : les réponses du coach (Oui / Non), partagées avec Bob.
  const acces = accesManuels || (bob && bob.acces) || creerAccesManuels({ db: commandes.db, parcours, coaching });
  // Suivis, concurrences et chaîne d'activité des élèves Elite.
  const communaute = communauteDonnee || creerCommunaute({ db: commandes.db, parcours, suivi });
  // Espace notifications du coach : journal des messages de Bob et rappels.
  const notifsAdmin = (bob && bob.notifsAdmin) || creerNotifsAdmin({ db: commandes.db });
  const messages = creerMessages({ db: commandes.db, parcours });
  const ressources = creerRessources({ db: commandes.db });
  // Notifie chaque destinataire d'un message du coach, l'un après l'autre, et note s'il a été délivré (👍) ou non (👎).
  function diffuser(envoi, remarques, options = {}) {
    const envoyer = bob && bob.parcours && bob.parcours.message;
    (async () => {
      for (const r of remarques) {
        let ok = false;
        try { ok = envoyer ? Boolean(await envoyer(envoi, r.parcours, options)) : false; } catch (err) { console.error('[bob] message :', err.message); }
        messages.marquerLivre(r.id, ok);
      }
    })();
  }
  // Jeton de l'application installée (dans son manifeste) : elle s'ouvre déjà connectée, même sur iPhone.
  // Le même toute la journée, valable un an.
  const jetonApp = (session) => signer({ but: 'app', id: session.id, pseudo: session.pseudo, exp: (Math.floor(Date.now() / 864e5) + 365) * 864e5 }, config.secretApp);
  const prevenir = (nom, ...args) => { if (bob && bob.parcours && bob.parcours[nom]) bob.parcours[nom](...args).catch((e) => console.error(`[bob] parcours ${nom} :`, e.message)); };
  const lienDiscord = (state, options) => (config.oauthActif && oauth ? oauth.urlAutorisation(state, options) : null);
  // Barre latérale : qui est connecté, et combien de candidatures attendent une décision.
  const espaceDe = (session) => {
    const estAdmin = Boolean(session && session.id === config.discord.adminId);
    const aTraiter = estAdmin && candidatures ? candidatures.liste().filter((c) => c.statut === 'examen' || c.statut === 'video').length : 0;
    const aTraiterParcours = estAdmin
      ? parcours.aTraiter().total + suivi.enAttente().length + suivi.resultatsEnAttente().length + suivi.aConfirmer().length + sinistres.fichesATraiter().length + acces.enAttente().length + messages.recusATraiter().length + ressources.enAttente().length + aTraiter : 0;
    const p = !estAdmin && session ? parcours.get(session.id) : null;
    const c = !estAdmin && session ? compteursMembre(session.id) : { notifs: 0, remarques: 0 };
    return { session, estAdmin, aTraiter, aTraiterParcours, parcours: Boolean(p && !p.retire_le), jetonApp: session ? jetonApp(session) : null,
      notifsNonLues: estAdmin ? notifsAdmin.nonLues() : c.notifs, remarquesNouvelles: c.remarques, evenements: session ? evenementsEnCours() : [] };
  };
  // Notifications non lues et nouvelles remarques du coach d'un membre (pastilles rouges, nombre sur l'icône de l'application).
  function compteursMembre(id) {
    const vues = (commandes.db.prepare('SELECT remarques_vues_le FROM profils_membres WHERE discord_id = ?').get(id) || {}).remarques_vues_le || '';
    return { notifs: notifsAdmin.nonLuesMembre(id), remarques: commandes.db.prepare('SELECT COUNT(*) n FROM remarques WHERE discord_id = ? AND COALESCE(modifie_le, cree_le) > ?').get(id, vues).n };
  }
  // Événements en cours : jusqu'à leur date de fin (sinon 7 jours après leur création).
  const evenementsEnCours = () => {
    const now = new Date().toISOString();
    return commandes.db.prepare(`SELECT * FROM annonces WHERE (fin_le IS NOT NULL AND fin_le > ?) OR (fin_le IS NULL AND cree_le > ?) ORDER BY id DESC LIMIT 6`)
      .all(now, new Date(Date.now() - 7 * 864e5).toISOString());
  };
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const formulaire = express.urlencoded({ extended: false, limit: '10kb' });
  const json = express.json({ limit: '20kb' });
  const introuvable = (res) => res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));

  // Images publiques (avant la règle « pas de cache ») (tutoriels des formulaires).
  app.use('/static', express.static(require('path').join(__dirname, '..', 'public'), { maxAge: '7d', index: false }));

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cache-Control', 'no-store');
    next();
  });

  // ================= Application installable (PWA) =================
  const SERVICE_WORKER = require('fs').readFileSync(require('path').join(__dirname, 'service-worker.js'), 'utf8');
  app.get('/manifest.webmanifest', (req, res) => {
    const j = verifier(String(req.query.u || ''), config.secretApp);
    res.set('Content-Type', 'application/manifest+json; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(JSON.stringify({
      id: '/app', name: 'Overmaxx', short_name: 'Overmaxx', lang: 'fr', dir: 'ltr',
      description: 'Ton parcours Overmaxx, tes coachings et tes notifications.',
      start_url: j && j.but === 'app' ? `/app?t=${encodeURIComponent(String(req.query.u))}` : '/app',
      scope: '/', display: 'standalone', orientation: 'portrait', background_color: '#000000', theme_color: '#000000',
      icons: [
        { src: '/static/icones/globe-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/static/icones/globe-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/static/icones/globe-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }));
  });
  app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'text/javascript; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    res.send(SERVICE_WORKER);
  });
  // Ouverture de l'application : connectée par le jeton de son manifeste, puis la bonne page selon le compte.
  app.get('/app', (req, res) => {
    const j = verifier(String(req.query.t || ''), config.secretApp);
    let session = lireSession(req, config.secretApp);
    if (j && j.but === 'app' && j.id) { ouvrirSession(res, { id: j.id, pseudo: j.pseudo }, config); session = { id: j.id, pseudo: j.pseudo }; }
    return res.redirect(302, (session && accueilDe(session)) || '/');
  });
  // Profil du membre (prénom, pays, fuseau) et accueil des nouveaux.
  const qProfils = {
    get: commandes.db.prepare('SELECT * FROM profils_membres WHERE discord_id = ?'),
    infos: commandes.db.prepare(`INSERT INTO profils_membres (discord_id, prenom, pays, fuseau, maj_le) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET prenom = excluded.prenom, pays = excluded.pays, fuseau = COALESCE(excluded.fuseau, fuseau), maj_le = excluded.maj_le`),
    fini: commandes.db.prepare(`INSERT INTO profils_membres (discord_id, accueil_fini_le, maj_le) VALUES (?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET accueil_fini_le = COALESCE(accueil_fini_le, excluded.accueil_fini_le), maj_le = excluded.maj_le`),
  };
  const accueilFini = (id) => Boolean((qProfils.get.get(id) || {}).accueil_fini_le);
  // Appareil reconnu (déjà connecté ici une fois) : « Me reconnecter », sans nouveau message de Bob.
  const reconnexion = (req) => {
    const a = lireAppareil(req, config.secretApp);
    if (!a) return null;
    const p = qProfils.get.get(a.id) || {};
    return { pseudo: a.pseudo || 'toi', prenom: p.prenom || null, avatar: p.avatar || null };
  };
  // L'espace qui s'ouvre après la connexion (ou depuis l'application), selon le compte ; d'abord l'accueil des nouveaux.
  // Pas encore de programme : null (la page d'accueil propose la Community et l'Elite).
  function accueilDe(session, { avecAccueil = true } = {}) {
    if (session.id === config.discord.adminId) return '/admin/a-traiter';
    const espaceMembre = espaceDe_(session);
    const membre = espaceMembre && !espaceMembre.endsWith('/candidature');
    return membre && avecAccueil && !accueilFini(session.id) ? '/bienvenue' : espaceMembre;
  }
  function espaceDe_(session) {
    const p = parcoursDe(session);
    if (p) return p.sinistre_depuis ? '/sinistre' : '/profil';
    const membres = commandes.membresParDiscord(session.id);
    if (coaching.aUnPlanning(session.id) || membres.some((x) => x.programme === 'elite' && x.statut === 'actif')) return '/coaching';
    const c = candidatures && candidatures.parDiscord(session.id);
    if (c && c.statut !== 'refuse') return `${elite.base}/candidature`;
    if (membres.some((x) => x.programme === 'community' && x.statut === 'actif')) return `${community.base}/renouveler`;
    if (commandes.db.prepare('SELECT 1 FROM abonnes_carte WHERE discord_id = ? AND termine_le IS NULL').get(session.id)) return '/notifications';
    return null;
  }

  // ================= Classement (top 100) =================
  // Les élèves de l'accompagnement, classés par récompenses validées (puis par vues). Le nom affiché : son prénom
  // (accueil) ou son pseudo Discord ; jamais son nom complet.
  function classement() {
    const maintenant = Date.now();
    const liste = parcours.tous().map((p) => {
      const st = suivi.stats(p.discord_id) || {};
      const profil = qProfils.get.get(p.discord_id) || {};
      return {
        id: p.discord_id, nom: profil.prenom || p.pseudo || 'Membre', pseudo: p.pseudo, avatar: profil.avatar || null, elite: true,
        revenus: st.revenusTotal || 0, vues: st.vues || 0, jours: Math.max(1, Math.floor((maintenant - new Date(p.entree_le)) / 864e5) + 1),
        recompenses: suivi.recompenses(p.discord_id), chaine: communaute.chaine(p.discord_id),
      };
    }).sort((a, b) => b.revenus - a.revenus || b.vues - a.vues || a.nom.localeCompare(b.nom, 'fr'));
    liste.forEach((m, i) => { m.rang = i + 1; });
    return liste;
  }
  app.get('/classement', (req, res) => {
    const session = connecte(req, res, '/classement', 'Classement');
    if (!session) return;
    const liste = classement();
    const moi = liste.find((m) => m.id === session.id);
    const membres = new Set(liste.map((m) => m.id));
    for (const m of commandes.db.prepare("SELECT DISTINCT discord_id FROM membres WHERE statut = 'actif' AND discord_id IS NOT NULL").all()) membres.add(m.discord_id);
    for (const m of commandes.db.prepare('SELECT DISTINCT discord_id FROM abonnes_carte WHERE termine_le IS NULL').all()) membres.add(m.discord_id);
    res.send(T.pageClassement(config, { espace: espaceDe(session), top: liste.slice(0, 100), total: liste.length, monRang: moi ? moi.rang : null,
      totalRevenus: liste.reduce((t, m) => t + m.revenus, 0), totalMembres: membres.size }));
  });
  // Profil d'un membre du top 100 (le sien, ou n'importe lequel pour le coach).
  app.get('/classement/:id', (req, res) => {
    const session = connecte(req, res, `/classement/${encodeURIComponent(req.params.id)}`, 'Classement');
    if (!session) return;
    const liste = classement();
    const m = liste.find((x) => x.id === req.params.id);
    if (!m || (m.rang > 100 && session.id !== m.id && session.id !== config.discord.adminId)) {
      res.status(404).send(P.pageMessage(config, 'Profil privé', 'Seuls les profils du top 100 sont visibles.', { lien: '/classement', texteLien: 'Classement' }));
      return;
    }
    const p = parcours.get(m.id);
    const moi = parcours.get(session.id);
    const concurrence = moi ? communaute.concurrents(session.id).find((c) => c.autre === m.id) : null;
    const relation = moi && !moi.retire_le && session.id !== m.id ? {
      suit: communaute.suit(session.id, m.id), concurrent: Boolean(concurrence), concurrenceId: concurrence && concurrence.id,
      peutDefier: communaute.peutConcourir(session.id) && communaute.peutConcourir(m.id),
      message: { suivi: 'Tu le suis : tu recevras ses nouveaux résultats.', retire: 'Tu ne le suis plus.', defi: 'Invitation envoyée : Bob le prévient.' }[req.query.fait],
      erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null } : null;
    res.send(V.pageProfil(config, { espace: espaceDe(session), parcours: p, tableau: suivi.tableau(m.id), stats: suivi.stats(m.id),
      recompenses: suivi.recompenses(m.id), vuePublique: true, avatar: m.avatar, relation, chaine: m.chaine }));
  });

  // ================= Notifications : Bob ou l'application =================
  app.get('/notifications', (req, res) => {
    const session = connecte(req, res, '/notifications', 'Notifications');
    if (!session) return;
    const onglet = ['rappels', 'reglages'].includes(req.query.onglet) ? req.query.onglet : 'notifications';
    // Le coach : Notifications (journal de Bob) et Mes rappels ; les réglages de l'application à part.
    if (session.id === config.discord.adminId && onglet !== 'reglages') {
      const espace = espaceDe(session);
      const notifications = onglet === 'notifications' ? notifsAdmin.liste() : [];
      // Le coach lit chaque notification une à une : seule l'ouverture d'une notification la marque lue.
      const nonLues = notifsAdmin.nonLues();
      return res.send(N.pageNotificationsAdmin(config, { espace, onglet, notifications, nonLues,
        rappels: notifsAdmin.rappels(), modeles: notifsAdmin.MODELES, JOURS: notifsAdmin.JOURS,
        message: { ajoute: 'Rappel ajouté : Bob te l\'enverra à l\'heure choisie.', supprime: 'Rappel supprimé.' }[req.query.fait],
        erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
    }
    if (onglet === 'notifications' && session.id !== config.discord.adminId) {
      const liste = notifsAdmin.listeMembre(session.id);
      notifsAdmin.toutLuMembre(session.id);
      return res.send(N.pageNotificationsMembre(config, { espace: espaceDe(session), notifications: liste }));
    }
    res.send(N.pageNotifications(config, { espace: espaceDe(session), clePublique: push.clePublique(), canal: push.canal(session.id),
      appareils: push.abonnements(session.id) }));
  });
  // Mes rappels (coach).
  app.post('/admin/rappels', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/notifications?onglet=rappels')) return;
    const r = notifsAdmin.creer({ texte: req.body.texte, frequence: req.body.frequence, jours: req.body.jours, date: req.body.date, heure: req.body.heure });
    res.redirect(303, `/notifications?onglet=rappels&${r.erreur ? `erreur=${encodeURIComponent(r.erreur)}` : 'fait=ajoute'}`);
  });
  app.post('/admin/rappels/:id/supprimer', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/notifications?onglet=rappels')) return;
    notifsAdmin.supprimer(req.params.id);
    res.redirect(303, '/notifications?onglet=rappels&fait=supprime');
  });
  app.post('/admin/rappels/:id/basculer', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/notifications?onglet=rappels')) return;
    notifsAdmin.basculer(req.params.id);
    res.redirect(303, '/notifications?onglet=rappels');
  });
  const apiNotif = (chemin, action) => app.post(chemin, json, async (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session) return res.status(401).json({ erreur: 'Ta connexion a expiré. Recharge la page.' });
    try {
      const r = await action(session, req.body || {});
      if (r && r.erreur) return res.status(400).json(r);
      return res.json({ ok: true, ...(r || {}) });
    } catch (err) {
      console.error('[notifications]', err.message);
      return res.status(500).json({ erreur: 'Erreur, réessaie.' });
    }
  });
  apiNotif('/api/notifications/abonnement', async (session, b) => push.abonner(session.id, b.abonnement, b.appareil));
  apiNotif('/api/notifications/desabonnement', async (session, b) => {
    push.desabonner(session.id, b.endpoint);
    if (!push.abonnements(session.id).length) push.choisirCanal(session.id, 'bob'); // plus d'appareil : Bob reprend
    return {};
  });
  apiNotif('/api/notifications/canal', async (session, b) => push.choisirCanal(session.id, String(b.canal || '')));
  apiNotif('/api/notifications/test', async (session) => ({
    appareils: await push.envoyer(session.id, { titre: 'Notifications activées', corps: 'Tu recevras ici les messages d\'Overmaxx.', url: '/notifications', tag: 'test' }),
  }));

  // ================= Accueil des nouveaux membres =================
  app.get('/bienvenue', (req, res) => {
    const session = connecte(req, res, '/bienvenue', 'Bienvenue');
    if (!session) return;
    if (session.id === config.discord.adminId) { res.redirect(302, '/admin/a-traiter'); return; }
    res.send(A.pageAccueilMembre(config, { espace: espaceDe(session), session, profil: qProfils.get.get(session.id), clePublique: push.clePublique(),
      canal: push.canal(session.id), suite: accueilDe(session, { avecAccueil: false }) || '/' }));
  });
  apiNotif('/api/bienvenue/infos', async (session, b) => {
    const prenom = String(b.prenom || '').trim().slice(0, 40);
    const pays = String(b.pays || '').trim().slice(0, 60);
    if (prenom.length < 2) return { erreur: 'Écris ton prénom.' };
    if (pays.length < 2) return { erreur: 'Écris ton pays.' };
    const fuseau = require('./coaching').fuseauValide(b.fuseau) ? String(b.fuseau) : null;
    qProfils.infos.run(session.id, prenom, pays, fuseau, new Date().toISOString());
    if (fuseau) coaching.majFuseau(session.id, fuseau, session.pseudo);
    return {};
  });
  apiNotif('/api/bienvenue/fini', async (session) => { qProfils.fini.run(session.id, new Date().toISOString(), new Date().toISOString()); return {}; });

  // ================= Paiements (Community et Elite) =================

  // Toutes les pages sauf l'accueil : connexion avec le compte Discord obligatoire.
  function connecte(req, res, retour, message) {
    const session = lireSession(req, config.secretApp);
    if (session) return session;
    res.send(E.pageConnexionRequise(config, { retour: retourSur(retour || req.originalUrl, '/'), message, appareil: reconnexion(req) }));
    return null;
  }
  // Abonnement de cette offre déjà relié au compte Discord connecté.
  const abonnementDe = (session, offre) => (session ? commandes.membresParDiscord(session.id).find((x) => x.programme === offre.id) || null : null);

  async function lancerPaiement(req, res, { offre, type, page, invitationToken, session }) {
    const valeurs = lireFormulaire(req.body);
    const parDiscord = abonnementDe(session, offre);
    // Renouvellement : l'abonnement est retrouvé par le lien personnel (ancien) ou par le compte Discord connecté.
    const emailConnu = type === 'renouvellement' ? (lireJetonMembre(valeurs.m, config.secretApp) || (parDiscord && parDiscord.email) || null) : null;
    if (emailConnu) valeurs.email = emailConnu;
    const refus = (erreur, statut = 400) => res.status(statut).send(page({ erreur, valeurs, emailVerrouille: Boolean(emailConnu) }));
    if (valeurs.nom.length < 2) return refus('Entre ton nom.');
    if (!EMAIL_REGEX.test(valeurs.email)) return refus("L'email n'est pas valide.");
    const membre = commandes.membre(offre.id, valeurs.email);
    if (type === 'inscription' && parDiscord && commandes.peutRenouveler(offre.id, parDiscord.email)) {
      return refus(`Ton compte Discord a déjà un accès actif. <a href="${offre.base}/renouveler">Renouvelle ton abonnement ici</a>.`, 409);
    }
    if (type === 'inscription' && membre && commandes.peutRenouveler(offre.id, valeurs.email)) {
      return refus(`Cet email a déjà un accès actif. <a href="${P.echapper(lienRenouvellement(config, offre.id, valeurs.email))}">Renouvelle ton abonnement ici</a>.`, 409);
    }
    if (type === 'renouvellement' && !commandes.peutRenouveler(offre.id, valeurs.email)) {
      const lien = offre.id === 'community' ? `<a href="${offre.base}/paiement">repayer l'entrée</a>` : 'nous contacter';
      return refus(membre
        ? `Ton accès est terminé : le renouvellement n'est plus possible. Pour revenir, il faut ${lien}.`
        : `Aucun abonnement actif pour cet email. Utilise l'email de ton inscription.`, 404);
    }
    try {
      const { urlPaiement } = await commandes.demarrer({
        programme: offre.id, type, ...valeurs, invitationToken, discordId: session && session.id, discordPseudo: session && session.pseudo,
      });
      return res.redirect(303, urlPaiement);
    } catch (err) {
      console.error('[paiement]', err.message);
      return refus('Le paiement ne peut pas démarrer pour le moment. Réessaie dans un instant.', 502);
    }
  }

  function formulaireRenouvellement(offre) {
    return (req, res) => {
      const session = connecte(req, res, undefined, `Renouveler ${offre.nom}`);
      if (!session) return;
      const email = lireJetonMembre(req.query.m, config.secretApp);
      const m = email ? commandes.membre(offre.id, email) : abonnementDe(session, offre);
      const valeurs = m ? { nom: m.nom, email: m.email, telephone: m.telephone, m: req.query.m } : {};
      const montant = m ? commandes.montantPour(offre.id, 'renouvellement', m.email) : undefined;
      res.send(P.pageFormulaire(config, { offre, type: 'renouvellement', valeurs, emailVerrouille: Boolean(m), montant }));
    };
  }

  // ---- Community ----
  const community = config.offres.community;
  // Accueil : la seule page ouverte à tous. Son but : faire entrer sur le Discord.
  app.get('/', (req, res) => {
    const session = lireSession(req, config.secretApp);
    res.send(P.pageBienvenue(config, session ? { pseudo: session.pseudo || 'toi', espace: accueilDe(session) } : { appareil: reconnexion(req) }));
  });
  app.get('/community', (req, res) => {
    if (connecte(req, res, '/community', community.nom)) res.send(P.pageAccueil(config, community));
  });
  app.get('/community/paiement', (req, res) => {
    if (connecte(req, res, '/community/paiement', community.nom)) res.send(P.pageFormulaire(config, { offre: community, type: 'inscription', retour: '/community' }));
  });
  app.post('/community/paiement', formulaire, (req, res) => {
    const session = connecte(req, res, '/community/paiement', community.nom);
    if (!session) return undefined;
    return lancerPaiement(req, res, {
      offre: community, type: 'inscription', session,
      page: (o) => P.pageFormulaire(config, { offre: community, type: 'inscription', retour: '/community', ...o }),
    });
  });
  app.get('/community/renouveler', formulaireRenouvellement(community));
  app.post('/community/renouveler', formulaire, (req, res) => {
    const session = connecte(req, res, '/community/renouveler', `Renouveler ${community.nom}`);
    if (!session) return undefined;
    return lancerPaiement(req, res, {
      offre: community, type: 'renouvellement', session,
      page: (o) => P.pageFormulaire(config, { offre: community, type: 'renouvellement', ...o }),
    });
  });
  // Anciennes adresses
  app.get('/paiement', (req, res) => res.redirect(301, '/community/paiement'));
  app.get('/renouveler', (req, res) => res.redirect(301, `/community/renouveler${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));

  // ---- Elite ----
  const elite = config.offres.elite;
  app.get('/coaching/elite', (req, res) => {
    if (estLeCoach(lireSession(req, config.secretApp))) return res.redirect(302, '/admin/candidatures');
    // Déjà candidat (formulaire envoyé, même suivi par le seul cookie de candidature) : on montre où il en est.
    const { c } = candidatureDe(req);
    if (c && c.statut !== 'formulaire') return res.redirect(302, `${config.offres.elite.base}/candidature`);
    const session = connecte(req, res, elite.base, 'Candidature Elite');
    if (!session) return undefined;
    return res.send(E.pageEliteCandidature(config, { session }));
  });
  function invitationValide(req, res, session) {
    const inv = commandes.invitation(req.params.token);
    if (!inv) { res.status(404).send(P.pageMessage(config, 'Lien invalide', 'Ce lien de paiement n\'existe pas.', { lien: elite.base, texteLien: 'Découvrir l\'Elite' })); return null; }
    if (inv.utilisee_le) { res.status(410).send(P.pageMessage(config, 'Lien déjà utilisé', 'Ce lien personnel a déjà servi à un paiement.', { lien: elite.base, texteLien: 'Retour' })); return null; }
    // Lien né d'une candidature : réservé au compte Discord du candidat.
    const c = candidatures ? commandes.db.prepare('SELECT discord_id, pseudo FROM candidatures WHERE invitation_token = ?').get(inv.token) : null;
    if (c && session && c.discord_id !== session.id) {
      res.status(403).send(P.pageMessage(config, 'Lien réservé', `Ce lien de paiement est réservé au compte Discord de ${c.pseudo || 'son candidat'}. Connecte-toi avec ce compte.`,
        { lien: '/deconnexion?autre=1', texteLien: 'Changer de compte' }));
      return null;
    }
    return inv;
  }
  app.get('/coaching/elite/paiement/:token', (req, res) => {
    const session = connecte(req, res, undefined, elite.nom);
    if (!session || !invitationValide(req, res, session)) return;
    res.send(P.pageFormulaire(config, { offre: elite, type: 'inscription', action: `${elite.base}/paiement/${req.params.token}`, lienCarte: elite.lienCarte }));
  });
  app.post('/coaching/elite/paiement/:token', formulaire, (req, res) => {
    const session = connecte(req, res, `${elite.base}/paiement/${req.params.token}`, elite.nom);
    if (!session || !invitationValide(req, res, session)) return undefined;
    return lancerPaiement(req, res, {
      offre: elite, type: 'inscription', invitationToken: req.params.token, session,
      page: (o) => P.pageFormulaire(config, { offre: elite, type: 'inscription', action: `${elite.base}/paiement/${req.params.token}`, lienCarte: elite.lienCarte, ...o }),
    });
  });
  // Elite : paiement unique de 500 €, il n'y a rien à renouveler.
  app.all('/coaching/elite/renouveler', (req, res) => res.send(P.pageMessage(config, 'Rien à renouveler',
    'L\'accompagnement Elite est un paiement unique : il n\'y a pas d\'abonnement à renouveler.', { lien: '/coaching', texteLien: 'Mes coachings' })));

  // ---- Suivi du paiement ----
  app.get('/confirmation/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return introuvable(res);
    const details = commandes.details(ref);
    if (!details) return introuvable(res);
    try { await commandes.etat(ref); } catch (err) { console.error('[confirmation]', err.message); }
    return res.send(P.pageConfirmation(config, { ref, type: details.type, details }));
  });

  app.get('/api/commandes/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return res.status(404).json({ etat: 'introuvable' });
    try {
      const e = await commandes.etat(ref);
      const reponse = { etat: e.etat, reessayable: Boolean(e.reessayable) };
      if (e.etat === 'confirme') reponse.redirection = e.type === 'inscription' ? `/acces/${ref}` : `/renouvele/${ref}`;
      return res.json(reponse);
    } catch (err) {
      console.error('[api/commandes]', err.message);
      return res.json({ etat: 'en_attente' });
    }
  });

  // Le membre a donné un autre email à Whop : il le corrige lui-même (connecté avec Discord).
  const membresSansWhop = (session) => commandes.membresParDiscord(session.id)
    .filter((x) => x.statut === 'actif' && !x.whop_membership_id && new Date(x.acces_jusqu_au) > new Date());
  app.get('/acces/email-whop', (req, res) => {
    const session = connecte(req, res, '/acces/email-whop', 'Accès à la formation');
    if (!session) return;
    const membres = membresSansWhop(session);
    res.send(P.pageEmailWhop(config, { membres, valeur: (membres[0] && membres[0].email_whop) || '' }));
  });
  app.post('/acces/email-whop', formulaire, (req, res) => {
    const session = connecte(req, res, '/acces/email-whop', 'Accès à la formation');
    if (!session) return undefined;
    const membres = membresSansWhop(session);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
    const refus = (erreur) => res.status(400).send(P.pageEmailWhop(config, { membres, erreur, valeur: email }));
    if (!membres.length) return res.send(P.pageEmailWhop(config, { membres }));
    if (!EMAIL_REGEX.test(email)) return refus('L\'email n\'est pas valide.');
    // Pas l'email d'un autre membre : sa demande Whop doit rester la sienne.
    const pris = commandes.db.prepare('SELECT discord_id FROM membres WHERE (email = ? OR email_whop = ?) AND (discord_id IS NULL OR discord_id != ?)').get(email, email, session.id);
    if (pris) return refus('Cet email est déjà utilisé par un autre membre. Écris celui que tu as donné à Whop.');
    const maj = commandes.db.prepare('UPDATE membres SET email_whop = ?, maj_le = ? WHERE id = ?');
    for (const m of membres) maj.run(email === m.email ? null : email, new Date().toISOString(), m.id);
    return res.send(P.pageEmailWhop(config, { fait: email }));
  });

  app.get('/acces/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return introuvable(res);
    try {
      const e = await commandes.etat(ref);
      if (e.etat !== 'confirme' || e.type !== 'inscription') return res.redirect(303, `/confirmation/${ref}`);
      const offre = config.offres[e.programme];
      let lienWhop = `https://whop.com/checkout/${offre.whopPlanId}`;
      try { lienWhop = await whop.lienOffre(offre.whopPlanId); } catch (err) { console.warn('[acces] lien Whop :', err.message); }
      const erreurDiscord = req.query.discord === 'erreur' ? 'La connexion Discord n\'a pas abouti. Réessaie.' : null;
      return res.send(P.pageGuide(config, {
        offre, ref, membre: e.membre, lienWhop, discordLie: Boolean(e.membre.discord_id), erreurDiscord,
        lienDiscord: lienDiscord({ but: 'lier', ref }, { rejoindre: true }), codeLiaison: e.codeLiaison,
      }));
    } catch (err) {
      console.error('[acces]', err.message);
      return res.status(502).send(P.pageMessage(config, 'Un instant…', 'Ton paiement est bien enregistré. Recharge la page dans quelques secondes.', { lien: `/acces/${ref}`, texteLien: 'Recharger' }));
    }
  });

  app.get('/renouvele/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return introuvable(res);
    try {
      const e = await commandes.etat(ref);
      if (e.etat !== 'confirme' || e.type !== 'renouvellement') return res.redirect(303, `/confirmation/${ref}`);
      const offre = config.offres[e.programme];
      let lienWhop = `https://whop.com/checkout/${offre.whopPlanId}`;
      try { lienWhop = await whop.lienOffre(offre.whopPlanId); } catch { /* lien par défaut */ }
      return res.send(P.pageRenouvele(config, {
        accesJusquAu: e.accesJusquAu, whopARejoindre: Boolean(e.membre && !e.membre.whop_membership_id), lienWhop, email: e.email,
      }));
    } catch (err) {
      console.error('[renouvele]', err.message);
      return res.redirect(303, `/confirmation/${ref}`);
    }
  });

  // ================= Discord =================

  app.get('/discord/lier/:ref', (req, res) => {
    const { ref } = req.params;
    const d = REF_REGEX.test(ref) && commandes.details(ref);
    if (!d || !config.oauthActif) return res.redirect(303, d ? `/acces/${ref}` : '/community');
    return res.redirect(302, oauth.urlAutorisation({ but: 'lier', ref }, { rejoindre: true }));
  });

  app.get('/discord/candidature', (req, res) => {
    if (!config.oauthActif) return res.status(503).send(P.pageMessage(config, 'Bientôt disponible', 'La connexion Discord n\'est pas encore configurée.'));
    return res.redirect(302, oauth.urlAutorisation({ but: 'candidat' }, { rejoindre: true }));
  });

  app.get('/connexion', (req, res) => {
    const retour = retourSur(req.query.retour, '/app');
    // Déjà connecté : directement son espace.
    if (retour === '/app' && lireSession(req, config.secretApp)) return res.redirect(302, '/app');
    return res.send(E.pageConnexionRequise(config, { retour, appareil: reconnexion(req) }));
  });
  // Appareil reconnu : un bouton, et la session se rouvre.
  app.post('/connexion/appareil', formulaire, (req, res) => {
    const retour = retourSur(String(req.body.retour || ''), '/app');
    const a = lireAppareil(req, config.secretApp);
    if (!a) return res.redirect(303, `/connexion?retour=${encodeURIComponent(retour)}`);
    ouvrirSession(res, a, config);
    apresConnexion(a, retour);
    return res.redirect(303, retour);
  });
  // « Ce n'est pas toi ? » : l'appareil est oublié, on se connecte avec un autre compte.
  app.get('/connexion/oublier', (req, res) => {
    fermerSession(res);
    oublierAppareil(res);
    res.redirect(302, `/connexion?retour=${encodeURIComponent(retourSur(req.query.retour, '/app'))}`);
  });
  const apresConnexion = (u, retour) => {
    if (candidatures && retour.startsWith(`${config.offres.elite.base}/candidature`)) candidatures.demarrer(u.id, u.pseudo);
  };

  // Codes de connexion : Bob envoie aussi un code à 6 chiffres. Tapé sur l'appareil qui l'a demandé (l'application
  // installée comprise), il connecte cet appareil-là. Valable 10 minutes, 3 essais ; 10 erreurs par jour et par compte au plus.
  // Le même bon code renvoyé juste après (double envoi du formulaire, remplissage automatique) reconnecte sans erreur.
  const codesConnexion = new Map();
  const empreinteCode = (demande, code) => crypto.createHmac('sha256', config.secretApp).update(`code:${demande}:${code}`).digest();
  function nouveauCode(id, retour) {
    const t = Date.now();
    for (const [k, v] of codesConnexion) if (v.expire < t || (v.utilise && t - v.utilise > 2 * 60 * 1000)) codesConnexion.delete(k);
    const demande = crypto.randomBytes(18).toString('base64url');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    codesConnexion.set(demande, { id, pseudo: null, retour, empreinte: empreinteCode(demande, code), expire: t + 10 * 60 * 1000, essais: 0 });
    return { demande, code };
  }

  // Anti-abus : 8 demandes par quart d'heure et par adresse IP, 3 boutons par demi-heure pour un même compte Discord.
  const demandesConnexion = { ip: new Map(), compte: new Map() };
  function depasse(table, cle, max, fenetreMs) {
    const t = Date.now();
    const liste = (table.get(cle) || []).filter((x) => t - x < fenetreMs);
    if (liste.length >= max) return true;
    liste.push(t);
    table.set(cle, liste);
    if (table.size > 5000) table.clear();
    return false;
  }
  app.post('/connexion/pseudo', formulaire, async (req, res) => {
    const retour = retourSur(String(req.body.retour || ''), '/');
    const pseudo = String(req.body.pseudo || '').trim().replace(/^@/, '').slice(0, 40);
    const page = (o, statut = 400) => res.status(statut).send(E.pageConnexionRequise(config, { retour, pseudo, ...o }));
    if (pseudo.length < 2) return page({ erreur: 'Écris ton pseudo Discord.' });
    if (depasse(demandesConnexion.ip, req.ip || 'inconnue', 8, 15 * 60 * 1000)) return page({ erreur: 'Trop d\'essais. Réessaie dans un quart d\'heure.' }, 429);
    if (!bob || !bob.envoyerConnexion) return page({ erreur: 'La connexion est indisponible pour le moment. Réessaie dans un instant.' }, 503);
    try {
      const id = await bob.idDepuisPseudo(pseudo);
      if (!id) {
        return page({ introuvable: true, erreur: 'Ce pseudo n\'est pas sur le serveur Overmaxx. Vérifie l\'orthographe (le petit nom sous ton nom, dans ton profil Discord), ou rejoins d\'abord le serveur.' }, 404);
      }
      if (depasse(demandesConnexion.compte, id, 3, 30 * 60 * 1000)) return page({ erreur: 'Bob t\'a déjà envoyé plusieurs codes : regarde sur Discord, ou réessaie dans une demi-heure.' }, 429);
      const { demande, code } = nouveauCode(id, retour);
      const r = await bob.envoyerConnexion(id, retour, pseudo, { code });
      if (!r.ok) {
        codesConnexion.delete(demande);
        return page({ erreur: 'Bob n\'arrive pas à t\'écrire sur Discord. Vérifie que tu es bien sur le serveur Overmaxx, puis réessaie.' }, 502);
      }
      codesConnexion.get(demande).pseudo = r.pseudo || pseudo;
      return res.send(E.pageConnexionEnvoyee(config, { url: r.url, retour, demande }));
    } catch (err) {
      console.error('[connexion]', err.message);
      return page({ erreur: 'La connexion est indisponible pour le moment. Réessaie dans un instant.' }, 502);
    }
  });

  // Le code de Bob, tapé sur l'appareil qui l'a demandé.
  const essaisCode = new Map();
  const erreursCompte = new Map();
  app.post('/connexion/code', formulaire, (req, res) => {
    const demande = String(req.body.demande || '').slice(0, 64);
    const code = String(req.body.code || '').replace(/\D/g, '').slice(0, 6);
    const d = codesConnexion.get(demande);
    const retour = d ? d.retour : retourSur(String(req.body.retour || ''), '/app');
    const page = (erreur, statut = 400, garder = true) => res.status(statut).send(E.pageConnexionEnvoyee(config, { retour, demande: garder && d ? demande : null, erreur }));
    if (depasse(essaisCode, req.ip || 'inconnue', 20, 15 * 60 * 1000)) return page('Trop d\'essais. Réessaie dans un quart d\'heure.', 429, false);
    const t = Date.now();
    const deuxMinutes = 2 * 60 * 1000;
    if (!d || d.expire < t || (d.utilise && t - d.utilise > deuxMinutes)) { codesConnexion.delete(demande); return page('Ce code n\'est plus valable (10 minutes). Demande un nouveau code.', 410, false); }
    const bon = code.length === 6 && crypto.timingSafeEqual(empreinteCode(demande, code), d.empreinte);
    if (!bon) {
      if (d.utilise) return page('Ce code a déjà servi. Demande un nouveau code.', 410, false);
      d.essais += 1;
      if (depasse(erreursCompte, d.id, 10, 24 * 3600 * 1000)) { codesConnexion.delete(demande); return page('Trop d\'erreurs aujourd\'hui pour ce compte. Utilise le bouton « C\'est bien moi, continuer » du message de Bob.', 429, false); }
      if (d.essais >= 3) { codesConnexion.delete(demande); return page('Trop d\'essais avec ce code. Demande un nouveau code.', 429, false); }
      return page('Ce n\'est pas le bon code. Regarde le dernier message de Bob.');
    }
    d.utilise = d.utilise || t; // gardé 2 minutes : un double envoi du même bon code ne montre pas d'erreur
    ouvrirSession(res, { id: d.id, pseudo: d.pseudo }, config);
    apresConnexion(d, d.retour);
    return res.redirect(303, d.retour);
  });

  // Lien envoyé par Bob dans Discord : connexion sans mot de passe (valable 30 jours, réutilisable).
  app.get('/connexion/bob', (req, res) => {
    const j = verifier(String(req.query.t || ''), config.secretApp);
    const retour = retourSur(req.query.retour);
    if (!j || j.but !== 'bob' || !j.id || !j.n) {
      return res.status(400).send(P.pageMessage(config, 'Lien expiré', 'Ce lien n\'est plus valable. Dans Discord, tape /connexion pour en recevoir un nouveau.'));
    }
    ouvrirSession(res, { id: j.id, pseudo: j.pseudo }, config);
    if (candidatures && retour.startsWith(`${config.offres.elite.base}/candidature`)) candidatures.demarrer(j.id, j.pseudo);
    return res.redirect(302, retour);
  });

  // Se déconnecter : l'appareil reste reconnu (« Me reconnecter »). Changer de compte (?autre=1) : il est oublié.
  app.get('/deconnexion', (req, res) => {
    fermerSession(res);
    if (!req.query.autre) return res.redirect(302, '/');
    oublierAppareil(res);
    return res.redirect(302, '/connexion?retour=%2Fapp');
  });

  app.get('/discord/callback', async (req, res) => {
    const st = oauth && oauth.lireState(String(req.query.state || ''));
    if (!st) return res.status(400).send(P.pageMessage(config, 'Lien expiré', 'Recommence la connexion Discord.'));
    const retour = st.but === 'lier' ? `/acces/${st.ref}` : st.but === 'candidat' ? `${config.offres.elite.base}/candidature` : retourSur(st.retour);
    if (!req.query.code) return res.redirect(302, st.but === 'lier' ? `${retour}?discord=erreur` : st.but === 'candidat' ? config.offres.elite.base : '/community');
    try {
      const u = await oauth.identifier(String(req.query.code));
      ouvrirSession(res, u, config);
      if (st.but === 'lier') {
        const membre = commandes.lierDiscord(st.ref, u.id, u.pseudo);
        if (!membre) return res.redirect(302, `${retour}?discord=erreur`);
        const offre = config.offres[membre.programme];
        await oauth.ajouterAuServeur(u.id, u.accessToken, membre.statut === 'actif' ? [offre.roleDiscord] : []);
        if (membre.statut === 'actif') await oauth.retirerRole(u.id, config.discord.roleAttente);
        if (bob) bob.bienvenue(membre).catch(() => {});
      }
      if (st.but === 'candidat' && candidatures) {
        // Rejoint le serveur avec le seul rôle Attente (sauf s'il y est déjà avec un accès payé).
        const roles = await oauth.rolesSurServeur(u.id);
        const dejaMembre = roles && Object.values(config.offres).some((o) => o.roleDiscord && roles.includes(o.roleDiscord));
        await oauth.ajouterAuServeur(u.id, u.accessToken, dejaMembre ? [] : [config.discord.roleAttente]);
        candidatures.demarrer(u.id, u.pseudo);
      }
      return res.redirect(302, retour);
    } catch (err) {
      console.error('[discord]', err.message);
      return res.redirect(302, st.but === 'lier' ? `${retour}?discord=erreur` : '/community');
    }
  });

  // ================= Coaching privé =================

  // Accès : rôle Elite sur le serveur, sans le rôle GOAT. L'admin est le coach : il ne réserve pas de séance.
  const estLeCoach = (session) => Boolean(session && session.id === config.discord.adminId);
  async function droitsCoaching(session) {
    if (estLeCoach(session)) return { interdit: 'C\'est toi le coach : tu ne réserves pas de séance. Ton calendrier est dans l\'espace admin.' };
    const pp = parcours.get(session.id);
    if (pp) sinistres.noterActivite(session.id); // réserver ses coachings, c'est aussi être présent
    if (pp && pp.sinistre_depuis) return { interdit: 'Tu es sinistré : plus de coaching tant que ton coach ne t\'a pas réhabilité. Remplis ta fiche de sinistre.', parcours: true };
    if (pp && pp.sinistre_total) return { interdit: 'Sinistré total : tu n\'as plus de live individuel. Tu gardes les lives de groupe sur Discord.', parcours: true };
    if (pp && pp.fin_le && new Date(pp.fin_le) < new Date()) return { interdit: 'Tes 90 jours d\'accompagnement sont terminés : il n\'y a plus de live individuel.', parcours: true };
    const roles = await oauth.rolesSurServeur(session.id);
    if (!roles) return { interdit: 'Tu n\'es pas sur le serveur Discord Overmaxx avec ce compte.' };
    if (config.discord.roleGoat && roles.includes(config.discord.roleGoat)) {
      return { interdit: 'Les GOAT ont un live de groupe dédié : il n\'y a pas de coaching individuel à réserver.' };
    }
    if (!elite.roleDiscord || !roles.includes(elite.roleDiscord)) return { interdit: 'Le coaching privé est réservé aux membres Elite.' };
    const p = parcours.get(session.id);
    if (p && p.etape < 3 && !coaching.creneauxFixes(session.id).length) {
      return { interdit: 'Tes coachings réguliers s\'ouvrent à l\'étape 3 de ton parcours. Avant, tu réserves ton coaching d\'entrée depuis Mon parcours.', parcours: true };
    }
    return { ok: true };
  }

  app.get('/coaching', async (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (estLeCoach(session)) return res.redirect(302, '/admin'); // le coach a son calendrier
    if (!session) return res.send(E.pageConnexionRequise(config, { retour: '/coaching', message: 'Coaching privé', lienDiscord: lienDiscord({ but: 'connexion', retour: '/coaching' }) }));
    try {
      const d = await droitsCoaching(session);
      if (!d.ok) return res.send(C.pageCoaching(config, { session, interdit: d.interdit, versParcours: d.parcours, espace: espaceDe(session) }));
      const messages = { 1: 'Tes créneaux fixes sont enregistrés. Bob t\'a envoyé le récapitulatif.', semaine: 'Ta semaine est réservée. Bob t\'a envoyé le récapitulatif.',
        report: 'Séance reportée. Ton coach est prévenu.', reserve: 'Coaching en réserve réservé. Ton coach est prévenu.',
        reprogramme: 'Séance reprogrammée. Ton coach est prévenu.', garde: 'Gardé en réserve : utilise-le quand tu veux.' };
      const message = messages[req.query.ok] || (req.query.annule ? 'Séance annulée. Ton coach est prévenu.' : null);
      const mode = req.query.mode === 'semaine' ? 'semaine' : 'fixe';
      const cetteSemaine = coaching.lundiDe(new Date());
      const lundis = [cetteSemaine, coaching.ajouterJours(cetteSemaine, 7)];
      const lundi = lundis.includes(req.query.semaine) ? req.query.semaine : lundis[0];
      const id = session.id;
      return res.send(C.pageCoaching(config, {
        session, coaching, message, mode, lundis, grille: coaching.grille(id), semaine: mode === 'semaine' ? coaching.grilleSemaine(id, lundi) : null,
        seances: coaching.prochainesSeances(id, 14), touchees: coaching.toucheesAChoisir(id), reserves: coaching.reserves(id),
        libres: coaching.creneauxLibres(14), aDesFixes: coaching.creneauxFixes(id).length > 0, espace: espaceDe(session),
      }));
    } catch (err) {
      console.error('[coaching]', err.message);
      return res.status(502).send(P.pageMessage(config, 'Un instant…', 'Impossible de vérifier ton rôle Discord. Réessaie dans un instant.', { lien: '/coaching', texteLien: 'Réessayer' }));
    }
  });

  async function sessionCoaching(req, res) {
    const session = lireSession(req, config.secretApp);
    if (!session) { res.status(401).json({ erreur: 'Reconnecte-toi.' }); return null; }
    const d = await droitsCoaching(session);
    if (!d.ok) { res.status(403).json({ erreur: d.interdit }); return null; }
    if (req.body && req.body.fuseau) coaching.majFuseau(session.id, String(req.body.fuseau), session.pseudo);
    return session;
  }
  const prevenirSeances = (nom, ...args) => { if (bob && bob.seances && bob.seances[nom]) bob.seances[nom](...args).catch((e) => console.error(`[bob] coaching ${nom} :`, e.message)); };
  // Petite enveloppe commune aux appels du membre (erreurs 400, panne 500).
  const apiCoaching = (chemin, action) => app.post(chemin, json, async (req, res) => {
    try {
      const session = await sessionCoaching(req, res);
      if (!session) return undefined;
      const r = await action(session, req.body || {});
      if (r && r.erreur) return res.status(400).json(r);
      return res.json({ ok: true, ...(r || {}) });
    } catch (err) {
      console.error('[coaching]', err.message);
      return res.status(500).json({ erreur: 'Erreur, réessaie.' });
    }
  });
  const creneauDe = (x) => ({ date: String((x && x.date) || ''), heure: String((x && x.heure) || '') });
  apiCoaching('/api/coaching/fuseau', async () => ({}));
  apiCoaching('/api/coaching/rappel', async (session, b) => coaching.majRappel(session.id, Number(b.rappelMin), session.pseudo));
  apiCoaching('/api/coaching/semaine', async (session, b) => {
    const selection = Array.isArray(b.selection) ? b.selection.slice(0, 7).map(creneauDe) : null;
    const r = coaching.reserverSemaine(session.id, String(b.lundi || ''), selection, session.pseudo);
    if (r.erreur) return r;
    if (b.rappelMin !== undefined) coaching.majRappel(session.id, Number(b.rappelMin), session.pseudo);
    prevenirSeances('semaineReservee', session.id, r.seances);
    return { seances: r.seances.length };
  });
  apiCoaching('/api/coaching/retirer-fixes', async (session) => ({ retires: coaching.retirerCreneauxFixes(session.id) }));
  apiCoaching('/api/coaching/reporter', async (session, b) => {
    const avant = creneauDe(b);
    const r = coaching.reporter(session.id, avant.date, avant.heure, b.justification, creneauDe(b.nouvelle));
    if (!r.erreur) prevenirSeances('report', session.id, r.seance, r.nouvelle, String(b.justification).trim());
    return r.erreur ? r : {};
  });
  apiCoaching('/api/coaching/reserve', async (session, b) => {
    const x = creneauDe(b);
    const r = coaching.utiliserReserve(session.id, x.date, x.heure);
    if (!r.erreur) prevenirSeances('reserveUtilisee', session.id, r.seance);
    return r.erreur ? r : { reserves: r.reserves };
  });
  apiCoaching('/api/coaching/touchee', async (session, b) => {
    const x = creneauDe(b);
    const r = coaching.choisirTouchee(session.id, x.date, x.heure, String(b.choix || ''), creneauDe(b.nouvelle));
    if (!r.erreur && r.seance) prevenirSeances('reserveUtilisee', session.id, r.seance);
    return r.erreur ? r : {};
  });

  app.post('/api/coaching/creneaux', json, async (req, res) => {
    try {
      const session = await sessionCoaching(req, res);
      if (!session) return undefined;
      const selection = Array.isArray(req.body.selection) ? req.body.selection.slice(0, 7).map((s) => ({ jour: Number(s.jour), heure: String(s.heure) })) : null;
      const r = coaching.enregistrer(session.id, selection, req.body.rappelMin === undefined ? undefined : Number(req.body.rappelMin), session.pseudo);
      if (r.erreur) return res.status(400).json(r);
      if (bob) bob.recapCoaching(session.id, r.reservations, r.decales).catch(() => {});
      return res.json({ ok: true, decales: r.decales });
    } catch (err) {
      console.error('[coaching]', err.message);
      return res.status(500).json({ erreur: 'Erreur, réessaie.' });
    }
  });

  app.post('/api/coaching/annuler', json, async (req, res) => {
    try {
      const session = await sessionCoaching(req, res);
      if (!session) return undefined;
      const r = coaching.annuler(session.id, String(req.body.date || ''), String(req.body.heure || ''), req.body.justification);
      if (r.erreur) return res.status(400).json(r);
      if (bob) bob.annulation(session.id, r.seance, String(req.body.justification).trim()).catch(() => {});
      return res.json({ ok: true });
    } catch (err) {
      console.error('[coaching]', err.message);
      return res.status(500).json({ erreur: 'Erreur, réessaie.' });
    }
  });

  // ================= Candidature Elite =================

  // Cookie de suivi posé après le formulaire 1 : il ne donne accès qu'à SA candidature (statut, formulaire 2, vidéo),
  // jamais au coaching ni à l'admin.
  const COOKIE_SUIVI = 'ovx_cand';
  function poserSuivi(res, c) {
    res.cookie(COOKIE_SUIVI, signer({ cand: c.id, discord: c.discord_id, exp: Date.now() + 45 * 24 * 3600 * 1000 }, config.secretApp), {
      httpOnly: true, sameSite: 'lax', secure: config.baseUrl.startsWith('https://'), maxAge: 45 * 24 * 3600 * 1000, path: '/',
    });
  }
  function candidatureDe(req) {
    if (!candidatures) return { c: null };
    const session = lireSession(req, config.secretApp);
    if (session) {
      const c = candidatures.parDiscord(session.id);
      if (c) return { c, session };
    }
    const brut = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE_SUIVI}=`));
    const t = brut && verifier(decodeURIComponent(brut.slice(COOKIE_SUIVI.length + 1)), config.secretApp);
    const c = t && candidatures.parId(Number(t.cand));
    if (c && c.discord_id === t.discord) return { c, session: session || { id: c.discord_id, pseudo: c.pseudo } };
    return { c: null, session };
  }

  app.get('/coaching/elite/candidature', (req, res) => {
    if (estLeCoach(lireSession(req, config.secretApp))) return res.redirect(302, '/admin/candidatures');
    const suivi = candidatureDe(req);
    let { c, session } = suivi;
    if (!c && session && candidatures) c = candidatures.demarrer(session.id, session.pseudo);
    if (!c) return res.send(E.pageCandidature(config, { session: null, lienDiscord: lienDiscord({ but: 'candidat' }, { rejoindre: true }) }));
    if (c.statut === 'retenu') return res.send(E.pageConfirmation(config, { session }));
    const inv = c.invitation_token ? commandes.invitation(c.invitation_token) : null;
    return res.send(E.pageCandidature(config, { session, candidature: c, lienPaiement: candidatures.lienPaiement(c), paye: Boolean(inv && inv.utilisee_le) }));
  });

  // Anti-spam : 5 envois du formulaire par heure et par adresse IP.
  const envoisParIp = new Map();
  function tropDEnvois(req) {
    const ip = req.ip || 'inconnue';
    const maintenantMs = Date.now();
    const liste = (envoisParIp.get(ip) || []).filter((t) => maintenantMs - t < 3600 * 1000);
    if (liste.length >= 5) return true;
    liste.push(maintenantMs);
    envoisParIp.set(ip, liste);
    if (envoisParIp.size > 5000) envoisParIp.clear();
    return false;
  }

  // Formulaire 1 (candidature) : vérifie les réponses et retrouve le candidat sur le serveur Discord.
  app.post('/api/candidature/formulaire', json, async (req, res) => {
    if (!candidatures) return res.status(503).json({ erreur: 'Les candidatures ne sont pas encore ouvertes.' });
    if (tropDEnvois(req)) return res.status(429).json({ erreur: 'Trop d\'essais. Réessaie dans une heure.' });
    // Connexion obligatoire (bouton de Bob) : le candidat est le compte Discord connecté.
    const session = lireSession(req, config.secretApp);
    if (!session) return res.status(401).json({ erreur: 'Ta connexion a expiré. Recharge la page pour te reconnecter avec Discord.' });
    if (estLeCoach(session)) return res.status(403).json({ erreur: 'C\'est toi le coach : tu ne postules pas à l\'Elite.' });
    const v = verifierReponses('candidature', req.body && req.body.reponses, { sauter: ['discord'] });
    if (v.erreur) return res.status(400).json(v);
    const discordId = session.id;
    const pseudo = session.pseudo || null;
    const existante = candidatures.parDiscord(discordId);
    if (existante && existante.statut !== 'formulaire') {
      return res.status(409).json({ erreur: existante.statut === 'refuse'
        ? 'Une candidature avec ce compte Discord a déjà été examinée.' : 'Tu as déjà une candidature en cours. Bob te répond sur Discord.' });
    }
    candidatures.demarrer(discordId, pseudo);
    const reponses = v.reponses.map(({ label, valeur }) => ({ label, valeur }));
    const cand = candidatures.recevoirFormulaire(discordId, reponses);
    if (cand && bob) bob.candidatureRecue(cand, reponses).catch(() => {});
    if (cand) poserSuivi(res, cand);
    return res.json({ ok: true });
  });

  // Formulaire 2 (profils retenus) : réponses écrites ; la vidéo suit sur /api/candidature/video.
  app.post('/api/candidature/confirmation', json, (req, res) => {
    const { c } = candidatureDe(req);
    if (!c) return res.status(401).json({ erreur: 'Ton lien a expiré. Dans Discord, tape /connexion pour en recevoir un nouveau.' });
    const v = verifierReponses('confirmation', req.body && req.body.reponses);
    if (v.erreur) return res.status(400).json(v);
    const r = candidatures.enregistrerConfirmation(c, v.reponses.map(({ label, valeur }) => ({ label, valeur })));
    if (r.erreur) return res.status(409).json(r);
    return res.json({ ok: true });
  });

  app.get('/api/candidature', (req, res) => {
    const { c } = candidatureDe(req);
    res.json({ statut: c ? c.statut : null });
  });

  app.post('/api/candidature/video', async (req, res) => {
    const { c } = candidatureDe(req);
    if (!c) { req.resume(); return res.status(401).json({ erreur: 'Ton lien a expiré. Dans Discord, tape /connexion pour en recevoir un nouveau.' }); }
    try {
      const r = await candidatures.enregistrerVideo(c, req, { type: req.get('content-type'), taille: Number(req.get('content-length')) || 0 });
      if (r.erreur) { req.resume(); return res.status(400).json(r); }
      if (bob) bob.videoRecue(r.candidature).catch(() => {});
      return res.json({ ok: true });
    } catch (err) {
      console.error('[candidature] vidéo :', err.message);
      return res.status(500).json({ erreur: 'L\'envoi a échoué. Réessaie.' });
    }
  });

  // ================= Parcours de l'accompagnement Elite =================

  // Le parcours d'un membre Elite est créé à sa première visite (paiement mobile money ou carte).
  function parcoursDe(session) {
    if (!session || estLeCoach(session)) return null;
    const p = parcours.get(session.id);
    if (p && !p.retire_le) return p;
    const m = commandes.membresParDiscord(session.id).find((x) => x.programme === 'elite' && x.statut === 'actif');
    if (m) return parcours.assurer(session.id, { pseudo: session.pseudo || m.discord_pseudo, nom: m.nom, entree: m.cree_le, fin: m.acces_jusqu_au });
    const carte = commandes.db.prepare("SELECT * FROM abonnes_carte WHERE discord_id = ? AND programme = 'elite' AND termine_le IS NULL").get(session.id);
    if (carte) return parcours.assurer(session.id, { pseudo: session.pseudo || carte.pseudo, entree: carte.depuis });
    return null;
  }
  function membreParcours(req, res, retour, { sinistreOk = false } = {}) {
    const session = connecte(req, res, retour, 'Overmaxx Elite');
    if (!session) return null;
    if (estLeCoach(session)) { res.redirect(302, '/admin/a-traiter'); return null; }
    const p = parcoursDe(session);
    if (!p) {
      res.status(403).send(P.pageMessage(config, 'Accompagnement Elite', 'Cette page est réservée aux membres de l\'accompagnement Elite.', { lien: elite.base, texteLien: 'Découvrir l\'Elite' }));
      return null;
    }
    // Absence = aucune interaction sur la plateforme (docs/ACCOMPAGNEMENT-ELITE.md, partie 6).
    sinistres.noterActivite(session.id);
    if (sinistres.estSinistre(p) && !sinistreOk) { res.redirect(303, '/sinistre'); return null; }
    return { session, p: parcours.get(session.id), espace: espaceDe(session) };
  }
  // Envois par l'API (vidéos, images) : membre du parcours, pas sinistré.
  function membreApi(req) {
    const session = lireSession(req, config.secretApp);
    const p = session && parcoursDe(session);
    if (!p) return { statut: 401, erreur: 'Ta connexion a expiré. Recharge la page.' };
    if (sinistres.estSinistre(p)) return { statut: 403, erreur: 'Tu es sinistré : remplis d\'abord ta fiche de sinistre.' };
    sinistres.noterActivite(session.id);
    return { session, p };
  }
  // Progression dans les cours Whop (leçons terminées), si son compte Whop est connu.
  function formationDe(discordId) {
    const m = commandes.db.prepare('SELECT whop_user_id FROM membres WHERE discord_id = ? AND whop_user_id IS NOT NULL ORDER BY maj_le DESC LIMIT 1').get(discordId);
    if (!m) return null;
    const r = commandes.db.prepare(`SELECT COALESCE(SUM(termine), 0) faites, MAX(maj_le) derniere,
      (SELECT COALESCE(SUM(c.lecons), 0) FROM cours_whop c WHERE c.id IN (SELECT DISTINCT cours_id FROM progression_whop x WHERE x.whop_user_id = ?)) total
      FROM progression_whop WHERE whop_user_id = ?`).get(m.whop_user_id, m.whop_user_id);
    return { faites: r.faites, total: r.total, derniere: r.derniere };
  }
  const remarquesDe = (id) => parcours.remarquesDe(id);
  const maxMo = config.videoParcoursMo || 150;

  // Régularité : le nombre de tâches faites chaque jour (6 derniers mois) : exercices et vidéos envoyés, vidéos déclarées,
  // résultats donnés, updates du compte envoyés.
  const aujourdhuiDe = (p) => (p && p.fuseau ? suivi.aujourdhui(p) : new Date().toISOString().slice(0, 10));
  function activiteDe(id) {
    const depuis = new Date(Date.now() - 190 * 864e5).toISOString().slice(0, 10);
    const n = {};
    const compter = (sql) => { for (const r of commandes.db.prepare(sql).all(id, depuis)) if (r.j) n[r.j] = (n[r.j] || 0) + r.n; };
    compter("SELECT substr(envoye_le, 1, 10) j, COUNT(*) n FROM soumissions WHERE discord_id = ? AND envoye_le IS NOT NULL AND envoye_le >= ? GROUP BY j");
    compter('SELECT jour j, COUNT(*) n FROM publications WHERE discord_id = ? AND jour >= ? GROUP BY j');
    compter('SELECT substr(res_envoye_le, 1, 10) j, COUNT(*) n FROM publications WHERE discord_id = ? AND res_envoye_le IS NOT NULL AND res_envoye_le >= ? GROUP BY j');
    compter('SELECT jour j, COUNT(*) n FROM comptes_rendus WHERE discord_id = ? AND envoye_le IS NOT NULL AND jour >= ? GROUP BY j');
    return n;
  }
  app.get('/parcours', (req, res) => {
    const x = membreParcours(req, res, '/parcours');
    if (!x) return;
    const prochaine = coaching.prochainesSeances(x.session.id, 14)[0];
    res.send(V.pageParcours(config, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id), rappel: aFaireDe(x.p),
      prochain: prochaine ? prochaine.debut : null, derniere: parcours.remarques(x.session.id)[0] || null, formation: formationDe(x.session.id),
      stats: x.p.etape >= 4 ? suivi.stats(x.session.id) : null, activite: activiteDe(x.session.id), aujourdhui: aujourdhuiDe(x.p),
      chaine: communaute.chaine(x.session.id), lienWhop: config.offres.elite.lienFormation || null }));
  });
  app.get('/parcours/etape-:n', (req, res) => {
    const n = Number(req.params.n);
    const x = membreParcours(req, res, `/parcours/etape-${n}`);
    if (!x) return;
    if (![1, 2, 3, 4].includes(n) || x.p.etape < n) { res.redirect(302, '/parcours'); return; }
    const commun = { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id), maxMo };
    if (n === 4) { res.send(pageEtape4(x, commun, MESSAGES_ETAPE4[req.query.ok] ? { texte: MESSAGES_ETAPE4[req.query.ok] } : null)); return; }
    if (n === 1) { res.send(V.pageEtape1(config, { ...commun, soumissions: parcours.soumissions(x.session.id, 1), remarquesDe, formation: formationDe(x.session.id) })); return; }
    if (n === 2) {
      const message = req.query.ok ? { texte: 'Ton coaching d\'entrée est réservé. Bob te le rappellera.' } : null;
      res.send(V.pageEtape2(config, { ...commun, entree: coaching.seancePonctuelle(x.session.id, 'entree'), libres: coaching.creneauxLibres(3), message }));
      return;
    }
    const lundiCourant = coaching.lundiDe(new Date());
    const reserves = coaching.creneauxFixes(x.session.id).length
      || coaching.occurrences(lundiCourant, coaching.ajouterJours(lundiCourant, 6), { discordId: x.session.id }).filter((o) => o.type === 'semaine').length;
    res.send(V.pageEtape3(config, { ...commun, soumissions: parcours.soumissions(x.session.id, 3), remarquesDe,
      coachings: { reserves, min: config.coaching.minParSemaine, max: config.coaching.maxParSemaine || 7 },
      strategie: { strategie: parcours.strategie(x.session.id), niches: ressources.liste('niche', { pour: x.session.id }).filter((r) => r.etat !== 'refuse'),
        methodes: ressources.liste('methode', { pour: x.session.id }).filter((r) => r.etat !== 'refuse'), pays: ressources.PAYS, drapeaux: ressources.DRAPEAUX, niveau: x.p.niveau,
        message: { strategie: 'Stratégie enregistrée.', niche: 'Ta niche est envoyée au coach, et déjà choisie. Choisis ta méthode et ton pays.' }[req.query.fait] || req.query.erreur || null } }));
  });

  app.post('/parcours/etape-3/strategie', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/parcours/etape-3');
    if (!x) return;
    if (x.p.etape < 3) return res.redirect(303, '/parcours');
    const r = parcours.choisirStrategie(x.session.id, { niche: req.body.niche, methode: req.body.methode, pays: req.body.pays });
    if (!r.erreur) prevenir('activiteEleve', r.parcours, 'a choisi sa **stratégie** (niche, méthode 10K, pays).', `/admin/membres/${encodeURIComponent(x.session.id)}/profil`);
    res.redirect(303, r.erreur ? `/parcours/etape-3?erreur=${encodeURIComponent(r.erreur)}#strategie` : '/parcours/etape-3?fait=strategie#strategie');
  });
  // Envoi en deux temps : les informations (note et retour de l'IA à l'étape 1), puis la vidéo.
  app.post('/api/parcours/envoi', json, (req, res) => {
    const m = membreApi(req);
    if (m.erreur) return res.status(m.statut).json({ erreur: m.erreur });
    const { session } = m;
    const b = req.body || {};
    const r = parcours.preparerEnvoi(session.id, String(b.emplacement || ''), { note: b.note, retour: b.retour, remarque: b.remarque, script: b.script });
    if (r.erreur) return res.status(400).json(r);
    return res.json({ id: r.soumission.id });
  });
  app.post('/api/parcours/envoi/:id/video', async (req, res) => {
    const m = membreApi(req);
    if (m.erreur) { req.resume(); return res.status(m.statut).json({ erreur: m.erreur }); }
    const { session } = m;
    try {
      const r = await parcours.recevoirVideo(session.id, req.params.id, req, { type: req.get('content-type'), taille: Number(req.get('content-length')) || 0 });
      if (r.erreur) { req.resume(); return res.status(400).json(r); }
      prevenir('envoiRecu', r.soumission, parcours.get(session.id));
      return res.json({ ok: true });
    } catch (err) {
      console.error('[parcours] vidéo :', err.message);
      return res.status(500).json({ erreur: 'L\'envoi a échoué. Réessaie.' });
    }
  });

  app.post('/parcours/etape-2/reserver', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/parcours/etape-2');
    if (!x) return;
    if (x.p.etape !== 2) { res.redirect(303, '/parcours'); return; }
    const [date, heure] = String(req.body.creneau || '').split('|');
    const r = coaching.reserverPonctuelle(x.session.id, date, heure, 'entree');
    if (r.erreur) {
      res.status(409).send(V.pageEtape2(config, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id), maxMo,
        entree: coaching.seancePonctuelle(x.session.id, 'entree'), libres: coaching.creneauxLibres(3), message: { erreur: true, texte: r.erreur } }));
      return;
    }
    prevenir('entreeReservee', x.p, r.seance);
    res.redirect(303, '/parcours/etape-2?ok=1');
  });

  // Ce qu'il reste à faire au membre (fenêtre à chaque ouverture de Mon parcours).
  function aFaireDe(p) {
    const id = p.discord_id;
    const items = [];
    const ajouter = (texte, lien) => { if (!items.some((x) => x.texte === texte)) items.push({ texte, lien }); };
    if (!accueilFini(id)) ajouter('Termine ton accueil : l\'application et tes notifications', '/bienvenue');
    const t = parcours.tache(id);
    if (t && !['attente1', 'attente3', 'entree-reservee', 'ok', 'goat'].includes(t.cle)) ajouter(t.titre, t.lien);
    if (p.etape === 4 && p.heure_creation) {
      for (const v of suivi.videosAFaire(id)) ajouter(`${v.res_etat === 'corriger' ? 'Corrige les' : 'Donne les'} résultats de ta vidéo du ${jourLisible(v.jour)}`, `/parcours/videos/${v.id}`);
      for (const x of suivi.comptesRendusAFaire(id)) ajouter(x.cr && x.cr.etat === 'corriger' ? `Corrige ton update du compte du ${jourLisible(x.jour)}` : 'Fais l\'update de ton compte', `/parcours/compte-rendu/${x.jour}`);
      if (!suivi.publications(id, suivi.aujourdhui(p)).length) ajouter('Publie ta vidéo du jour', '/parcours/etape-4');
    }
    if ([3, 4].includes(p.etape) && !coaching.aUnPlanning(id)) ajouter('Réserve tes coachings de la semaine', '/coaching');
    const e = config.offres.elite;
    const video = [null, e.wistiaEtape1, e.wistiaEtape2, e.wistiaEtape3, e.wistiaEtape4, e.wistiaGoat][Math.min(p.etape, 5)] || null;
    // Le décompte de la tâche la plus importante (son délai, ou son échéance à l'étape 4).
    const tache = p.etape === 4 ? suivi.tache(p) : t;
    const ech = tache && (tache.delai || tache.echeance);
    return { etape: Math.min(p.etape, 5), items, video, fin: ech ? ech.fin : null, duree: ech ? ech.duree : null };
  }

  // ---- Étape 4 : publication et suivi ----
  const MESSAGES_ETAPE4 = {
    compte: 'Compte TikTok enregistré. Choisis maintenant tes 3 heures.',
    heures: 'Tes heures sont enregistrées. Bob te les rappellera chaque jour.',
    publication: 'Vidéo déclarée. Dans 24 h, tu donneras ses résultats.',
    'compte-rendu': 'Update du compte envoyé. Ton coach le regarde, Bob te prévient de sa décision.',
    resultat: 'Résultats envoyés. Ton coach les regarde, Bob te prévient de sa décision.',
  };
  function pageEtape4(x, commun, message) {
    const id = x.session.id;
    const jour = suivi.aujourdhui(x.p);
    return V.pageEtape4(config, { ...commun, aujourdhui: x.p.fuseau ? jour : null, publications: suivi.publications(id, jour), videos: suivi.videos(id).slice(0, 21),
      aFaire: suivi.comptesRendusAFaire(id), updateDuJour: suivi.compteRendu(id, jour), stats: suivi.stats(id), message,
      avis: parcours.soumissions(id, 4).slice().sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))), remarquesDe, maxMo });
  }
  // Une image n'est acceptée que si ce membre l'a lui-même envoyée.
  const imageDe = (nom, discordId) => (nom && parcours.imageDuMembre(String(nom), discordId) ? String(nom) : null);
  app.post('/parcours/etape-4/heures', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/parcours/etape-4');
    if (!x) return;
    if (x.p.etape < 4) { res.redirect(303, '/parcours'); return; }
    const b = req.body;
    const r = suivi.choisirHeures(x.session.id, { creation: b.creation, publication: b.publication, compteRendu: b.compte_rendu, fuseau: String(b.fuseau || '') });
    if (r.erreur) { res.status(400).send(pageEtape4(x, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id) }, { erreur: true, texte: r.erreur })); return; }
    prevenir('activiteEleve', parcours.get(x.session.id), `a choisi ses **3 heures** : création ${b.creation}, publication ${b.publication}, résultats ${b.compte_rendu}.`);
    res.redirect(303, '/parcours/etape-4?ok=heures');
  });
  // Le lien du compte TikTok : demandé au passage à l'étape 4.
  app.post('/parcours/etape-4/compte', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/parcours/etape-4');
    if (!x) return;
    if (x.p.etape < 4) { res.redirect(303, '/parcours'); return; }
    const { lienCompte } = require('./tiktok');
    const l = lienCompte(req.body.compte);
    if (!l) { res.status(400).send(pageEtape4(x, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id) }, { erreur: true, texte: 'Colle le lien de ton profil TikTok, par exemple https://www.tiktok.com/@ton.compte.' })); return; }
    parcours.majCompte(x.session.id, { compte: l });
    prevenir('activiteEleve', parcours.get(x.session.id), `a ajouté son **compte TikTok** : ${l}`);
    res.redirect(303, '/parcours/etape-4?ok=compte');
  });
  app.post('/parcours/etape-4/publication', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/parcours/etape-4');
    if (!x) return;
    if (x.p.etape < 4) { res.redirect(303, '/parcours'); return; }
    if (!x.p.compte_tiktok) { res.redirect(303, '/parcours/etape-4#compte'); return; }
    const liens = String(req.body.liens || '').split(/\s+/).filter(Boolean);
    const r = suivi.declarer(x.session.id, { liens, capture: imageDe(req.body.capture, x.session.id) });
    if (r.erreur) { res.status(400).send(pageEtape4(x, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id) }, { erreur: true, texte: r.erreur })); return; }
    prevenir('activiteEleve', x.p, `a **publié** ${liens.length > 1 ? `${liens.length} vidéos` : 'sa vidéo du jour'} :\n${liens.slice(0, 5).join('\n')}`, `/admin/membres/${encodeURIComponent(x.session.id)}/profil`);
    res.redirect(303, '/parcours/etape-4?ok=publication');
  });
  // Update du compte : aujourd'hui (ou hier en retard), ou un update à corriger.
  function compteRenduMembre(req, res) {
    const jour = String(req.params.jour || '');
    const x = membreParcours(req, res, `/parcours/compte-rendu/${encodeURIComponent(jour)}`);
    if (!x) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || x.p.etape < 4) { res.redirect(303, '/parcours/etape-4'); return null; }
    const cr = suivi.compteRendu(x.session.id, jour);
    if (cr && cr.etat === 'valide') {
      res.send(P.pageMessage(config, 'Update validé', `Ton update du compte du ${jourLisible(jour)} est validé par ton coach.`, { lien: '/parcours/etape-4', texteLien: 'Étape 4' }));
      return null;
    }
    const remarques = parcours.remarques(x.session.id).filter((r) => String(r.texte || '').startsWith(`Update du compte du ${jourLisible(jour)}`));
    return { ...x, jour, cr, remarques };
  }
  app.get('/parcours/compte-rendu/:jour', (req, res) => {
    const x = compteRenduMembre(req, res);
    if (!x) return;
    res.send(V.pageCompteRendu(config, { espace: x.espace, parcours: x.p, jour: x.jour, cr: x.cr, remarques: x.remarques }));
  });
  app.post('/parcours/compte-rendu/:jour', formulaire, (req, res) => {
    const x = compteRenduMembre(req, res);
    if (!x) return;
    const b = req.body;
    const d = { vues_28j: b.vues_28j, revenus_28j: b.revenus_28j, capture: imageDe(b.capture, x.session.id), question: b.question };
    const r = suivi.enregistrerCompteRendu(x.session.id, x.jour, d);
    if (r.erreur) {
      const saisi = { ...(x.cr || {}), vues_28j: b.vues_28j, revenus_28j: b.revenus_28j, question: b.question, capture_revenus: d.capture || (x.cr && x.cr.capture_revenus) || null };
      res.status(400).send(V.pageCompteRendu(config, { espace: x.espace, parcours: x.p, jour: x.jour, cr: saisi, remarques: x.remarques, erreur: r.erreur }));
      return;
    }
    prevenir('compteRenduRecu', r.compteRendu, x.p);
    res.redirect(303, '/parcours/etape-4?ok=compte-rendu');
  });
  // Résultats d'une vidéo (24 h après la publication ; mise à jour possible ensuite : nouvelle capture, vues, revenus).
  function videoMembre(req, res) {
    const x = membreParcours(req, res, `/parcours/videos/${encodeURIComponent(req.params.id)}`);
    if (!x) return null;
    const v = suivi.video(req.params.id);
    if (!v || v.discord_id !== x.session.id) { res.redirect(303, '/parcours/etape-4'); return null; }
    const remarques = parcours.remarques(x.session.id).filter((r) => String(r.texte || '').startsWith(`Résultats de ta vidéo du ${jourLisible(v.jour)}`));
    return { ...x, v, remarques };
  }
  app.get('/parcours/videos/:id', (req, res) => {
    const x = videoMembre(req, res);
    if (!x) return;
    res.send(V.pageResultatVideo(config, { espace: x.espace, parcours: x.p, video: x.v, remarques: x.remarques }));
  });
  app.post('/parcours/videos/:id', formulaire, (req, res) => {
    const x = videoMembre(req, res);
    if (!x) return;
    const b = req.body;
    const r = suivi.enregistrerResultat(x.session.id, x.v.id, { vues: b.vues, revenus: b.revenus, capture: imageDe(b.capture, x.session.id) });
    if (r.erreur) { res.status(400).send(V.pageResultatVideo(config, { espace: x.espace, parcours: x.p, video: { ...x.v, res_vues: b.vues, res_revenus: b.revenus }, remarques: x.remarques, erreur: r.erreur })); return; }
    prevenir('resultatRecu', r.video, x.p);
    res.redirect(303, '/parcours/etape-4?ok=resultat');
  });
  // Captures envoyées par le membre (compte du jour, revenus).
  app.post('/api/parcours/image', async (req, res) => {
    const m = membreApi(req);
    if (m.erreur) { req.resume(); res.status(m.statut).json({ erreur: m.erreur }); return; }
    try {
      const r = await parcours.recevoirImage(req, { type: req.get('content-type'), taille: Number(req.get('content-length')) || 0 }, m.session.id);
      if (r.erreur) { req.resume(); res.status(400).json(r); return; }
      res.json(r);
    } catch (err) {
      console.error('[parcours] image du membre :', err.message);
      res.status(500).json({ erreur: 'Envoi impossible.' });
    }
  });

  // ---- Sinistré : sa fiche de sinistre ----
  function pageSinistreDe(x, erreur) {
    const s = sinistres.enCours(x.session.id);
    const remarques = parcours.remarques(x.session.id).filter((r) => String(r.texte || '').startsWith('Fiche de sinistre'));
    return V.pageSinistre(config, { espace: x.espace, parcours: x.p, sinistre: s, joursAbsence: sinistres.joursAbsence(x.session.id), remarques, erreur });
  }
  app.get('/sinistre', (req, res) => {
    const x = membreParcours(req, res, '/sinistre', { sinistreOk: true });
    if (!x) return;
    if (!sinistres.estSinistre(x.p)) { res.redirect(302, '/parcours'); return; }
    res.send(pageSinistreDe(x));
  });
  app.post('/sinistre', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/sinistre', { sinistreOk: true });
    if (!x) return;
    if (!sinistres.estSinistre(x.p)) { res.redirect(303, '/parcours'); return; }
    const r = sinistres.remplirFiche(x.session.id, { pourquoi: req.body.pourquoi, engagements: req.body.engagements });
    if (r.erreur) { res.status(400).send(pageSinistreDe(x, r.erreur)); return; }
    prevenir('ficheSinistre', x.p, r.sinistre);
    res.redirect(303, '/sinistre');
  });

  // Mon profil : tableau de bord des récompenses, objectifs, statistiques.
  const donneesProfil = (p) => ({ parcours: p, tableau: suivi.tableau(p.discord_id), stats: suivi.stats(p.discord_id), recompenses: suivi.recompenses(p.discord_id) });
  // Un membre tel que les autres le voient : prénom ou pseudo (jamais le nom complet), photo, rang, chaîne.
  const membreVu = (id) => {
    const p = parcours.get(id) || {};
    const profil = qProfils.get.get(id) || {};
    return { id, nom: profil.prenom || p.pseudo || 'Membre', avatar: profil.avatar || null, role: roleLePlusHaut(suivi.recompenses(id)), chaine: communaute.chaine(id) };
  };
  const decaler = (jour, n) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  function donneesMonProfil(p) {
    const id = p.discord_id;
    const profil = qProfils.get.get(id) || {};
    const aujourdhui = p.fuseau ? suivi.aujourdhui(p) : new Date().toISOString().slice(0, 10);
    const entree = (p.entree_le || aujourdhui).slice(0, 10);
    const debut = entree > decaler(aujourdhui, -45) ? entree : decaler(aujourdhui, -45);
    const videosParJour = {};
    for (const v of suivi.videos(id)) (videosParJour[v.jour] = videosParJour[v.jour] || []).push(v);
    const crs = Object.fromEntries(suivi.comptesRendus(id).map((c) => [c.jour, c]));
    const ordre = ['corriger', 'attente', 'valide'];
    const jours = [];
    for (let j = debut; j <= decaler(aujourdhui, 3); j = decaler(j, 1)) {
      const vids = (videosParJour[j] || []).slice().reverse();
      const etats = [...vids.map((v) => v.res_etat), crs[j] && crs[j].etat].filter(Boolean);
      const e = ordre.find((x) => etats.includes(x)) || (vids.length ? 'publie' : 'vide');
      jours.push({ j, aujourdhui: j === aujourdhui, futur: j > aujourdhui, e, etape4: p.etape >= 4, cr: crs[j] || null,
        videos: vids.map((v) => ({ id: v.id, lien: v.lien, etat: v.res_etat, vues: v.res_vues, revenus: v.res_revenus, pret: v.pret })) });
    }
    const envoyes = new Set(Object.values(crs).filter((c) => c.envoye_le).map((c) => c.jour));
    const chaine = communaute.chaine(id);
    const suivis = communaute.suivis(id);
    const tache = p.etape === 4 ? suivi.tache(p) : parcours.tache(id);
    return {
      parcours: p, prenom: profil.prenom, avatar: profil.avatar, stats: suivi.stats(id) || {}, role: roleLePlusHaut(suivi.recompenses(id)) || 'elite',
      jourDepuis: Math.max(1, Math.floor((Date.now() - new Date(p.entree_le)) / 864e5) + 1), jours, chaine, flamme: communaute.flamme(chaine),
      derniers7: [7, 6, 5, 4, 3, 2, 1].map((k) => envoyes.has(decaler(aujourdhui, -k))), tache,
      suivis: suivis.filter((s) => s.type !== 'concurrent').map((s) => membreVu(s.suivi)), concurrents: suivis.filter((s) => s.type === 'concurrent').map((s) => membreVu(s.suivi)),
      nbSuivis: suivis.length, nbConcurrents: communaute.concurrents(id).length, activite: activiteDe(id), aujourdhui,
      invitations: communaute.invitationsRecues(id).length, notifications: notifsAdmin.nonLuesMembre(id),
      remarquesNouvelles: commandes.db.prepare('SELECT COUNT(*) n FROM remarques WHERE discord_id = ? AND COALESCE(modifie_le, cree_le) > ?').get(id, profil.remarques_vues_le || '').n,
      ...carrousel(p, aujourdhui), seances: coaching.prochainesSeances(id, 14).filter((x) => !x.touchee)
        .map((x) => ({ date: x.date, heure: x.heure, debut: new Date(x.debut).toISOString(), type: C.NOMS_TYPES[x.type] || 'Coaching' })),
    };
  }
  // Le carrousel de Mon profil : place au classement, revenus du mois, prochain objectif.
  function carrousel(p, aujourdhui) {
    const liste = classement();
    const moi = liste.find((x) => x.id === p.discord_id);
    const mois = aujourdhui.slice(0, 7);
    const stats = suivi.stats(p.discord_id) || {};
    return {
      rang: moi && moi.revenus > 0 ? moi.rang : null, totalClasses: liste.length,
      revenusMois: Math.round(suivi.gains(p.discord_id).filter((g) => g.jour.slice(0, 7) === mois).reduce((t, g) => t + g.gain, 0) * 100) / 100,
      objectif: (stats.objectifs || []).find((o) => !o.atteint) || null,
    };
  }
  // ---- Annonces du coach à tous les élèves Elite ----
  // Planifier : événement (bannière), remarque à un élève, message à tous. /admin/annonces reste une autre adresse.
  const pagePlanifier = (req, res) => {
    if (!estAdmin(req, res, '/admin/planifier')) return;
    const onglet = ['remarque', 'message'].includes(req.query.onglet) ? 'message' : 'evenement';
    const qp = (id) => qProfils.get.get(id) || {};
    const fait = { modifie: 'Message modifié.', relance: `Relance envoyée à ${Number(req.query.n) || 0} élève(s).`, message: `Message envoyé à ${Number(req.query.n) || 0} élève(s).` }[req.query.fait];
    res.send(PF.pageAnnonces(config, { espace: espaceDe(lireSession(req, config.secretApp)), nbEleves: parcours.tous().length, onglet,
      envois: onglet === 'message' ? messages.envois(40) : [],
      choisis: [].concat(req.query.a || []).map(String).slice(0, 200),
      eleves: parcours.tous().map((p) => ({ id: p.discord_id, nom: qp(p.discord_id).prenom || p.pseudo || p.discord_id, pseudo: p.pseudo, etape: p.etape })).sort((x, y) => x.nom.localeCompare(y.nom, 'fr')),
      annonces: commandes.db.prepare('SELECT * FROM annonces ORDER BY id DESC LIMIT 30').all(),
      test: req.query.test ? String(req.query.test).slice(0, 200) : null,
      message: fait || (req.query.fait ? (Number(req.query.n) ? `Événement publié et envoyé à ${Number(req.query.n)} élève(s).` : 'Événement publié dans la bannière.') : null), maintenant: new Date().toISOString(),
      erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  };
  app.get('/admin/planifier', pagePlanifier);
  app.get('/admin/annonces', pagePlanifier);
  // Envoyer un message : à un ou plusieurs élèves (ids). « eleve » reste accepté (ancien formulaire de remarque).
  const envoyerMessage = (req, res, retour) => {
    const ids = [].concat(req.body.ids || [], req.body.eleve || []).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean);
    const r = messages.envoyer({ titre: req.body.titre, texte: req.body.texte, images: imagesDe(req.body), ids });
    if (r.erreur) return res.redirect(303, retour(r.erreur));
    diffuser(r.envoi, r.remarques);
    return res.redirect(303, retour(null, r.remarques.length));
  };
  app.post(['/admin/planifier/message', '/admin/planifier/remarque'], formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/planifier?onglet=message')) return;
    envoyerMessage(req, res, (erreur, n) => (erreur ? `/admin/planifier?onglet=message&erreur=${encodeURIComponent(erreur)}` : `/admin/planifier?onglet=message&fait=message&n=${n}`));
  });
  // Modifier un message (jamais le supprimer) : ceux qui l'avaient lu sont prévenus.
  app.post('/admin/messages/:id', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/planifier?onglet=message')) return;
    const r = messages.modifier(req.params.id, { titre: req.body.titre, texte: req.body.texte });
    if (r.erreur) return res.redirect(303, `/admin/planifier?onglet=message&erreur=${encodeURIComponent(r.erreur)}`);
    for (const d of r.dejaLu) prevenir('remarqueModifiee', parcours.get(d.id));
    return res.redirect(303, '/admin/planifier?onglet=message&fait=modifie');
  });
  // Relancer ceux qui ne l'ont pas encore lu.
  app.post('/admin/messages/:id/relancer', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/planifier?onglet=message')) return;
    const e = messages.envoi(req.params.id);
    if (!e) return res.redirect(303, `/admin/planifier?onglet=message&erreur=${encodeURIComponent('Message introuvable.')}`);
    const cibles = e.destinataires.filter((d) => !d.lu).map((d) => ({ id: d.remarqueId, parcours: parcours.get(d.id) })).filter((x) => x.parcours);
    diffuser(e, cibles, { relance: true });
    return res.redirect(303, `/admin/planifier?onglet=message&fait=relance&n=${cibles.length}`);
  });
  // Ancienne modification d'une remarque seule (remarques écrites avant « Envoyer un message »).
  app.post('/admin/remarques/:id', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/planifier?onglet=message')) return;
    const r = parcours.modifierRemarque(req.params.id, req.body.texte);
    if (r.erreur) return res.redirect(303, `/admin/planifier?onglet=message&erreur=${encodeURIComponent(r.erreur)}`);
    const vues = (qProfils.get.get(r.remarque.discord_id) || {}).remarques_vues_le;
    if (vues && vues >= (r.remarque.modifie_le || r.remarque.cree_le)) prevenir('remarqueModifiee', parcours.get(r.remarque.discord_id));
    return res.redirect(303, '/admin/planifier?onglet=message&fait=modifie');
  });
  // Profil du coach.
  app.get('/coach', (req, res) => {
    if (!estAdmin(req, res, '/coach')) return;
    const session = lireSession(req, config.secretApp);
    const liste = classement();
    const espace = espaceDe(session);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    let seances = 0;
    try { seances = coaching.occurrences(aujourdhui, aujourdhui).filter((o) => !o.touchee).length; } catch { seances = 0; }
    // Tâches du jour : décisions prises aujourd'hui, sur ce qui reste à traiter.
    const debut = `${aujourdhui}T00:00:00.000Z`;
    const n = (sql) => { try { return commandes.db.prepare(sql).get(debut).n; } catch { return 0; } };
    const faites = n('SELECT COUNT(*) n FROM soumissions WHERE decide_le >= ?') + n('SELECT COUNT(*) n FROM comptes_rendus WHERE decide_le >= ?') + n('SELECT COUNT(*) n FROM publications WHERE res_decide_le >= ?')
      + n('SELECT COUNT(*) n FROM recompenses WHERE confirme_le >= ?') + n('SELECT COUNT(*) n FROM acces_manuels WHERE decide_le >= ?') + n('SELECT COUNT(*) n FROM candidatures WHERE maj_le >= ? AND statut NOT IN (\'examen\', \'video\')');
    let seancesFaites = 0;
    try { seancesFaites = coaching.occurrences(aujourdhui, aujourdhui).filter((o) => !o.touchee && new Date(o.debut) < new Date()).length; } catch { seancesFaites = 0; }
    const profil = qProfils.get.get(session.id) || {};
    res.send(PF.pageCoach(config, { espace, pseudo: profil.prenom || (session.pseudo !== 'coach' ? session.pseudo : null), avatar: profil.avatar, nbEleves: parcours.tous().length,
      aTraiter: espace.aTraiterParcours, faites, seancesAujourdhui: seances, seancesFaites, top: liste.filter((m) => m.revenus > 0).slice(0, 5) }));
  });
  app.post('/admin/annonces', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/annonces')) return;
    const titre = String(req.body.titre || '').trim().slice(0, 120);
    const texte = String(req.body.texte || '').trim().slice(0, 1800);
    let lien = String(req.body.lien || '').trim().slice(0, 400) || null;
    const erreur = (t) => res.redirect(303, `/admin/annonces?erreur=${encodeURIComponent(t)}`);
    if (!titre || !texte) return erreur('Écris un titre et un message.');
    if (lien && !/^https:\/\/\S+$/.test(lien) && !/^\/(?![/\\])\S*$/.test(lien)) return erreur('Le lien doit commencer par https:// ou être une page du site (/…).');
    const image = imagesDe(req.body)[0] || null;
    const couleur = /^#[0-9a-f]{6}$/i.test(String(req.body.couleur || '')) ? req.body.couleur : '#1a1a1a';
    const fin = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.fin || '')) ? `${req.body.fin}T23:59:59.000Z` : null;
    const notifier = req.body.notifier === '1';
    const ids = notifier ? parcours.tous().map((p) => p.discord_id) : [];
    const r = commandes.db.prepare('INSERT INTO annonces (titre, texte, lien, image, destinataires, cree_le, couleur, fin_le, notifier, envoyes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(titre, texte, lien, image, ids.length, new Date().toISOString(), couleur, fin, notifier ? 1 : 0, notifier ? null : 0);
    const a = commandes.db.prepare('SELECT * FROM annonces WHERE id = ?').get(Number(r.lastInsertRowid));
    if (!notifier) { /* seulement la bannière */ } else if (bob && bob.parcours && bob.parcours.annonce) {
      bob.parcours.annonce(a, ids, image ? parcours.cheminImage(image) : null)
        .then((n) => commandes.db.prepare('UPDATE annonces SET envoyes = ? WHERE id = ?').run(n, a.id))
        .catch((err) => console.error('[bob] annonce :', err.message));
    } else commandes.db.prepare('UPDATE annonces SET envoyes = 0 WHERE id = ?').run(a.id);
    lien = null;
    return res.redirect(303, `/admin/annonces?fait=1&n=${ids.length}`);
  });
  // Test : une notification envoyée à un seul compte (pseudo Discord), pour voir comment elle s'affiche.
  app.post('/admin/notifications/test', formulaire, async (req, res) => {
    if (!estAdmin(req, res, '/admin/annonces')) return;
    const pseudo = String(req.body.pseudo || '').trim().replace(/^@/, '').slice(0, 40);
    const retour = (t, ok) => res.redirect(303, `/admin/planifier?onglet=message&${ok ? 'test' : 'erreur'}=${encodeURIComponent(t)}`);
    if (!pseudo) return retour('Écris le pseudo Discord du compte de test.');
    if (!bob || !bob.idDepuisPseudo || !bob.notifier) return retour('Bob est indisponible : réessaie dans un instant.');
    try {
      const id = await bob.idDepuisPseudo(pseudo);
      if (!id) return retour(`@${pseudo} n'est pas sur le serveur Overmaxx.`);
      const ok = await bob.notifier.membre(id, { content: '🔔 **Notification test d\'Overmaxx**\nSi tu lis ce message, les notifications marchent. Ouvre ton profil : la cloche affiche une pastille rouge.',
        components: bob.boutonsLien ? bob.boutonsLien([{ label: 'Ouvrir mon profil', url: bob.lienPerso(id, pseudo, '/profil') }]) : undefined });
      return retour(ok ? `Notification test envoyée à @${pseudo}.` : `Notification rangée pour @${pseudo}, mais ni l'application ni Bob n'ont pu la lui envoyer.`, ok);
    } catch (err) {
      console.error('[notif test]', err.message);
      return retour('Envoi impossible : réessaie.');
    }
  });
  app.post('/admin/annonces/:id/retirer', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/annonces')) return;
    commandes.db.prepare('UPDATE annonces SET fin_le = ? WHERE id = ?').run(new Date().toISOString(), Number(req.params.id));
    res.redirect(303, '/admin/annonces');
  });
  app.get('/revenus', (req, res) => {
    const x = membreParcours(req, res, '/revenus', { sinistreOk: true });
    if (!x) return;
    const stats = suivi.stats(x.p.discord_id) || {};
    res.send(PF.pageRevenus(config, { espace: x.espace, tableau: suivi.tableau(x.p.discord_id), stats, objectif: (stats.objectifs || []).find((o) => !o.atteint) || null }));
  });
  // Réglages : prénom, pays, lien du compte TikTok ; liens vers notifications et coachings.
  app.get('/reglages', (req, res) => {
    const session = connecte(req, res, '/reglages', 'Réglages');
    if (!session) return;
    const profil = qProfils.get.get(session.id) || {};
    const p = parcours.get(session.id);
    res.send(PF.pageReglages(config, { espace: espaceDe(session), prenom: profil.prenom, pays: profil.pays, parcours: Boolean(p && !p.retire_le), etape: p ? p.etape : 0, compteTikTok: p && p.compte_tiktok,
      message: { profil: 'Profil enregistré.', tiktok: 'Lien du compte enregistré.' }[req.query.fait], erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  app.post('/reglages/profil', formulaire, (req, res) => {
    const session = connecte(req, res, '/reglages', 'Réglages');
    if (!session) return;
    const ancien = qProfils.get.get(session.id) || {};
    qProfils.infos.run(session.id, String(req.body.prenom || '').trim().slice(0, 40) || ancien.prenom || null,
      String(req.body.pays || '').trim().slice(0, 60) || ancien.pays || null, null, new Date().toISOString());
    res.redirect(303, '/reglages?fait=profil');
  });
  app.post('/reglages/tiktok', formulaire, (req, res) => {
    const session = connecte(req, res, '/reglages', 'Réglages');
    if (!session) return;
    const p = parcours.get(session.id);
    const brut = String(req.body.compte || '').trim();
    if (!p || p.retire_le) return res.redirect(303, '/reglages');
    if (!brut || lienCompte(brut) === undefined) return res.redirect(303, `/reglages?erreur=${encodeURIComponent('Colle le lien de ton profil TikTok (https://www.tiktok.com/@ton.compte).')}`);
    parcours.majCompte(session.id, { compte: brut });
    prevenir('activiteEleve', parcours.get(session.id), `a modifié son **compte TikTok** : ${lienCompte(brut) || brut}`);
    return res.redirect(303, '/reglages?fait=tiktok');
  });
  app.get('/profil', (req, res) => {
    const x = membreParcours(req, res, '/profil', { sinistreOk: true });
    if (!x) return;
    res.send(PF.pageMonProfil(config, { espace: x.espace, ...donneesMonProfil(x.p), rappel: aFaireDe(x.p) }));
  });

  // ---- Communauté : suivre (10 places), concurrences (3), invitations ----
  app.get('/communaute', (req, res) => {
    const x = membreParcours(req, res, '/communaute', { sinistreOk: true });
    if (!x) return;
    const id = x.p.discord_id;
    const stats = (a) => (suivi.stats(a) || {}).revenusTotal || 0;
    const suivis = communaute.suivis(id).map((s) => ({ ...s, membre: membreVu(s.suivi) }));
    res.send(PF.pageCommunaute(config, { espace: x.espace, suivis,
      concurrents: communaute.concurrents(id).map((c) => ({ ...c, membre: membreVu(c.autre), moi: stats(id), lui: stats(c.autre) })),
      recues: communaute.invitationsRecues(id).map((c) => ({ ...c, membre: membreVu(c.de) })),
      envoyees: communaute.invitationsEnvoyees(id).map((c) => ({ ...c, membre: membreVu(c.vers) })),
      enVogue: communaute.enVogue(id).map((v) => ({ ...v, membre: membreVu(v.parcours.discord_id) })),
      proches: communaute.proches(id).map((v) => ({ ...v, membre: membreVu(v.parcours.discord_id) })),
      peutConcourir: communaute.peutConcourir(id), fil: communaute.fil(id).map((n) => ({ ...n, membre: membreVu(n.auteur) })), places: suivis.length + communaute.invitationsEnvoyees(id).filter((c) => !communaute.suit(id, c.vers)).length,
      message: { suivi: 'Tu le suis : tu recevras ses nouveaux résultats.', retire: 'Tu ne le suis plus.', defi: 'Invitation envoyée : Bob le prévient.', accepte: 'Concurrence lancée !', refuse: 'Invitation refusée.', abandon: 'Concurrence arrêtée.' }[req.query.fait],
      erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  // Après l'action : retour à la page d'où elle vient (Communauté, ou le profil d'un membre du classement).
  let retourAction = '/communaute';
  const versCommunaute = (res, r, fait) => {
    const base = retourAction;
    retourAction = '/communaute';
    res.redirect(303, `${base}?${r.erreur ? `erreur=${encodeURIComponent(r.erreur)}` : `fait=${fait}`}`);
  };
  const membreCommunaute = (req, res) => {
    const x = membreParcours(req, res, '/communaute', { sinistreOk: true });
    const r = String((req.body && req.body.retour) || '');
    retourAction = /^\/classement\/[\w-]{1,40}$/.test(r) ? r : '/communaute';
    return x ? x.p.discord_id : null;
  };
  app.post('/communaute/suivre', formulaire, (req, res) => {
    const id = membreCommunaute(req, res); if (!id) return;
    versCommunaute(res, communaute.suivre(id, String(req.body.id || '')), 'suivi');
  });
  app.post('/communaute/ne-plus-suivre', formulaire, (req, res) => {
    const id = membreCommunaute(req, res); if (!id) return;
    versCommunaute(res, communaute.nePlusSuivre(id, String(req.body.id || '')), 'retire');
  });
  app.post('/communaute/defier', formulaire, (req, res) => {
    const id = membreCommunaute(req, res); if (!id) return;
    const r = communaute.inviter(id, String(req.body.id || ''));
    if (r.ok) prevenir('invitationConcurrence', r.concurrence, membreVu(id));
    versCommunaute(res, r, 'defi');
  });
  app.post('/communaute/concurrences/:cid', formulaire, (req, res) => {
    const id = membreCommunaute(req, res); if (!id) return;
    const oui = req.body.reponse === 'oui';
    const r = communaute.repondre(id, req.params.cid, oui);
    if (r.ok) prevenir('reponseConcurrence', r.concurrence, membreVu(id), oui);
    versCommunaute(res, r, oui ? 'accepte' : 'refuse');
  });
  app.post('/communaute/concurrences/:cid/abandon', formulaire, (req, res) => {
    const id = membreCommunaute(req, res); if (!id) return;
    versCommunaute(res, communaute.annuler(id, req.params.cid), 'abandon');
  });
  app.get('/remarques', (req, res) => {
    const x = membreParcours(req, res, '/remarques', { sinistreOk: true });
    if (!x) return;
    commandes.db.prepare(`INSERT INTO profils_membres (discord_id, remarques_vues_le, maj_le) VALUES (?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET remarques_vues_le = excluded.remarques_vues_le`).run(x.p.discord_id, new Date().toISOString(), new Date().toISOString());
    res.send(PF.pageRemarques(config, { espace: { ...x.espace, remarquesNouvelles: 0 }, remarques: parcours.remarques(x.p.discord_id),
      envoyes: messages.envoyesPar(x.p.discord_id), fait: req.query.fait === 'envoye', erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  // L'élève écrit au coach : rangé dans À traiter, et Bob prévient le coach.
  app.post('/remarques/ecrire', formulaire, (req, res) => {
    const x = membreParcours(req, res, '/remarques', { sinistreOk: true });
    if (!x) return;
    const imgs = imagesDe(req.body).filter((n) => parcours.imageDuMembre(n, x.p.discord_id));
    const r = messages.ecrireAuCoach(x.p.discord_id, { texte: req.body.texte, images: imgs });
    if (r.erreur) return res.redirect(303, `/remarques?erreur=${encodeURIComponent(r.erreur)}`);
    prevenir('messageAuCoach', r.message, x.p);
    return res.redirect(303, '/remarques?fait=envoye');
  });
  // Coach : lire un message d'élève, y répondre (un message à lui seul), ou le marquer traité.
  const messageRecuDe = (req, res) => {
    const m = messages.recu(req.params.id);
    if (!m) res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce message n\'existe pas.', { lien: '/admin/a-traiter', texteLien: 'À traiter' }));
    return m;
  };
  app.get('/admin/messages-recus/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/messages-recus/${encodeURIComponent(req.params.id)}`)) return;
    const m = messageRecuDe(req, res);
    if (!m) return;
    messages.marquerLu(m.id);
    const nom = (qProfils.get.get(m.discord_id) || {}).prenom || (m.parcours && m.parcours.pseudo) || m.discord_id;
    res.send(PF.pageMessageRecu(config, { espace: espaceDe(lireSession(req, config.secretApp)), m, nom, fait: req.query.fait === 'repondu' }));
  });
  app.post('/admin/messages-recus/:id/repondre', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const m = messageRecuDe(req, res);
    if (!m) return;
    const r = messages.envoyer({ titre: req.body.titre || 'Réponse à ton message', texte: req.body.texte, images: imagesDe(req.body), ids: [m.discord_id] });
    if (r.erreur) return res.redirect(303, `/admin/messages-recus/${m.id}?erreur=${encodeURIComponent(r.erreur)}`);
    diffuser(r.envoi, r.remarques);
    messages.marquerTraite(m.id);
    return res.redirect(303, `/admin/messages-recus/${m.id}?fait=repondu`);
  });
  app.post('/admin/messages-recus/:id/traite', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const m = messageRecuDe(req, res);
    if (!m) return;
    messages.marquerTraite(m.id);
    return res.redirect(303, '/admin/a-traiter');
  });


  // ================= Ressources (élèves Elite et coach) =================
  // Qui regarde : le coach, ou un élève de l'accompagnement (sinon la page explique pourquoi).
  function lecteurRessources(req, res, retour) {
    const session = connecte(req, res, retour, 'Ressources');
    if (!session) return null;
    if (estLeCoach(session)) return { session, coach: true, espace: espaceDe(session) };
    const x = membreParcours(req, res, retour, { sinistreOk: true });
    return x ? { ...x, coach: false } : null;
  }
  // Images d'une ressource : celles du coach, ou celles envoyées par l'élève lui-même (ou déjà sur la ressource).
  const imagesRessource = (b, x, deja = []) => imagesDe(b).filter((n) => x.coach || deja.includes(n) || parcours.imageDuMembre(n, x.session.id));
  // Double base : une ressource publique est aussi postée (ou mise à jour) dans le forum « ressources » du Discord.
  function versForum(r) {
    if (!r || r.etat !== 'public' || !bob || !bob.parcours || !bob.parcours.publierRessource) return;
    Promise.resolve(bob.parcours.publierRessource(r, r.auteur ? nomAuteur(r.auteur) : null))
      .then((fil) => { if (typeof fil === 'string' && fil !== r.discord_fil) commandes.db.prepare('UPDATE ressources SET discord_fil = ? WHERE id = ?').run(fil, r.id); })
      .catch((err) => console.error('[bob] forum des ressources :', err.message));
  }
  const nomAuteur = (id) => (id ? (qProfils.get.get(id) || {}).prenom || (parcours.get(id) || {}).pseudo || 'un élève' : null);
  app.get('/ressources', (req, res) => {
    const type = ['niche', 'methode', 'tutoriel'].includes(req.query.type) ? req.query.type : 'niche';
    const x = lecteurRessources(req, res, `/ressources?type=${type}`);
    if (!x) return;
    res.send(RS.pageRessources(config, { espace: x.espace, type, coach: x.coach, liste: ressources.liste(type, { pour: x.session.id, coach: x.coach }),
      aimees: ressources.aimees(x.session.id), message: { propose: 'Proposition envoyée : le coach la relit avant de la rendre visible.', ajoute: 'Ressource publiée.' }[req.query.fait] || null }));
  });
  app.get('/ressources/nouvelle', (req, res) => {
    const type = ['niche', 'methode', 'tutoriel'].includes(req.query.type) ? req.query.type : 'niche';
    const x = lecteurRessources(req, res, `/ressources/nouvelle?type=${type}`);
    if (!x) return;
    res.send(RS.pageFormRessource(config, { espace: x.espace, type, coach: x.coach }));
  });
  app.post('/ressources/nouvelle', formulaire, (req, res) => {
    const type = ['niche', 'methode', 'tutoriel'].includes(req.body.type) ? req.body.type : 'niche';
    const x = lecteurRessources(req, res, `/ressources/nouvelle?type=${type}`);
    if (!x) return;
    const r = ressources.creer(type, req.body, { auteur: x.coach ? null : x.session.id, images: imagesRessource(req.body, x) });
    if (r.erreur) return res.status(400).send(RS.pageFormRessource(config, { espace: x.espace, type, coach: x.coach, erreur: r.erreur, valeurs: req.body }));
    if (!x.coach) prevenir('ressourceProposee', r.ressource, x.p);
    else versForum(r.ressource);
    // « Ajouter ma niche » depuis l'étape 3 : on y revient, la niche déjà choisie.
    if (!x.coach && type === 'niche' && req.query.retour === 'etape-3') { parcours.choisirStrategie(x.session.id, { niche: r.ressource.id }); return res.redirect(303, '/parcours/etape-3?fait=niche'); }
    return res.redirect(303, `/ressources?type=${type}&fait=${x.coach ? 'ajoute' : 'propose'}`);
  });
  const ressourceDe = (req, res, x) => {
    const r = ressources.une(req.params.id);
    // Une proposition n'est visible que par son auteur et le coach.
    if (!r || (r.etat !== 'public' && !x.coach && r.auteur !== x.session.id)) {
      res.status(404).send(P.pageMessage(config, 'Introuvable', 'Cette ressource n\'existe pas.', { lien: '/ressources', texteLien: 'Ressources' }));
      return null;
    }
    return r;
  };
  app.get('/ressources/:id', (req, res) => {
    const x = lecteurRessources(req, res, `/ressources/${encodeURIComponent(req.params.id)}`);
    if (!x) return;
    const r = ressourceDe(req, res, x);
    if (!r) return;
    res.send(RS.pageRessource(config, { espace: x.espace, r, coach: x.coach, aime: ressources.aimees(x.session.id).has(r.id),
      peutModifier: ressources.peutModifier(r, { discordId: x.session.id, coach: x.coach }), auteur: nomAuteur(r.auteur),
      message: { remarque: 'Remarque envoyée au coach.', modifie: 'Modifications enregistrées.', valide: 'Validée : visible par tous les élèves.', refuse: 'Refusée : l\'élève est prévenu.' }[req.query.fait] || null,
      erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  app.post('/ressources/:id/aimer', formulaire, (req, res) => {
    const x = lecteurRessources(req, res, `/ressources/${encodeURIComponent(req.params.id)}`);
    if (!x) return;
    ressources.basculerLike(req.params.id, x.session.id);
    res.redirect(303, `/ressources/${encodeURIComponent(req.params.id)}`);
  });
  app.get('/ressources/:id/modifier', (req, res) => {
    const x = lecteurRessources(req, res, `/ressources/${encodeURIComponent(req.params.id)}/modifier`);
    if (!x) return;
    const r = ressourceDe(req, res, x);
    if (!r) return;
    if (!ressources.peutModifier(r, { discordId: x.session.id, coach: x.coach })) return res.redirect(303, `/ressources/${r.id}`);
    res.send(RS.pageFormRessource(config, { espace: x.espace, type: r.type, r, coach: x.coach }));
  });
  app.post('/ressources/:id/modifier', formulaire, (req, res) => {
    const x = lecteurRessources(req, res, `/ressources/${encodeURIComponent(req.params.id)}/modifier`);
    if (!x) return;
    const r = ressourceDe(req, res, x);
    if (!r) return;
    const m = ressources.modifier(r.id, req.body, { discordId: x.session.id, coach: x.coach, images: imagesRessource(req.body, x, r.images) });
    if (m.erreur) return res.status(400).send(RS.pageFormRessource(config, { espace: x.espace, type: r.type, r, coach: x.coach, erreur: m.erreur, valeurs: req.body }));
    versForum(m.ressource);
    return res.redirect(303, `/ressources/${r.id}?fait=modifie`);
  });
  // Une remarque d'élève sur une ressource : un message au coach (À traiter), avec le nom de la ressource.
  app.post('/ressources/:id/remarque', formulaire, (req, res) => {
    const x = lecteurRessources(req, res, `/ressources/${encodeURIComponent(req.params.id)}`);
    if (!x || x.coach) return x ? res.redirect(303, `/ressources/${req.params.id}`) : undefined;
    const r = ressourceDe(req, res, x);
    if (!r) return;
    const m = messages.ecrireAuCoach(x.session.id, { texte: req.body.texte, sujet: `Ressource : ${RS.titreDe(r)} (/ressources/${r.id})` });
    if (m.erreur) return res.redirect(303, `/ressources/${r.id}?erreur=${encodeURIComponent(m.erreur)}`);
    prevenir('messageAuCoach', m.message, x.p);
    return res.redirect(303, `/ressources/${r.id}?fait=remarque`);
  });
  app.post('/admin/ressources/:id/decision', formulaire, (req, res) => {
    if (!estAdmin(req, res, `/ressources/${encodeURIComponent(req.params.id)}`)) return;
    const r = ressources.decider(req.params.id, String(req.body.decision || ''), req.body.motif);
    if (r.erreur) return res.redirect(303, `/ressources/${encodeURIComponent(req.params.id)}?erreur=${encodeURIComponent(r.erreur)}`);
    if (r.ressource.auteur) prevenir('ressourceDecidee', r.ressource, parcours.get(r.ressource.auteur), RS.titreDe(r.ressource));
    versForum(r.ressource);
    return res.redirect(303, `/ressources/${r.ressource.id}?fait=${r.ressource.etat === 'public' ? 'valide' : 'refuse'}`);
  });

  // Données de la fiche (membre et coach).
  // Réalisations : les vidéos de l'étape 3 (jusqu'au passage à l'étape 4) et les vidéos relues de l'étape 4 (les 3 dernières).
  const realisationsDe = (id) => [...((parcours.get(id) || {}).etape <= 3 ? parcours.soumissions(id, 3) : []), ...parcours.soumissions(id, 4).slice().sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)))]
    .filter((x) => x.etat !== 'brouillon').map((x) => ({ ...x, remarque: (parcours.remarquesDe(x.id) || [])[0] || null }));
  const donneesFiche = (id) => ({ realisations: realisationsDe(id), stats: suivi.stats(id), recompenses: suivi.recompenses(id), sinistre: sinistres.enCours(id),
    historique: sinistres.historique(id), joursAbsence: sinistres.joursAbsence(id) });
  app.get('/fiche', (req, res) => {
    const x = membreParcours(req, res, '/fiche', { sinistreOk: true });
    if (!x) return;
    res.send(V.pageFiche(config, { espace: x.espace, parcours: x.p, remarques: parcours.remarques(x.session.id), toutes: Boolean(req.query.toutes), ...donneesFiche(x.session.id) }));
  });

  // Images jointes aux remarques : visibles par le coach et par le membre concerné.
  app.get('/fichiers/images/:nom', (req, res) => {
    const session = lireSession(req, config.secretApp);
    const chemin = parcours.cheminImage(req.params.nom);
    if (!session || !chemin) { res.status(404).end(); return; }
    const deLAnnonce = Boolean(commandes.db.prepare('SELECT 1 FROM annonces WHERE image = ?').get(req.params.nom));
    if (!estLeCoach(session) && !deLAnnonce && !parcours.peutVoirImage(req.params.nom, session.id)
      && !(parcours.get(session.id) && ressources.imagePublique(req.params.nom, session.id))) { res.status(403).end(); return; }
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(chemin, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  // ---- Côté coach ----
  app.get('/admin/a-traiter', (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    // Demandes d'intégration : candidats retenus qui ont envoyé leur vidéo, puis nouvelles candidatures.
    const demandes = candidatures ? candidatures.liste().filter((c) => c.statut === 'video' || c.statut === 'examen').map((c) => {
      const r = (c.reponses || []).find((x) => /nom/i.test(x.label) && !/discord|pseudo/i.test(x.label)) || (c.reponses || [])[0];
      return { id: c.id, nom: (r && r.valeur) || c.pseudo || c.discord_id, pseudo: c.pseudo, statut: c.statut, maj_le: c.maj_le };
    }) : [];
    res.send(V.pageATraiter(config, { espace: espaceDe(lireSession(req, config.secretApp)), a: parcours.aTraiter(), candidatures: demandes,
      comptesRendus: suivi.enAttente(), resultats: suivi.resultatsEnAttente(), fichesSinistre: sinistres.fichesATraiter(), roles: suivi.aConfirmer(),
      acces: acces.enAttente(), accesRefuses: acces.refuses(), nomsOffres: Object.fromEntries(Object.values(config.offres).map((o) => [o.id, o.nom])),
      ressources: ressources.enAttente().map((r) => ({ ...r, nom: nomAuteur(r.auteur), titre: RS.titreDe(r) })),
      messagesRecus: messages.recusATraiter().map((m) => ({ ...m, nom: (qProfils.get.get(m.discord_id) || {}).prenom || (m.parcours && m.parcours.pseudo) || m.discord_id })),
      // Toutes les notifications non lues du coach (sauf les messages d'élèves, déjà dans la liste).
      notifications: notifsAdmin.nonLuesListe(100).filter((n) => !String(n.lien || '').startsWith('/admin/messages-recus/')),
      // Déjà traité (7 derniers jours) : notifications lues et messages d'élèves traités, les plus récents d'abord.
      dejaTraites: [
        ...notifsAdmin.luesRecentes(20).map((n) => ({ cat: 'notifications', qui: 'Notification', quand: n.cree_le, quoi: n.texte,
          quoiHtml: require('./admin-notifs').gras(require('./pages').echapper(n.texte.length > 160 ? `${n.texte.slice(0, 160)}…` : n.texte)),
          lien: n.lien ? `/admin/notifications/${n.id}/ouvrir` : null, bouton: n.lien ? 'Rouvrir' : null })),
        ...messages.traitesRecents(10).map((m) => ({ cat: 'messages', qui: (qProfils.get.get(m.discord_id) || {}).prenom || (m.parcours && m.parcours.pseudo) || m.discord_id, ficheId: m.discord_id,
          quand: m.traite_le, quoi: m.texte.length > 140 ? `${m.texte.slice(0, 140)}…` : m.texte, lien: `/admin/messages-recus/${m.id}`, bouton: 'Revoir' })),
      ].sort((x, y) => String(y.quand).localeCompare(String(x.quand))).slice(0, 25) }));
  });
  // Le membre cité dans une notification : sa fiche s'il est dans l'accompagnement, sinon la liste des élèves.
  app.get('/admin/qui/:id', (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    res.redirect(302, parcours.get(String(req.params.id)) ? `/admin/membres/${encodeURIComponent(req.params.id)}` : '/admin/eleves');
  });
  // Ouvrir une notification depuis À traiter : marquée lue, puis sa page (ou la liste des notifications).
  app.get('/admin/notifications/:id/ouvrir', (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const n = notifsAdmin.lire(req.params.id);
    const lien = n && n.lien && /^\/(?![/\\])/.test(n.lien) ? n.lien : n && n.lien && /^https:\/\//.test(n.lien) ? n.lien : '/admin/a-traiter?filtre=notifications';
    res.redirect(302, lien);
  });
  // Rôle donné à la main : Oui (accès au site) ou Non. Même décision que les boutons de Bob.
  app.post('/admin/acces/:programme/:id', formulaire, async (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const r = acces.decider(req.params.id, req.params.programme, req.body.decision === 'oui');
    if (r.ok && bob && bob.accesDecide) { try { await bob.accesDecide(r); } catch (err) { console.error('[bob] accès ouvert :', err.message); } }
    res.redirect(303, '/admin/a-traiter#acces');
  });
  // Comptes rendus de l'étape 4.
  // Résultats d'une vidéo (coach).
  function resultatDe(req, res) {
    const v = suivi.video(req.params.id);
    if (!v || !v.res_etat) { res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ces résultats n\'existent pas.', { lien: '/admin/a-traiter', texteLien: 'À traiter' })); return null; }
    return v;
  }
  app.get('/admin/resultats/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/resultats/${encodeURIComponent(req.params.id)}`)) return;
    const v = resultatDe(req, res);
    if (!v) return;
    res.send(V.pageResultatCoach(config, { espace: espaceDe(lireSession(req, config.secretApp)), video: v, parcours: parcours.get(v.discord_id),
      message: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  app.post('/admin/resultats/:id/decision', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const v = resultatDe(req, res);
    if (!v) return;
    const decision = String(req.body.decision || '');
    const r = suivi.deciderResultat(v.id, decision, { texte: req.body.texte, images: imagesDe(req.body) });
    if (r.erreur) { res.redirect(303, `/admin/resultats/${v.id}?erreur=${encodeURIComponent(r.erreur)}`); return; }
    const p = parcours.get(v.discord_id);
    prevenir('resultatDecide', r.video, p, decision);
    if (r.nouvelles.length) prevenir('recompensesAtteintes', p, r.nouvelles);
    if (decision === 'valider') {
      const suiveurs = communaute.suiveurs(v.discord_id);
      if (suiveurs.length) prevenir('resultatPartage', membreVu(v.discord_id), communaute.nouvelle(r.video), suiveurs);
      for (const c of communaute.verifierConcurrences(v.discord_id)) prevenir('concurrenceGagnee', c, membreVu(v.discord_id), membreVu(c.autre));
    }
    res.redirect(303, '/admin/a-traiter');
  });
  function compteRenduDe(req, res) {
    const cr = suivi.compteRenduParId(req.params.id);
    if (!cr) { res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce compte rendu n\'existe pas.', { lien: '/admin/a-traiter', texteLien: 'À traiter' })); return null; }
    return cr;
  }
  app.get('/admin/comptes-rendus/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/comptes-rendus/${encodeURIComponent(req.params.id)}`)) return;
    const cr = compteRenduDe(req, res);
    if (!cr) return;
    res.send(V.pageCompteRenduCoach(config, { espace: espaceDe(lireSession(req, config.secretApp)), cr, parcours: parcours.get(cr.discord_id),
      capture: suivi.captureDuJour(cr.discord_id, cr.jour), message: req.query.erreur || null, precedent: suivi.totalPrecedent(cr.discord_id, cr.jour) }));
  });
  app.post('/admin/comptes-rendus/:id/decision', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const cr = compteRenduDe(req, res);
    if (!cr) return;
    const decision = String(req.body.decision || '');
    const r = suivi.decider(cr.id, decision, { texte: req.body.texte, images: imagesDe(req.body) });
    if (r.erreur) { res.redirect(303, `/admin/comptes-rendus/${cr.id}?erreur=${encodeURIComponent(r.erreur)}`); return; }
    const p = parcours.get(cr.discord_id);
    prevenir('compteRenduDecide', r.compteRendu, p, decision);
    if (r.nouvelles.length) prevenir('recompensesAtteintes', p, r.nouvelles);
    // Les revenus viennent des updates du compte : une update validée peut faire gagner une concurrence.
    if (decision === 'valider') for (const c of communaute.verifierConcurrences(cr.discord_id)) prevenir('concurrenceGagnee', c, membreVu(cr.discord_id), membreVu(c.autre));
    res.redirect(303, '/admin/a-traiter#etape-4');
  });
  function envoiDe(req, res) {
    const s = parcours.soumission(req.params.id);
    if (!s) { res.status(404).send(P.pageMessage(config, 'Introuvable', 'Cet envoi n\'existe pas.', { lien: '/admin/a-traiter', texteLien: 'À traiter' })); return null; }
    return s;
  }
  app.get('/admin/envois/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/envois/${encodeURIComponent(req.params.id)}`)) return;
    const s = envoiDe(req, res);
    if (!s) return;
    res.send(V.pageEnvoi(config, { espace: espaceDe(lireSession(req, config.secretApp)), s, parcours: parcours.get(s.discord_id),
      remarques: parcours.remarquesDe(s.id), niveauPropose: parcours.niveauPropose(s.discord_id), message: req.query.erreur || null }));
  });
  // L'élève revoit ses propres vidéos envoyées (réalisations).
  app.get('/parcours/envois/:id/video', (req, res) => {
    const session = lireSession(req, config.secretApp);
    const s = parcours.soumission(req.params.id);
    if (!session || !s || s.discord_id !== session.id) { res.status(404).end(); return; }
    const chemin = parcours.cheminVideo(s);
    if (!chemin) { res.status(404).end(); return; }
    res.set('Cache-Control', 'private, max-age=0');
    res.sendFile(chemin, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });
  app.get('/admin/envois/:id/video', (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const chemin = parcours.cheminVideo(parcours.soumission(req.params.id));
    if (!chemin) { res.status(404).end(); return; }
    res.set('Cache-Control', 'private, max-age=0');
    res.sendFile(chemin, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });
  const imagesDe = (b) => String((b && b.images) || '').split(',').map((n) => n.trim()).filter((n) => parcours.cheminImage(n)).slice(0, 10);
  app.post('/admin/envois/:id/decision', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    const s = envoiDe(req, res);
    if (!s) return;
    const r = parcours.decider(s.id, String(req.body.decision || ''), { texte: req.body.texte, images: imagesDe(req.body), niveau: req.body.niveau });
    if (r.erreur) { res.redirect(303, `/admin/envois/${s.id}?erreur=${encodeURIComponent(r.erreur)}`); return; }
    prevenir('decision', r.soumission, r.parcours, r.etapeSuivante);
    res.redirect(303, '/admin/a-traiter');
  });
  app.post('/admin/images', async (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) { req.resume(); return; }
    try {
      const r = await parcours.recevoirImage(req, { type: req.get('content-type'), taille: Number(req.get('content-length')) || 0 });
      if (r.erreur) { req.resume(); res.status(400).json(r); return; }
      res.json(r);
    } catch (err) {
      console.error('[parcours] image :', err.message);
      res.status(500).json({ erreur: 'Envoi impossible.' });
    }
  });
  function ficheDe(req, res) {
    const p = parcours.get(req.params.id);
    if (!p) { res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce membre n\'a pas de parcours Elite.', { lien: '/admin/membres', texteLien: 'Membres' })); return null; }
    return p;
  }
  app.get('/admin/membres/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/membres/${encodeURIComponent(req.params.id)}`)) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const message = { remarque: 'Message envoyé : il le voit dans ses Remarques, et Bob l\'a prévenu.', compte: 'Fiche enregistrée.', etape3: 'Étape 3 ouverte. Bob a prévenu le membre.', etape: 'Étape changée.',
      recompense: 'Rôle confirmé. Bob le donne et prévient le membre.', precisions: 'Précisions demandées. Bob a prévenu le membre.', rehabiliter: 'Membre réhabilité : Bob lui rend le rôle Elite.',
      declarer: 'Sinistre déclaré. Bob l\'a prévenu.', retirer: 'Sinistres retirés : jours d\'absence rendus sur ses 90 jours.' }[req.query.fait] || req.query.erreur || null;
    res.send(V.pageFiche(config, { espace: espaceDe(lireSession(req, config.secretApp)), vueCoach: true, parcours: p, remarques: parcours.remarques(p.discord_id), choix: choixStrategie(),
      toutes: Boolean(req.query.toutes), message, ...donneesFiche(p.discord_id) }));
  });
  app.post('/admin/membres/:id/remarque', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const r = messages.envoyer({ titre: req.body.titre, texte: req.body.texte, images: imagesDe(req.body), ids: [p.discord_id] });
    if (!r.erreur) diffuser(r.envoi, r.remarques);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}${r.erreur ? `?erreur=${encodeURIComponent(r.erreur)}` : '?fait=remarque'}#remarques`);
  });
  app.post('/admin/membres/:id/compte', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const vide = (v) => (v === undefined || v === null || String(v) === '' ? undefined : String(v));
    const st = parcours.choisirStrategie(p.discord_id, { niche: vide(req.body.niche), methode: vide(req.body.methode), pays: vide(req.body.pays) });
    if (st.erreur) return res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?erreur=${encodeURIComponent(st.erreur)}`);
    const champs = p.etape >= 4 && typeof req.body.compte === 'string' ? { compte: req.body.compte } : {};
    if (req.body.ouvrir === '3') {
      const r = parcours.ouvrirEtape3(p.discord_id, champs);
      if (!r.erreur) prevenir('etapeOuverte', r.parcours, 3);
      res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?fait=etape3`);
      return;
    }
    parcours.majCompte(p.discord_id, champs);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?fait=compte`);
  });
  app.get('/admin/membres/:id/profil', (req, res) => {
    if (!estAdmin(req, res, `/admin/membres/${encodeURIComponent(req.params.id)}/profil`)) return;
    const p = ficheDe(req, res);
    if (!p) return;
    res.send(V.pageProfil(config, { espace: espaceDe(lireSession(req, config.secretApp)), vueCoach: true, ...donneesProfil(p), strategie: parcours.strategie(p.discord_id) }));
  });
  app.post('/admin/membres/:id/recompense', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const role = String(req.body.role || '');
    const r = suivi.confirmerRecompense(p.discord_id, role);
    if (!r.erreur) prevenir('recompenseConfirmee', r.parcours, role);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?${r.erreur ? `erreur=${encodeURIComponent(r.erreur)}` : 'fait=recompense'}`);
  });
  app.post('/admin/membres/:id/sinistre', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const action = String(req.body.action || '');
    const texte = String(req.body.texte || '').trim();
    let r;
    if (action === 'precisions') {
      r = texte ? sinistres.demanderPrecisions(p.discord_id) : { erreur: 'Écris ce qu\'il doit préciser.' };
      if (!r.erreur) { parcours.ajouterRemarque(p.discord_id, { texte: `Fiche de sinistre : ${texte}`, type: 'corriger' }); prevenir('sinistre', 'precisions', p); }
    } else if (action === 'rehabiliter') {
      r = sinistres.rehabiliter(p.discord_id);
      if (!r.erreur) prevenir('sinistre', 'rehabilite', r.parcours);
    } else if (action === 'declarer') {
      r = sinistres.ouvrir(p.discord_id);
      if (!r.erreur) prevenir('sinistre', 'ouvert', r.parcours, r);
    } else if (action === 'retirer') {
      const etait = Boolean(p.sinistre_depuis);
      r = sinistres.retirerSinistres(p.discord_id);
      if (!r.erreur) prevenir('sinistre', 'retire', r.parcours, { joursRendus: r.joursRendus, etaitSinistre: etait });
    } else r = { erreur: 'Action inconnue.' };
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?${r.erreur ? `erreur=${encodeURIComponent(r.erreur)}` : `fait=${action}`}`);
  });
  app.post('/admin/membres/:id/etape', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const r = parcours.forcerEtape(p.discord_id, req.body.etape, { compte: req.body.compte, niche: req.body.niche, pays: req.body.pays });
    if (!r.erreur && r.parcours.etape > p.etape) prevenir('etapeOuverte', r.parcours, r.parcours.etape);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?${r.erreur ? `erreur=${encodeURIComponent(r.erreur)}` : 'fait=etape'}`);
  });

  // ---- Tableau des élèves Elite (Kanban) ----
  function donneesEleves() {
    // Les membres Elite payés (mobile money ou carte) ont tous leur parcours, même s'ils ne sont pas encore venus.
    for (const m of db.prepare("SELECT * FROM membres WHERE programme = 'elite' AND statut = 'actif' AND discord_id IS NOT NULL").all()) {
      if (!parcours.get(m.discord_id)) parcours.assurer(m.discord_id, { pseudo: m.discord_pseudo, nom: m.nom, entree: m.cree_le, fin: m.acces_jusqu_au });
    }
    for (const c of db.prepare("SELECT * FROM abonnes_carte WHERE programme = 'elite' AND termine_le IS NULL").all()) {
      if (!parcours.get(c.discord_id)) parcours.assurer(c.discord_id, { pseudo: c.pseudo, entree: c.depuis });
    }
    const a = parcours.aTraiter();
    const retards = new Set(a.retards.map((x) => x.parcours.discord_id));
    const compte = {};
    for (const x of [...a.envois, ...suivi.enAttente(), ...sinistres.fichesATraiter()]) compte[x.discord_id] = (compte[x.discord_id] || 0) + 1;
    const maintenant = Date.now();
    return parcours.tous().map((p) => ({
      id: p.discord_id, nom: p.nom || p.pseudo || p.discord_id, pseudo: p.pseudo, etape: p.etape,
      jour: Math.min(90, Math.max(1, Math.floor((maintenant - new Date(p.entree_le)) / 864e5) + 1)),
      compte: p.compte_tiktok, niche: p.niche, pays: p.pays_cible || p.pays, niveau: p.niveau, nicheId: p.niche_id, methodeId: p.methode_id, paysCible: p.pays_cible,
      sinistre: Boolean(p.sinistre_depuis), sinistres: p.sinistres || 0, retard: retards.has(p.discord_id), aTraiter: compte[p.discord_id] || 0,
      forcees: JSON.parse(p.etapes_forcees || '[]'), tache: p.etape <= 4 ? (parcours.tache(p.discord_id) || {}).titre : null,
      manquants: parcours.manquants(p.discord_id), entree: (p.entree_le || '').slice(0, 10),
      // Vue liste : revenus, vidéos, régularité (chaîne et jours avec un compte rendu), rang.
      ...(() => { const st = suivi.stats(p.discord_id) || {}; const r = roleLePlusHaut(suivi.recompenses(p.discord_id));
        return { revenus: st.revenusTotal || 0, videos: st.videosPubliees || 0, joursCr: commandes.db.prepare('SELECT COUNT(*) n FROM comptes_rendus WHERE discord_id = ? AND envoye_le IS NOT NULL').get(p.discord_id).n,
          chaine: communaute.chaine(p.discord_id), role: p.sinistre_depuis ? 'sinistre' : r || 'elite', rang: ['elite', 'goat', '1500', '5000', '10000'].indexOf(r || 'elite') }; })(),
    })).sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
  }
  app.get('/admin/eleves', (req, res) => {
    if (!estAdmin(req, res, '/admin/eleves')) return;
    const fait = req.query.fait === 'ajoute' ? 'Élève ajouté à l\'étape 1 : glisse-le à son étape.' : req.query.fait === 'infos' ? 'Infos enregistrées.'
      : /^[1-4]$/.test(String(req.query.fait || '')) ? `Élève placé à l'étape ${req.query.fait}. Bob l'a prévenu.` : null;
    res.send(K.pageEleves(config, { espace: espaceDe(lireSession(req, config.secretApp)), eleves: donneesEleves(), vue: req.query.vue === 'liste' ? 'liste' : 'kanban', choix: choixStrategie(),
      sansDiscord: db.prepare("SELECT nom, email FROM membres WHERE programme = 'elite' AND statut = 'actif' AND discord_id IS NULL ORDER BY nom").all(),
      message: fait, erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  app.post('/admin/eleves/:id/etape', json, (req, res) => {
    if (!estAdmin(req, res, '/admin/eleves')) return;
    const avant = parcours.get(req.params.id);
    if (!avant) { res.status(404).json({ erreur: 'Élève introuvable.' }); return; }
    const b = req.body || {};
    const r = parcours.forcerEtape(avant.discord_id, b.etape, { compte: b.compte, niveau: b.niveau });
    if (r.erreur) { res.status(400).json(r); return; }
    if (r.parcours.etape > avant.etape) prevenir('etapeOuverte', r.parcours, r.parcours.etape);
    res.json({ ok: true, etape: r.parcours.etape, forcees: r.forcees });
  });
  // Les choix proposés au coach : niches et méthodes publiques, les 8 pays.
  const choixStrategie = () => ({ niches: ressources.liste('niche', { coach: true }).filter((r) => r.etat === 'public').map((r) => ({ id: r.id, titre: r.titre, categorie: r.categorie })),
    methodes: ressources.liste('methode', { coach: true }).filter((r) => r.etat === 'public').map((r) => ({ id: r.id, titre: RS.titreDe(r) })), pays: ressources.PAYS, drapeaux: ressources.DRAPEAUX });
  app.post('/admin/eleves/:id/infos', json, (req, res) => {
    if (!estAdmin(req, res, '/admin/eleves')) return;
    if (!parcours.get(req.params.id)) { res.status(404).json({ erreur: 'Élève introuvable.' }); return; }
    const b = req.body || {};
    // Niche, méthode et pays : choisis dans les listes (ressources publiques, 8 pays) ; compte TikTok à partir de l'étape 4.
    const vide = (v) => (v === undefined || v === null || String(v) === '' ? undefined : String(v));
    const r = parcours.choisirStrategie(req.params.id, { niche: vide(b.niche), methode: vide(b.methode), pays: vide(b.pays) });
    if (r.erreur) { res.status(400).json(r); return; }
    if (typeof b.compte === 'string' && b.compte.trim()) parcours.majCompte(req.params.id, { compte: b.compte });
    res.json({ ok: true });
  });
  app.post('/admin/eleves/ajouter', formulaire, async (req, res) => {
    if (!estAdmin(req, res, '/admin/eleves')) return;
    const retour = (erreur) => res.redirect(303, `/admin/eleves?erreur=${encodeURIComponent(erreur)}`);
    const pseudo = String(req.body.pseudo || '').trim().replace(/^@/, '').slice(0, 40);
    if (pseudo.length < 2) { retour('Écris son pseudo Discord.'); return; }
    if (!bob || !bob.idDepuisPseudo) { retour('Bob est indisponible : réessaie dans un instant.'); return; }
    try {
      const id = await bob.idDepuisPseudo(pseudo);
      if (!id) { retour(`« ${pseudo} » n'est pas sur le serveur Overmaxx.`); return; }
      const deja = parcours.get(id);
      parcours.assurer(id, { pseudo });
      if (req.body.entree && /^\d{4}-\d{2}-\d{2}$/.test(req.body.entree)) parcours.majEntree(id, `${req.body.entree}T12:00:00.000Z`);
      res.redirect(303, deja ? `/admin/eleves?eleve=${encodeURIComponent(id)}` : '/admin/eleves?fait=ajoute');
    } catch (err) {
      console.error('[élèves]', err.message);
      retour('Impossible de retrouver ce pseudo pour le moment.');
    }
  });

  // ================= Admin =================

  app.get('/admin', (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session) return res.send(E.pageConnexionRequise(config, { retour: '/admin', message: 'Espace admin', lienDiscord: lienDiscord({ but: 'connexion', retour: '/admin' }) }));
    if (session.id !== config.discord.adminId) return res.status(403).send(P.pageMessage(config, 'Accès refusé', 'Cet espace est réservé à l\'admin.'));
    const fait = { dispo: `Disponibilités enregistrées. ${Number(req.query.n) || 0} séance(s) annulée(s) : Bob a prévenu les membres.`,
      imprevu: `Imprévu signalé. ${Number(req.query.n) || 0} membre(s) prévenu(s) par Bob.` }[req.query.fait] || null;
    res.send(C.pageAdmin(config, { ...donneesAdmin(String(req.query.semaine || '')), message: fait, espace: espaceDe(session) }));
    return undefined;
  });

  // Un créneau réservé (coach) : infos, fiche, message, et une demande de déplacement ou d'annulation à l'élève.
  function creneauReserve(date, heure) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !coaching.creneaux.includes(String(heure))) return null;
    const o = coaching.occurrences(date, date).find((x) => x.heure === heure);
    if (!o) return null;
    return { o, date, heure, jourNom: coaching.JOURS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7] };
  }
  app.get('/admin/creneau', (req, res) => {
    if (!estAdmin(req, res, `/admin/creneau?date=${encodeURIComponent(String(req.query.date || ''))}&heure=${encodeURIComponent(String(req.query.heure || ''))}`)) return;
    const c = creneauReserve(String(req.query.date || ''), String(req.query.heure || ''));
    if (!c) return res.status(404).send(P.pageMessage(config, 'Créneau libre', 'Personne n\'a réservé ce créneau (ou la séance a été déplacée).', { lien: `/admin?semaine=${encodeURIComponent(String(req.query.date || ''))}`, texteLien: 'Calendrier' }));
    const membre = { ...infoMembre(c.o.discordId), type: C.NOMS_TYPES[c.o.type] || c.o.type,
      etat: c.o.touchee ? (c.o.touchee.type === 'imprevu' ? 'Annulée (imprévu)' : 'Annulée (tu es absent)') : 'Prévue' };
    res.send(C.pageCreneau(config, { espace: espaceDe(lireSession(req, config.secretApp)), ...c, id: c.o.discordId, membre, libres: coaching.creneauxLibres(14),
      message: req.query.fait ? 'Demande envoyée : l\'élève la voit dans ses Remarques, et Bob l\'a prévenu.' : null, erreur: req.query.erreur ? String(req.query.erreur).slice(0, 200) : null }));
  });
  app.post('/admin/creneau/demande', formulaire, (req, res) => {
    const date = String(req.body.date || ''); const heure = String(req.body.heure || '');
    const retour = `/admin/creneau?date=${encodeURIComponent(date)}&heure=${encodeURIComponent(heure)}`;
    if (!estAdmin(req, res, retour)) return;
    const c = creneauReserve(date, heure);
    if (!c) return res.redirect(303, retour);
    const id = c.o.discordId;
    // L'heure à l'heure de l'élève (son fuseau), sinon en GMT.
    const fuseau = (coaching.profil(id) || {}).fuseau || (parcours.get(id) || {}).fuseau;
    const aSonHeure = (d, h) => {
      const t = new Date(`${d}T${h}:00Z`);
      try { if (fuseau) return t.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: fuseau }).replace(':', ' h '); } catch { /* fuseau inconnu */ }
      return `${t.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} à ${h} GMT`;
    };
    const quand = aSonHeure(date, heure);
    const vers = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(req.body.vers || '')) ? String(req.body.vers).split(' ') : null;
    const demande = req.body.demande === 'annuler'
      ? `Je ne suis pas disponible à cette heure-là. **Peux-tu annuler ce coaching ?** (Mes coachings → Annuler ou reporter.)`
      : `**Peux-tu le déplacer${vers ? ` au ${aSonHeure(vers[0], vers[1])}` : ' à une autre heure'} ?** (Mes coachings → Annuler ou reporter.)`;
    const mot = String(req.body.texte || '').trim().slice(0, 1000);
    const r = messages.envoyer({ titre: `Ton coaching du ${quand}`, texte: `${demande}${mot ? `\n${mot}` : ''}`, ids: [id] });
    if (r.erreur) return res.redirect(303, `${retour}&erreur=${encodeURIComponent(r.erreur)}`);
    diffuser(r.envoi, r.remarques);
    return res.redirect(303, `${retour}&fait=1`);
  });

  function estAdmin(req, res, retour) {
    const session = lireSession(req, config.secretApp);
    if (!session) { res.send(E.pageConnexionRequise(config, { retour, message: 'Espace admin', lienDiscord: lienDiscord({ but: 'connexion', retour }) })); return false; }
    if (session.id !== config.discord.adminId) { res.status(403).send(P.pageMessage(config, 'Accès refusé', 'Cet espace est réservé à l\'admin.')); return false; }
    return true;
  }

  app.get('/admin/candidatures', (req, res) => {
    if (!estAdmin(req, res, '/admin/candidatures')) return;
    res.send(E.pageAdminCandidatures(config, { liste: candidatures ? candidatures.liste() : [], espace: espaceDe(lireSession(req, config.secretApp)) }));
  });

  app.get('/admin/candidatures/:id', (req, res) => {
    if (!estAdmin(req, res, `/admin/candidatures/${encodeURIComponent(req.params.id)}`)) return;
    const c = candidatures && (candidatures.liste().find((x) => x.id === Number(req.params.id)));
    if (!c) { res.status(404).send(P.pageMessage(config, 'Introuvable', 'Cette candidature n\'existe pas.', { lien: '/admin/candidatures', texteLien: 'Toutes les candidatures' })); return; }
    const MESSAGES = { retenir: 'Retenu : Bob lui a envoyé le lien de la suite.', refuser: 'Refusé : Bob l\'a prévenu.', valider: 'Validé : Bob lui a envoyé son lien de paiement.' };
    res.send(E.pageAdminCandidature(config, { candidature: c, espace: espaceDe(lireSession(req, config.secretApp)), message: MESSAGES[req.query.fait] }));
  });

  app.get('/admin/membres', (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const db = commandes.db;
    const membres = db.prepare('SELECT * FROM membres ORDER BY statut, acces_jusqu_au').all();
    const cartes = db.prepare('SELECT * FROM abonnes_carte ORDER BY termine_le IS NOT NULL, perdu_le IS NOT NULL, depuis DESC').all();
    // Leçons terminées sur le total des cours que le membre a commencés.
    const progression = Object.fromEntries(db.prepare(`SELECT p.whop_user_id, SUM(p.termine) terminees, MAX(p.maj_le) derniere,
      (SELECT COALESCE(SUM(c.lecons), 0) FROM cours_whop c WHERE c.id IN (SELECT DISTINCT cours_id FROM progression_whop x WHERE x.whop_user_id = p.whop_user_id)) total
      FROM progression_whop p GROUP BY p.whop_user_id`).all().map((p) => [p.whop_user_id, p]));
    const totalLecons = db.prepare('SELECT COALESCE(SUM(lecons), 0) n FROM cours_whop').get().n;
    const fiches = new Set(parcours.tous().map((p) => p.discord_id));
    res.send(E.pageAdminMembres(config, { membres, cartes, progression, totalLecons, fiches, espace: espaceDe(lireSession(req, config.secretApp)) }));
  });

  // Tous les liens du site, et des aperçus des pages qu'on ne voit qu'après un paiement ou une décision.
  app.get('/admin/pages', (req, res) => {
    if (!estAdmin(req, res, '/admin/pages')) return;
    res.send(E.pageAdminPages(config, { espace: espaceDe(lireSession(req, config.secretApp)) }));
  });
  const APERCUS = {
    'guide-community': () => P.pageGuide(config, { offre: community, ref: 'APERCU', membre: { email: 'exemple@gmail.com' }, lienWhop: 'https://whop.com', codeLiaison: 'AB12CD', lienDiscord: '#' }),
    'guide-elite': () => P.pageGuide(config, { offre: elite, ref: 'APERCU', membre: { email: 'exemple@gmail.com' }, lienWhop: 'https://whop.com', codeLiaison: 'AB12CD', lienDiscord: '#' }),
    'candidature-retenu': () => E.pageConfirmation(config, { session: { id: 'apercu', pseudo: 'exemple' } }),
    'paiement-elite': () => P.pageFormulaire(config, { offre: elite, type: 'inscription', action: '#', lienCarte: elite.lienCarte }),
    candidature: () => E.pageEliteCandidature(config, { session: { id: 'apercu', pseudo: 'exemple' } }),
    coaching: () => {
      const membre = { id: 'apercu', pseudo: 'membre exemple' };
      return C.pageCoaching(config, { session: membre, coaching, grille: coaching.grille(membre.id), seances: [], libres: coaching.creneauxLibres(14), espace: { session: membre, estAdmin: false } });
    },
  };
  for (const statut of ['examen', 'video', 'valide', 'refuse']) {
    APERCUS[`candidature-${statut}`] = () => E.pageCandidature(config, {
      session: { id: 'apercu', pseudo: 'exemple' }, candidature: { statut }, apercu: true,
      lienPaiement: `${config.baseUrl}${elite.base}/paiement/exemple`, paye: false,
    });
  }
  app.get('/admin/apercu/:page', (req, res) => {
    if (!estAdmin(req, res, `/admin/apercu/${encodeURIComponent(req.params.page)}`)) return;
    const page = Object.hasOwn(APERCUS, req.params.page) ? APERCUS[req.params.page] : null;
    if (!page) { res.status(404).send(P.pageMessage(config, 'Aperçu introuvable', 'Cette page n\'existe pas.', { lien: '/admin/pages', texteLien: 'Pages du site' })); return; }
    res.send(page());
  });

  app.get('/admin/videos/:id', (req, res) => {
    if (!estAdmin(req, res, '/admin/candidatures')) return;
    const chemin = candidatures && candidatures.cheminVideo(candidatures.parId(Number(req.params.id)));
    if (!chemin) { res.status(404).end(); return; }
    res.set('Cache-Control', 'private, max-age=0');
    res.sendFile(chemin);
  });

  app.post('/admin/candidatures/:id/supprimer', (req, res) => {
    if (!estAdmin(req, res, '/admin/candidatures')) return;
    if (candidatures) candidatures.supprimer(Number(req.params.id));
    res.redirect(303, '/admin/candidatures');
  });

  app.post('/admin/candidatures/:id/:decision', formulaire, async (req, res) => {
    if (!estAdmin(req, res, '/admin/candidatures')) return;
    const { id, decision } = req.params;
    const r = bob ? await bob.appliquerDecision(Number(id), decision) : candidatures.decider(Number(id), decision);
    if (r.erreur) console.warn('[admin] décision :', r.erreur);
    res.redirect(303, req.body && req.body.retour === 'fiche' ? `/admin/candidatures/${Number(id)}${r.erreur ? '' : `?fait=${encodeURIComponent(decision)}`}` : '/admin/candidatures');
  });

  const db = commandes.db;
  // Qui est ce membre ? (pour le calendrier, les disponibilités et l'imprévu)
  function infoMembre(id) {
    const m = commandes.membresParDiscord(id).sort((a, b) => (a.programme === 'elite' ? -1 : 1) - (b.programme === 'elite' ? -1 : 1))[0] || {};
    const profil = coaching.profil(id) || {};
    const pc = parcours.get(id);
    const pseudo = m.discord_pseudo || profil.pseudo || (pc && pc.pseudo);
    const fixes = coaching.creneauxFixes(id);
    return {
      nom: m.nom || (pc && pc.nom) || pseudo || '(inconnu)', pseudo: pseudo || id, email: m.email || 'payé sur Whop',
      court: (pseudo || m.nom || '?').slice(0, 8),
      creneaux: fixes.map((x) => `${coaching.JOURS[x.jour].slice(0, 3)} ${x.heure}`).join(', ') || 'aucun',
      rappel: profil.rappel_min ? `${profil.rappel_min >= 120 ? `${profil.rappel_min / 60} h` : '1 h 30'} avant` : null,
      fuseau: profil.fuseau || (pc && pc.fuseau) || 'inconnue', fiche: pc ? `/admin/membres/${encodeURIComponent(id)}` : null,
    };
  }
  const nomMembre = (id) => infoMembre(id).nom;
  function donneesAdmin(semaine) {
    const lundi = /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? coaching.lundiDe(new Date(`${semaine}T12:00:00Z`)) : coaching.lundiDe(new Date());
    const dimanche = coaching.ajouterJours(lundi, 6);
    const occ = coaching.occurrences(lundi, dimanche);
    const absences = coaching.absences(lundi, dimanche);
    const annulations = db.prepare('SELECT * FROM annulations WHERE date BETWEEN ? AND ? ORDER BY date, heure').all(lundi, dimanche);
    const infos = new Map();
    const info = (id) => { if (!infos.has(id)) infos.set(id, infoMembre(id)); return infos.get(id); };
    const jours = [];
    const cases = [];
    for (let i = 0; i < 7; i++) {
      const date = coaching.ajouterJours(lundi, i);
      jours.push({ nom: coaching.JOURS[i], date });
      for (const heure of coaching.creneaux) {
        const o = occ.find((x) => x.date === date && x.heure === heure);
        const a = absences.find((x) => x.date === date && x.heure === heure);
        const membre = o ? { ...info(o.discordId), type: C.NOMS_TYPES[o.type] || o.type,
          etat: o.touchee ? (o.touchee.type === 'imprevu' ? 'Annulée (imprévu)' : 'Annulée (tu es absent)') : 'Prévue' } : null;
        cases.push({ date, heure, cle: `${date} ${heure}`, membre, touchee: o ? o.touchee || null : null, absence: a ? { type: a.type } : null });
      }
    }
    const lundiProchain = coaching.ajouterJours(coaching.lundiDe(new Date()), 7);
    return {
      lundi, jours, cases, coaching, lundiProchain, dispoProchaine: coaching.dispoEnvoyee(lundiProchain), aujourdhui: coaching.dateISO(new Date()),
      annulations: annulations.map((a) => ({ ...a, nom: info(a.discord_id).nom })),
      touchees: coaching.touchees(lundi, dimanche).map((t) => ({ ...t, nom: info(t.discord_id).nom })),
    };
  }

  // ---- Disponibilités de la semaine et imprévu (coach) ----
  const lundiValide = (x, defaut) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? coaching.lundiDe(new Date(`${x}T12:00:00Z`)) : defaut);
  app.get('/admin/disponibilites', (req, res) => {
    if (!estAdmin(req, res, '/admin/disponibilites')) return;
    const lundi = lundiValide(req.query.semaine, coaching.ajouterJours(coaching.lundiDe(new Date()), 7));
    const d = coaching.disponibilites(lundi);
    res.send(C.pageDisponibilites(config, { espace: espaceDe(lireSession(req, config.secretApp)), coaching, lundi, absences: d.absences, seances: d.seances,
      envoye: d.envoye, nomDe: nomMembre }));
  });
  app.post('/admin/disponibilites', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/disponibilites')) return;
    const lundi = lundiValide(req.body.semaine, null);
    if (!lundi) { res.redirect(303, '/admin'); return; }
    const coches = new Set([].concat(req.body.dispo || []).map(String));
    const absences = [];
    for (let i = 0; i < 7; i++) {
      const date = coaching.ajouterJours(lundi, i);
      for (const heure of coaching.creneaux) if (!coches.has(`${date}|${heure}`)) absences.push({ date, heure });
    }
    const r = coaching.enregistrerDisponibilites(lundi, absences);
    prevenirSeances('touchees', r.touchees);
    prevenirSeances('retablies', r.retablies);
    res.redirect(303, `/admin?semaine=${lundi}&fait=dispo&n=${r.touchees.length}`);
  });
  function pageImprevuDe(req, res, date, erreur) {
    const maintenant = new Date();
    const seances = coaching.occurrences(date, date).filter((o) => o.debut > maintenant);
    return C.pageImprevu(config, { espace: espaceDe(lireSession(req, config.secretApp)), date, seances, nomDe: nomMembre, erreur });
  }
  app.get('/admin/imprevu', (req, res) => {
    if (!estAdmin(req, res, '/admin/imprevu')) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : coaching.dateISO(new Date());
    res.send(pageImprevuDe(req, res, date));
  });
  app.post('/admin/imprevu', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/imprevu')) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || '')) ? req.body.date : coaching.dateISO(new Date());
    const r = coaching.signalerImprevu(date, [].concat(req.body.heure || []).map(String), req.body.message);
    if (r.erreur) { res.status(400).send(pageImprevuDe(req, res, date, r.erreur)); return; }
    prevenirSeances('touchees', r.touchees);
    res.redirect(303, `/admin?semaine=${date}&fait=imprevu&n=${r.touchees.length}`);
  });

  // ================= Webhooks =================

  app.post('/webhooks/saspay', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
    const corps = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const ok = signatureValide(corps, req.get('X-Webhook-Signature'), req.get('X-Webhook-Timestamp'), config.saspay.secretWebhook);
    if (!ok) return res.status(401).json({ erreur: 'signature invalide' });

    let evenement;
    try { evenement = JSON.parse(corps.toString('utf8')); } catch { return res.status(400).json({ erreur: 'JSON invalide' }); }

    if (evenement.event !== 'transaction.success') return res.json({ ignore: evenement.event });
    const tx = evenement.data || {};
    if (!tx.id || (tx.type && tx.type !== 'PAIEMENT')) return res.json({ ignore: 'pas un paiement' });

    try {
      const r = await commandes.traiterTransaction(tx.id);
      if (!r) {
        console.log(`[webhook] transaction ${tx.id} : pas une commande Overmaxx, ignorée`);
        return res.json({ ignore: 'pas une commande de ce site' });
      }
      console.log(`[webhook] commande ${r.ref} : ${r.etat}`);
      return res.json({ ok: true, etat: r.etat });
    } catch (err) {
      console.error('[webhook]', err.message);
      return res.status(500).json({ erreur: 'traitement impossible, réessayer' });
    }
  });

  // Candidatures Elite (formulaire Tally) → message privé à l'admin.
  app.post('/webhooks/tally', express.raw({ type: '*/*', limit: '200kb' }), async (req, res) => {
    const corps = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (config.tally.secret) {
      const attendu = crypto.createHmac('sha256', config.tally.secret).update(corps).digest('base64');
      const recu = Buffer.from(String(req.get('tally-signature') || ''));
      if (recu.length !== Buffer.from(attendu).length || !crypto.timingSafeEqual(recu, Buffer.from(attendu))) {
        return res.status(401).json({ erreur: 'signature invalide' });
      }
    }
    try {
      const evt = JSON.parse(corps.toString('utf8'));
      const champs = ((evt.data && evt.data.fields) || []).map((f) => {
        let v = f.value;
        if (Array.isArray(v) && Array.isArray(f.options)) v = v.map((id) => (f.options.find((o) => o.id === id) || {}).text || id).join(', ');
        else if (Array.isArray(v)) v = v.map((x) => (typeof x === 'object' ? x.url || x.name || JSON.stringify(x) : x)).join(', ');
        else if (v && typeof v === 'object') v = JSON.stringify(v);
        return { label: String(f.label || f.key || '?').slice(0, 100), valeur: String(v == null ? '—' : v).slice(0, 400) };
      });
      const estCache = (c) => /^(discord_id|pseudo)$/i.test(c.label.trim());
      let discordId = (champs.find((c) => /^discord_id$/i.test(c.label.trim())) || {}).valeur;
      const reponses = champs.filter((c) => !estCache(c));
      // Sans champ caché : on retrouve le candidat grâce à la question « pseudo Discord » du formulaire.
      const champPseudo = reponses.find((c) => /discord/i.test(c.label));
      if ((!discordId || !/^\d{15,22}$/.test(discordId)) && champPseudo && bob && bob.idDepuisPseudo) {
        discordId = await bob.idDepuisPseudo(champPseudo.valeur);
        if (discordId && candidatures) candidatures.demarrer(discordId, String(champPseudo.valeur).trim().replace(/^@/, ''));
      }
      const cand = candidatures && discordId && /^\d{15,22}$/.test(discordId) ? candidatures.recevoirFormulaire(discordId, reponses) : null;
      if (cand) { if (bob) await bob.candidatureRecue(cand, reponses); } else if (bob) {
        await bob.candidature(reponses, champPseudo ? `Pseudo Discord « ${champPseudo.valeur} » introuvable sur le serveur : réponds-lui toi-même.` : null);
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('[tally]', err.message);
      return res.status(400).json({ erreur: 'contenu invalide' });
    }
  });

  app.get('/sante', (req, res) => res.json({ ok: true }));

  return app;
}

module.exports = { creerApp };
