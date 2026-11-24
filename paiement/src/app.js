'use strict';

const crypto = require('crypto');
const express = require('express');
const { signatureValide } = require('./saspay');
const P = require('./pages');

const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const REF_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

// Lien de renouvellement personnel (que le bot Discord enverra) : email signé, non falsifiable.
function jetonMembre(email, secret) {
  const e = Buffer.from(email).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`membre:${e}`).digest('base64url').slice(0, 22);
  return `${e}.${sig}`;
}

function lireJetonMembre(jeton, secret) {
  if (typeof jeton !== 'string' || !jeton.includes('.')) return null;
  const [e] = jeton.split('.');
  const attendu = jetonMembre(Buffer.from(e, 'base64url').toString(), secret);
  const a = Buffer.from(jeton);
  const b = Buffer.from(attendu);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? Buffer.from(e, 'base64url').toString() : null;
}

function lienRenouvellement(config, email) {
  return `${config.baseUrl}/renouveler?m=${jetonMembre(email, config.secretApp)}`;
}

function lireFormulaire(body) {
  return {
    nom: String(body.nom || '').trim().slice(0, 100),
    email: String(body.email || '').trim().toLowerCase().slice(0, 200),
    telephone: String(body.telephone || '').replace(/[^\d+]/g, '').slice(0, 20),
    m: typeof body.m === 'string' ? body.m.slice(0, 400) : '',
  };
}

function creerApp({ config, commandes, whop }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const formulaire = express.urlencoded({ extended: false, limit: '10kb' });

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Étape 1
  app.get('/', (req, res) => res.send(P.pageAccueil(config)));

  // Étape 2 (inscription)
  app.get('/paiement', (req, res) => res.send(P.pageFormulaire(config, { type: 'inscription' })));

  app.post('/paiement', formulaire, async (req, res) => {
    const valeurs = lireFormulaire(req.body);
    const refus = (erreur, statut = 400) => res.status(statut).send(P.pageFormulaire(config, { type: 'inscription', erreur, valeurs }));
    if (valeurs.nom.length < 2) return refus('Entre ton nom.');
    if (!EMAIL_REGEX.test(valeurs.email)) return refus("L'email n'est pas valide.");
    if (commandes.membre(valeurs.email)) {
      return refus(`Cet email est déjà inscrit. <a href="${P.echapper(lienRenouvellement(config, valeurs.email))}">Renouvelle ton abonnement ici</a>.`, 409);
    }
    try {
      const { urlPaiement } = await commandes.demarrer({ type: 'inscription', ...valeurs });
      return res.redirect(303, urlPaiement); // Étape 3 : page de paiement SasPay
    } catch (err) {
      console.error('[paiement]', err.message);
      return refus('Le paiement ne peut pas démarrer pour le moment. Réessaie dans un instant.', 502);
    }
  });

  // Renouvellement
  app.get('/renouveler', (req, res) => {
    const email = lireJetonMembre(req.query.m, config.secretApp);
    const membre = email ? commandes.membre(email) : null;
    const valeurs = membre ? { nom: membre.nom, email: membre.email, telephone: membre.telephone, m: req.query.m } : {};
    res.send(P.pageFormulaire(config, { type: 'renouvellement', valeurs, emailVerrouille: Boolean(membre) }));
  });

  app.post('/renouveler', formulaire, async (req, res) => {
    const valeurs = lireFormulaire(req.body);
    const jetonEmail = lireJetonMembre(valeurs.m, config.secretApp);
    if (jetonEmail) valeurs.email = jetonEmail;
    const refus = (erreur, statut = 400) => res.status(statut).send(P.pageFormulaire(config, {
      type: 'renouvellement', erreur, valeurs, emailVerrouille: Boolean(jetonEmail),
    }));
    if (valeurs.nom.length < 2) return refus('Entre ton nom.');
    if (!EMAIL_REGEX.test(valeurs.email)) return refus("L'email n'est pas valide.");
    if (!commandes.membre(valeurs.email)) {
      return refus('Aucun abonnement trouvé pour cet email. Utilise l\'email de ton inscription, ou <a href="/paiement">inscris-toi</a>.', 404);
    }
    try {
      const { urlPaiement } = await commandes.demarrer({ type: 'renouvellement', ...valeurs });
      return res.redirect(303, urlPaiement);
    } catch (err) {
      console.error('[renouveler]', err.message);
      return refus('Le paiement ne peut pas démarrer pour le moment. Réessaie dans un instant.', 502);
    }
  });

  // Étape 3 bis : retour de SasPay → page de chargement
  app.get('/confirmation/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));
    try {
      const e = await commandes.etat(ref);
      if (e.etat === 'introuvable') return res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));
      return res.send(P.pageConfirmation(config, { ref, type: e.type }));
    } catch (err) {
      console.error('[confirmation]', err.message);
      return res.send(P.pageConfirmation(config, { ref, type: 'inscription' }));
    }
  });

  // Interrogé toutes les 3 s par la page de chargement
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
      return res.json({ etat: 'en_attente' }); // la page réessaiera
    }
  });

  // Étape 4 : tutoriel
  app.get('/acces/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));
    try {
      const e = await commandes.etat(ref);
      if (e.etat !== 'confirme' || e.type !== 'inscription') return res.redirect(303, `/confirmation/${ref}`);
      return res.send(P.pageTutoriel(config, { code: e.code, lien: await whop.lienAchatOffre(), accesJusquAu: e.accesJusquAu }));
    } catch (err) {
      console.error('[acces]', err.message);
      return res.status(502).send(P.pageMessage(config, 'Un instant…', 'Ton paiement est bien enregistré, mais ton code n\'a pas pu être préparé. Recharge la page dans quelques secondes.', { lien: `/acces/${ref}`, texteLien: 'Recharger' }));
    }
  });

  app.get('/renouvele/:ref', async (req, res) => {
    const { ref } = req.params;
    if (!REF_REGEX.test(ref)) return res.status(404).send(P.pageMessage(config, 'Introuvable', 'Ce paiement est introuvable.'));
    try {
      const e = await commandes.etat(ref);
      if (e.etat !== 'confirme' || e.type !== 'renouvellement') return res.redirect(303, `/confirmation/${ref}`);
      return res.send(P.pageRenouvele(config, { accesJusquAu: e.accesJusquAu }));
    } catch (err) {
      console.error('[renouvele]', err.message);
      return res.redirect(303, `/confirmation/${ref}`);
    }
  });

  // Webhook SasPay : corps BRUT obligatoire pour vérifier la signature.
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
        // Paiement hors de ce tunnel, ou session pas encore à jour : SasPay réessaiera (5 fois max).
        console.warn(`[webhook] aucune commande pour la transaction ${tx.id}`);
        return res.status(503).json({ erreur: 'commande introuvable' });
      }
      console.log(`[webhook] commande ${r.ref} : ${r.etat}`);
      return res.json({ ok: true, etat: r.etat });
    } catch (err) {
      console.error('[webhook]', err.message);
      return res.status(500).json({ erreur: 'traitement impossible, réessayer' });
    }
  });

  app.get('/sante', (req, res) => res.json({ ok: true }));

  return app;
}

module.exports = { creerApp, jetonMembre, lireJetonMembre, lienRenouvellement };
