'use strict';

const crypto = require('crypto');
const express = require('express');
const { signatureValide } = require('./saspay');
const { lireJetonMembre, lienRenouvellement } = require('./liens');
const { lireSession, ouvrirSession, fermerSession, verifier, signer } = require('./discord-oauth');
const P = require('./pages');
const E = require('./pages-espace');
const V = require('./pages-parcours');
const { creerParcours } = require('./parcours');
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

function creerApp({ config, commandes, whop, coaching, oauth, bob, candidatures, parcours: parcoursDonne }) {
  const parcours = parcoursDonne || creerParcours({ db: commandes.db, config });
  const prevenir = (nom, ...args) => { if (bob && bob.parcours && bob.parcours[nom]) bob.parcours[nom](...args).catch((e) => console.error(`[bob] parcours ${nom} :`, e.message)); };
  const lienDiscord = (state, options) => (config.oauthActif && oauth ? oauth.urlAutorisation(state, options) : null);
  // Barre latérale : qui est connecté, et combien de candidatures attendent une décision.
  const espaceDe = (session) => {
    const estAdmin = Boolean(session && session.id === config.discord.adminId);
    const aTraiter = estAdmin && candidatures ? candidatures.liste().filter((c) => c.statut === 'examen' || c.statut === 'video').length : 0;
    const aTraiterParcours = estAdmin ? parcours.aTraiter().total : 0;
    return { session, estAdmin, aTraiter, aTraiterParcours, parcours: Boolean(!estAdmin && session && parcours.get(session.id)) };
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

  // ================= Paiements (Community et Elite) =================

  // Toutes les pages sauf l'accueil : connexion avec le compte Discord obligatoire.
  function connecte(req, res, retour, message) {
    const session = lireSession(req, config.secretApp);
    if (session) return session;
    res.send(E.pageConnexionRequise(config, { retour: retourSur(retour || req.originalUrl, '/'), message }));
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
  app.get('/', (req, res) => res.send(P.pageBienvenue(config)));
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
        { lien: '/deconnexion', texteLien: 'Changer de compte' }));
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

  app.get('/connexion', (req, res) => res.send(E.pageConnexionRequise(config, { retour: retourSur(req.query.retour, '/') })));

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
      if (depasse(demandesConnexion.compte, id, 3, 30 * 60 * 1000)) return page({ erreur: 'Bob t\'a déjà envoyé plusieurs boutons : regarde sur Discord, ou réessaie dans une demi-heure.' }, 429);
      const r = await bob.envoyerConnexion(id, retour, pseudo);
      if (!r.ok) return page({ erreur: 'Bob n\'arrive pas à t\'écrire sur Discord. Vérifie que tu es bien sur le serveur Overmaxx, puis réessaie.' }, 502);
      return res.send(E.pageConnexionEnvoyee(config, { url: r.url, retour }));
    } catch (err) {
      console.error('[connexion]', err.message);
      return page({ erreur: 'La connexion est indisponible pour le moment. Réessaie dans un instant.' }, 502);
    }
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

  app.get('/deconnexion', (req, res) => { fermerSession(res); res.redirect(302, '/'); });

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
    const roles = await oauth.rolesSurServeur(session.id);
    if (!roles) return { interdit: 'Tu n\'es pas sur le serveur Discord Overmaxx avec ce compte.' };
    if (config.discord.roleGoat && roles.includes(config.discord.roleGoat)) {
      return { interdit: 'Les GOAT ont un live de groupe dédié : il n\'y a pas de coaching individuel à réserver.' };
    }
    if (!elite.roleDiscord || !roles.includes(elite.roleDiscord)) return { interdit: 'Le coaching privé est réservé aux membres Elite.' };
    const p = parcours.get(session.id);
    if (p && p.etape < 3 && !coaching.reserveurs().includes(session.id)) {
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
      if (!d.ok) return res.send(E.pageCoaching(config, { session, interdit: d.interdit, versParcours: d.parcours, espace: espaceDe(session) }));
      const message = req.query.ok ? 'Tes créneaux sont enregistrés. Bob t\'a envoyé le récapitulatif.' : req.query.annule ? 'Séance annulée. Ton coach est prévenu.' : null;
      return res.send(E.pageCoaching(config, {
        session, coaching, message, grille: coaching.grille(session.id), seances: coaching.prochainesSeances(session.id), espace: espaceDe(session),
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
    return session;
  }

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
    if (p) return p;
    const m = commandes.membresParDiscord(session.id).find((x) => x.programme === 'elite' && x.statut === 'actif');
    if (m) return parcours.assurer(session.id, { pseudo: session.pseudo || m.discord_pseudo, nom: m.nom, entree: m.cree_le, fin: m.acces_jusqu_au });
    const carte = commandes.db.prepare("SELECT * FROM abonnes_carte WHERE discord_id = ? AND programme = 'elite' AND termine_le IS NULL").get(session.id);
    if (carte) return parcours.assurer(session.id, { pseudo: session.pseudo || carte.pseudo, entree: carte.depuis });
    return null;
  }
  function membreParcours(req, res, retour) {
    const session = connecte(req, res, retour, 'Overmaxx Elite');
    if (!session) return null;
    if (estLeCoach(session)) { res.redirect(302, '/admin/a-traiter'); return null; }
    const p = parcoursDe(session);
    if (!p) {
      res.status(403).send(P.pageMessage(config, 'Accompagnement Elite', 'Cette page est réservée aux membres de l\'accompagnement Elite.', { lien: elite.base, texteLien: 'Découvrir l\'Elite' }));
      return null;
    }
    return { session, p, espace: espaceDe(session) };
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

  app.get('/parcours', (req, res) => {
    const x = membreParcours(req, res, '/parcours');
    if (!x) return;
    const prochaine = coaching.prochainesSeances(x.session.id, 14)[0];
    res.send(V.pageParcours(config, { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id),
      prochain: prochaine ? prochaine.debut : null, derniere: parcours.remarques(x.session.id)[0] || null, formation: formationDe(x.session.id) }));
  });
  app.get('/parcours/etape-:n', (req, res) => {
    const n = Number(req.params.n);
    const x = membreParcours(req, res, `/parcours/etape-${n}`);
    if (!x) return;
    if (![1, 2, 3].includes(n) || x.p.etape < n) { res.redirect(302, '/parcours'); return; }
    const commun = { espace: x.espace, parcours: x.p, tache: parcours.tache(x.session.id), maxMo };
    if (n === 1) { res.send(V.pageEtape1(config, { ...commun, soumissions: parcours.soumissions(x.session.id, 1), remarquesDe, formation: formationDe(x.session.id) })); return; }
    if (n === 2) {
      const message = req.query.ok ? { texte: 'Ton coaching d\'entrée est réservé. Bob te le rappellera.' } : null;
      res.send(V.pageEtape2(config, { ...commun, entree: coaching.seancePonctuelle(x.session.id, 'entree'), libres: coaching.creneauxLibres(3), message }));
      return;
    }
    const reserves = coaching.grille(x.session.id).cases.filter((c) => c.etat === 'moi').length;
    res.send(V.pageEtape3(config, { ...commun, soumissions: parcours.soumissions(x.session.id, 3), remarquesDe,
      coachings: { reserves, min: config.coaching.minParSemaine, max: config.coaching.maxParSemaine || 7 } }));
  });

  // Envoi en deux temps : les informations (note et retour de l'IA à l'étape 1), puis la vidéo.
  app.post('/api/parcours/envoi', json, (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session || !parcoursDe(session)) return res.status(401).json({ erreur: 'Ta connexion a expiré. Recharge la page.' });
    const b = req.body || {};
    const r = parcours.preparerEnvoi(session.id, String(b.emplacement || ''), { note: b.note, retour: b.retour });
    if (r.erreur) return res.status(400).json(r);
    return res.json({ id: r.soumission.id });
  });
  app.post('/api/parcours/envoi/:id/video', async (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session || !parcoursDe(session)) { req.resume(); return res.status(401).json({ erreur: 'Ta connexion a expiré. Recharge la page.' }); }
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

  app.get('/fiche', (req, res) => {
    const x = membreParcours(req, res, '/fiche');
    if (!x) return;
    res.send(V.pageFiche(config, { espace: x.espace, parcours: x.p, remarques: parcours.remarques(x.session.id), toutes: Boolean(req.query.toutes) }));
  });

  // Images jointes aux remarques : visibles par le coach et par le membre concerné.
  app.get('/fichiers/images/:nom', (req, res) => {
    const session = lireSession(req, config.secretApp);
    const chemin = parcours.cheminImage(req.params.nom);
    if (!session || !chemin) { res.status(404).end(); return; }
    if (!estLeCoach(session) && parcours.proprietaireImage(req.params.nom) !== session.id) { res.status(403).end(); return; }
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(chemin, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  // ---- Côté coach ----
  app.get('/admin/a-traiter', (req, res) => {
    if (!estAdmin(req, res, '/admin/a-traiter')) return;
    res.send(V.pageATraiter(config, { espace: espaceDe(lireSession(req, config.secretApp)), a: parcours.aTraiter() }));
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
    const message = { remarque: 'Remarque publiée. Bob a prévenu le membre.', compte: 'Fiche enregistrée.', etape3: 'Étape 3 ouverte. Bob a prévenu le membre.', etape: 'Étape changée.' }[req.query.fait] || null;
    res.send(V.pageFiche(config, { espace: espaceDe(lireSession(req, config.secretApp)), vueCoach: true, parcours: p, remarques: parcours.remarques(p.discord_id), toutes: Boolean(req.query.toutes), message }));
  });
  app.post('/admin/membres/:id/remarque', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const r = parcours.ajouterRemarque(p.discord_id, { texte: req.body.texte, images: imagesDe(req.body) });
    if (!r.erreur) prevenir('remarque', p);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}${r.erreur ? '' : '?fait=remarque'}#remarques`);
  });
  app.post('/admin/membres/:id/compte', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const champs = { compte: req.body.compte, niche: req.body.niche, pays: req.body.pays };
    if (req.body.ouvrir === '3') {
      const r = parcours.ouvrirEtape3(p.discord_id, champs);
      if (!r.erreur) prevenir('etapeOuverte', r.parcours, 3);
      res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?fait=etape3`);
      return;
    }
    parcours.majCompte(p.discord_id, champs);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?fait=compte`);
  });
  app.post('/admin/membres/:id/etape', formulaire, (req, res) => {
    if (!estAdmin(req, res, '/admin/membres')) return;
    const p = ficheDe(req, res);
    if (!p) return;
    const r = parcours.changerEtape(p.discord_id, req.body.etape);
    if (!r.erreur && r.parcours.etape !== p.etape) prevenir('etapeOuverte', r.parcours, r.parcours.etape);
    res.redirect(303, `/admin/membres/${encodeURIComponent(p.discord_id)}?fait=etape`);
  });

  // ================= Admin =================

  app.get('/admin', (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session) return res.send(E.pageConnexionRequise(config, { retour: '/admin', message: 'Espace admin', lienDiscord: lienDiscord({ but: 'connexion', retour: '/admin' }) }));
    if (session.id !== config.discord.adminId) return res.status(403).send(P.pageMessage(config, 'Accès refusé', 'Cet espace est réservé à l\'admin.'));
    res.send(E.pageAdmin(config, { ...donneesAdmin(String(req.query.semaine || '')), espace: espaceDe(session) }));
    return undefined;
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
      return E.pageCoaching(config, { session: membre, coaching, grille: coaching.grille(membre.id), seances: [], espace: { session: membre, estAdmin: false } });
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
  function donneesAdmin(semaine) {
    const lundi = /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? coaching.lundiDe(new Date(`${semaine}T12:00:00Z`)) : coaching.lundiDe(new Date());
    const dimanche = coaching.ajouterJours(lundi, 6);
    const reservations = db.prepare('SELECT * FROM reservations').all();
    const annulations = db.prepare('SELECT * FROM annulations WHERE date BETWEEN ? AND ? ORDER BY date, heure').all(lundi, dimanche);
    const membres = db.prepare('SELECT * FROM membres ORDER BY statut, acces_jusqu_au').all();
    const parDiscord = new Map();
    for (const m of membres) if (m.discord_id && (!parDiscord.has(m.discord_id) || m.programme === 'elite')) parDiscord.set(m.discord_id, m);
    const jours = [];
    const cases = [];
    for (let i = 0; i < 7; i++) {
      const date = coaching.ajouterJours(lundi, i);
      jours.push({ nom: coaching.JOURS[i], date });
      for (const heure of coaching.creneaux) {
        const r = reservations.find((x) => x.jour === i && x.heure === heure && date >= x.effectif_le);
        const a = annulations.find((x) => x.date === date && x.heure === heure);
        let membre = null;
        if (r) {
          const m = parDiscord.get(r.discord_id) || {};
          const profil = coaching.profil(r.discord_id) || {};
          const siens = reservations.filter((x) => x.discord_id === r.discord_id).map((x) => `${coaching.JOURS[x.jour].slice(0, 3)} ${x.heure}`).join(', ');
          const pseudo = m.discord_pseudo || profil.pseudo;
          membre = {
            nom: m.nom || pseudo || '(inconnu)', pseudo: pseudo || r.discord_id, email: m.email || 'payé sur Whop',
            court: (pseudo || m.nom || '?').slice(0, 8),
            fin: m.acces_jusqu_au ? P.formatDate(m.acces_jusqu_au) : 'géré par Whop', creneaux: siens,
            rappel: profil.rappel_min ? `${profil.rappel_min >= 120 ? `${profil.rappel_min / 60} h` : '1 h 30'} avant` : null,
            annulation: a ? a.justification : null,
          };
        }
        cases.push({ date, heure, cle: `${date} ${heure}`, membre, annulee: Boolean(a) });
      }
    }
    const nomDe = (id) => (parDiscord.get(id) || {}).nom || (coaching.profil(id) || {}).pseudo || id;
    return {
      lundi, jours, cases, membres, coaching,
      annulations: annulations.map((a) => ({ ...a, nom: nomDe(a.discord_id) })),
    };
  }

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
