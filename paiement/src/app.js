'use strict';

const crypto = require('crypto');
const express = require('express');
const { signatureValide } = require('./saspay');
const { lireJetonMembre, lienRenouvellement } = require('./liens');
const { lireSession, ouvrirSession, fermerSession } = require('./discord-oauth');
const P = require('./pages');
const E = require('./pages-espace');

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

const retourSur = (r) => (typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/coaching');

function creerApp({ config, commandes, whop, coaching, oauth, bob }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const formulaire = express.urlencoded({ extended: false, limit: '10kb' });
  const json = express.json({ limit: '20kb' });
  const introuvable = (res) => res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cache-Control', 'no-store');
    next();
  });

  // ================= Paiements (Community et Elite) =================

  async function lancerPaiement(req, res, { offre, type, page, invitationToken }) {
    const valeurs = lireFormulaire(req.body);
    const jetonEmail = type === 'renouvellement' ? lireJetonMembre(valeurs.m, config.secretApp) : null;
    if (jetonEmail) valeurs.email = jetonEmail;
    const refus = (erreur, statut = 400) => res.status(statut).send(page({ erreur, valeurs, emailVerrouille: Boolean(jetonEmail) }));
    if (valeurs.nom.length < 2) return refus('Entre ton nom.');
    if (!EMAIL_REGEX.test(valeurs.email)) return refus("L'email n'est pas valide.");
    const membre = commandes.membre(offre.id, valeurs.email);
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
      const { urlPaiement } = await commandes.demarrer({ programme: offre.id, type, ...valeurs, invitationToken });
      return res.redirect(303, urlPaiement);
    } catch (err) {
      console.error('[paiement]', err.message);
      return refus('Le paiement ne peut pas démarrer pour le moment. Réessaie dans un instant.', 502);
    }
  }

  function formulaireRenouvellement(offre) {
    return (req, res) => {
      const email = lireJetonMembre(req.query.m, config.secretApp);
      const m = email ? commandes.membre(offre.id, email) : null;
      const valeurs = m ? { nom: m.nom, email: m.email, telephone: m.telephone, m: req.query.m } : {};
      const montant = m ? commandes.montantPour(offre.id, 'renouvellement', m.email) : undefined;
      res.send(P.pageFormulaire(config, { offre, type: 'renouvellement', valeurs, emailVerrouille: Boolean(m), montant }));
    };
  }

  // ---- Community ----
  const community = config.offres.community;
  app.get('/', (req, res) => res.redirect(302, '/community'));
  app.get('/community', (req, res) => res.send(P.pageAccueil(config, community)));
  app.get('/community/paiement', (req, res) => res.send(P.pageFormulaire(config, { offre: community, type: 'inscription', retour: '/community' })));
  app.post('/community/paiement', formulaire, (req, res) => lancerPaiement(req, res, {
    offre: community, type: 'inscription',
    page: (o) => P.pageFormulaire(config, { offre: community, type: 'inscription', retour: '/community', ...o }),
  }));
  app.get('/community/renouveler', formulaireRenouvellement(community));
  app.post('/community/renouveler', formulaire, (req, res) => lancerPaiement(req, res, {
    offre: community, type: 'renouvellement',
    page: (o) => P.pageFormulaire(config, { offre: community, type: 'renouvellement', ...o }),
  }));
  // Anciennes adresses
  app.get('/paiement', (req, res) => res.redirect(301, '/community/paiement'));
  app.get('/renouveler', (req, res) => res.redirect(301, `/community/renouveler${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`));

  // ---- Elite ----
  const elite = config.offres.elite;
  app.get('/coaching/elite', (req, res) => res.send(E.pageEliteCandidature(config)));
  function invitationValide(req, res) {
    const inv = commandes.invitation(req.params.token);
    if (!inv) { res.status(404).send(P.pageMessage(config, 'Lien invalide', 'Ce lien de paiement n\'existe pas.', { lien: elite.base, texteLien: 'Découvrir l\'Elite' })); return null; }
    if (inv.utilisee_le) { res.status(410).send(P.pageMessage(config, 'Lien déjà utilisé', 'Ce lien personnel a déjà servi à un paiement.', { lien: elite.base, texteLien: 'Retour' })); return null; }
    return inv;
  }
  app.get('/coaching/elite/paiement/:token', (req, res) => {
    if (!invitationValide(req, res)) return;
    res.send(P.pageFormulaire(config, { offre: elite, type: 'inscription', action: `${elite.base}/paiement/${req.params.token}` }));
  });
  app.post('/coaching/elite/paiement/:token', formulaire, (req, res) => {
    if (!invitationValide(req, res)) return undefined;
    return lancerPaiement(req, res, {
      offre: elite, type: 'inscription', invitationToken: req.params.token,
      page: (o) => P.pageFormulaire(config, { offre: elite, type: 'inscription', action: `${elite.base}/paiement/${req.params.token}`, ...o }),
    });
  });
  app.get('/coaching/elite/renouveler', formulaireRenouvellement(elite));
  app.post('/coaching/elite/renouveler', formulaire, (req, res) => lancerPaiement(req, res, {
    offre: elite, type: 'renouvellement',
    page: (o) => P.pageFormulaire(config, { offre: elite, type: 'renouvellement', ...o }),
  }));

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
      return res.send(P.pageGuide(config, { offre, ref, membre: e.membre, lienWhop, discordLie: Boolean(e.membre.discord_id), erreurDiscord }));
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

  app.get('/connexion', (req, res) => {
    if (!config.oauthActif) return res.status(503).send(P.pageMessage(config, 'Bientôt disponible', 'La connexion Discord n\'est pas encore configurée.'));
    return res.redirect(302, oauth.urlAutorisation({ but: 'connexion', retour: retourSur(req.query.retour) }));
  });

  app.get('/deconnexion', (req, res) => { fermerSession(res); res.redirect(302, '/community'); });

  app.get('/discord/callback', async (req, res) => {
    const st = oauth && oauth.lireState(String(req.query.state || ''));
    if (!st) return res.status(400).send(P.pageMessage(config, 'Lien expiré', 'Recommence la connexion Discord.'));
    const retour = st.but === 'lier' ? `/acces/${st.ref}` : retourSur(st.retour);
    if (!req.query.code) return res.redirect(302, st.but === 'lier' ? `${retour}?discord=erreur` : '/community');
    try {
      const u = await oauth.identifier(String(req.query.code));
      ouvrirSession(res, u, config);
      if (st.but === 'lier') {
        const membre = commandes.lierDiscord(st.ref, u.id, u.pseudo);
        if (!membre) return res.redirect(302, `${retour}?discord=erreur`);
        const offre = config.offres[membre.programme];
        await oauth.ajouterAuServeur(u.id, u.accessToken, membre.statut === 'actif' ? [offre.roleDiscord] : []);
        if (bob) bob.bienvenue(membre).catch(() => {});
      }
      return res.redirect(302, retour);
    } catch (err) {
      console.error('[discord]', err.message);
      return res.redirect(302, st.but === 'lier' ? `${retour}?discord=erreur` : '/community');
    }
  });

  // ================= Coaching privé =================

  // Accès : rôle Elite sur le serveur, sans le rôle GOAT. L'admin a toujours accès.
  async function droitsCoaching(session) {
    if (session.id === config.discord.adminId) return { ok: true };
    const roles = await oauth.rolesSurServeur(session.id);
    if (!roles) return { interdit: 'Tu n\'es pas sur le serveur Discord Overmaxx avec ce compte.' };
    if (config.discord.roleGoat && roles.includes(config.discord.roleGoat)) {
      return { interdit: 'Les GOAT ont un live de groupe dédié : il n\'y a pas de coaching individuel à réserver.' };
    }
    if (!elite.roleDiscord || !roles.includes(elite.roleDiscord)) return { interdit: 'Le coaching privé est réservé aux membres Elite.' };
    return { ok: true };
  }

  app.get('/coaching', async (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session) return res.send(E.pageConnexionRequise(config, { retour: '/coaching', message: 'Coaching privé' }));
    try {
      const d = await droitsCoaching(session);
      if (!d.ok) return res.send(E.pageCoaching(config, { session, interdit: d.interdit }));
      const message = req.query.ok ? 'Tes créneaux sont enregistrés. Bob t\'a envoyé le récapitulatif.' : req.query.annule ? 'Séance annulée. Ton coach est prévenu.' : null;
      return res.send(E.pageCoaching(config, {
        session, coaching, message, grille: coaching.grille(session.id), seances: coaching.prochainesSeances(session.id),
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

  // ================= Admin =================

  app.get('/admin', (req, res) => {
    const session = lireSession(req, config.secretApp);
    if (!session) return res.send(E.pageConnexionRequise(config, { retour: '/admin', message: 'Espace admin' }));
    if (session.id !== config.discord.adminId) return res.status(403).send(P.pageMessage(config, 'Accès refusé', 'Cet espace est réservé à l\'admin.'));
    res.send(E.pageAdmin(config, donneesAdmin(String(req.query.semaine || ''))));
    return undefined;
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
      if (bob) await bob.candidature(champs);
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
