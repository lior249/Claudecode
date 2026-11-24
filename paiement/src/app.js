'use strict';

const crypto = require('crypto');
const express = require('express');
const { signatureValide } = require('./saspay');
const { donnerAcces } = require('./acces');
const { pageAchat, pageAcces, pageAttente, pageMessage } = require('./pages');

const NOM_COOKIE = 'sp_session';
const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function signer(valeur, secret) {
  const sig = crypto.createHmac('sha256', secret).update(`cookie:${valeur}`).digest('base64url');
  return `${valeur}.${sig}`;
}

function lireSigne(brut, secret) {
  if (!brut) return null;
  const i = brut.lastIndexOf('.');
  if (i <= 0) return null;
  const valeur = brut.slice(0, i);
  const a = Buffer.from(brut);
  const b = Buffer.from(signer(valeur, secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? valeur : null;
}

function lireCookie(req, nom) {
  const entete = req.headers.cookie || '';
  for (const morceau of entete.split(';')) {
    const [cle, ...reste] = morceau.trim().split('=');
    if (cle === nom) return decodeURIComponent(reste.join('='));
  }
  return null;
}

function creerApp({ config, saspay, whop, envoyerEmail }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  const deps = { saspay, whop, config };

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  app.get('/', (req, res) => res.send(pageAchat(config)));

  app.post('/acheter', express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
    const nom = String(req.body.nom || '').trim().slice(0, 100);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 200);
    const telephone = String(req.body.telephone || '').replace(/[^\d+]/g, '').slice(0, 20);
    const valeurs = { nom, email, telephone };

    if (nom.length < 2) return res.status(400).send(pageAchat(config, { erreur: 'Entre ton nom.', valeurs }));
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).send(pageAchat(config, { erreur: "L'email n'est pas valide.", valeurs }));
    }

    try {
      const corps = {
        amount: Number(config.prix).toFixed(2),
        currency: config.devise,
        description: config.nomFormation,
        customer_email: email,
        customer_name: nom,
        return_url: `${config.baseUrl}/merci`,
        metadata: { produit: 'formation', email_whop: email },
      };
      if (telephone) corps.customer_phone = telephone;
      if (config.pays) corps.country = config.pays;

      const session = await saspay.creerSessionCheckout(corps);
      if (!session || !session.id || !session.checkout_url) throw new Error('Réponse SasPay inattendue');

      res.cookie(NOM_COOKIE, signer(session.id, config.secretApp), {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.baseUrl.startsWith('https://'),
        maxAge: 3 * 24 * 3600 * 1000,
        path: '/',
      });
      return res.redirect(303, session.checkout_url);
    } catch (err) {
      console.error('[acheter]', err.message);
      return res.status(502).send(pageAchat(config, {
        erreur: 'Le paiement ne peut pas démarrer pour le moment. Réessaie dans un instant.',
        valeurs,
      }));
    }
  });

  app.get('/merci', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const idSession = lireSigne(lireCookie(req, NOM_COOKIE), config.secretApp);
    if (!idSession) {
      return res.send(pageMessage(config, 'Merci !',
        config.email.cleResend
          ? 'Si ton paiement est validé, tu reçois ton code d\'accès par email dans quelques minutes.'
          : 'Nous n\'avons pas retrouvé ton paiement sur cet appareil. Contacte le support avec l\'email utilisé.'));
    }
    try {
      const statut = await saspay.statutSession(idSession);
      if (statut.status === 'PAID' && statut.transaction_status === 'SUCCESS' && statut.transaction_id) {
        const session = await saspay.detailSession(idSession);
        const acces = await donnerAcces(deps, session, statut.transaction_id);
        if (acces) return res.send(pageAcces(config, acces));
        return res.send(pageMessage(config, 'Paiement à vérifier', 'Ton paiement doit être vérifié manuellement. Contacte le support.'));
      }
      if (statut.status === 'PENDING') return res.send(pageAttente(config));
      return res.send(pageMessage(config, 'Paiement non abouti', 'Le paiement a échoué ou a été annulé. Tu peux réessayer.'));
    } catch (err) {
      console.error('[merci]', err.message);
      return res.status(502).send(pageMessage(config, 'Un instant…', 'Impossible de vérifier ton paiement pour le moment. Recharge la page dans quelques secondes.'));
    }
  });

  // Webhook SasPay : corps BRUT obligatoire pour vérifier la signature.
  app.post('/webhooks/saspay', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
    const corps = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const ok = signatureValide(
      corps,
      req.get('X-Webhook-Signature'),
      req.get('X-Webhook-Timestamp'),
      config.saspay.secretWebhook,
    );
    if (!ok) return res.status(401).json({ erreur: 'signature invalide' });

    let evenement;
    try { evenement = JSON.parse(corps.toString('utf8')); } catch { return res.status(400).json({ erreur: 'JSON invalide' }); }

    if (evenement.event !== 'transaction.success') return res.json({ ignore: evenement.event });
    const tx = evenement.data || {};
    if (!tx.id || (tx.type && tx.type !== 'PAIEMENT')) return res.json({ ignore: 'pas un paiement' });

    try {
      const session = await saspay.trouverSessionParTransaction(tx.id);
      if (!session) {
        // Peut être un paiement hors de ce tunnel (lien de paiement manuel…). On demande un renvoi
        // au cas où la session ne serait pas encore à jour ; SasPay réessaie 5 fois puis abandonne.
        console.warn(`[webhook] aucune session de checkout pour la transaction ${tx.id}`);
        return res.status(503).json({ erreur: 'session introuvable' });
      }
      const acces = await donnerAcces(deps, session, tx.id);
      if (!acces) return res.json({ ignore: 'paiement non conforme' });

      if (envoyerEmail && session.customer_email) {
        await envoyerEmail({
          email: session.customer_email,
          nom: session.customer_name,
          code: acces.code,
          lien: acces.lien,
          nomFormation: config.nomFormation,
        });
      }
      console.log(`[webhook] accès prêt pour ${session.customer_email} (session ${session.id})`);
      return res.json({ ok: true });
    } catch (err) {
      console.error('[webhook]', err.message);
      return res.status(500).json({ erreur: 'traitement impossible, réessayer' });
    }
  });

  app.get('/sante', (req, res) => res.json({ ok: true }));

  return app;
}

module.exports = { creerApp, signer, lireSigne };
