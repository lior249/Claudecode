'use strict';

const crypto = require('crypto');

// Lien de renouvellement personnel (envoyé par Bob) : email signé, non falsifiable.
function jetonMembre(email, secret) {
  const e = Buffer.from(email).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`membre:${e}`).digest('base64url').slice(0, 22);
  return `${e}.${sig}`;
}

function lireJetonMembre(jeton, secret) {
  if (typeof jeton !== 'string' || jeton.length > 600 || !jeton.includes('.')) return null;
  const [e] = jeton.split('.');
  const email = Buffer.from(e, 'base64url').toString();
  const a = Buffer.from(jeton);
  const b = Buffer.from(jetonMembre(email, secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? email : null;
}

function lienRenouvellement(config, programme, email) {
  return `${config.baseUrl}${config.offres[programme].base}/renouveler?m=${jetonMembre(email, config.secretApp)}`;
}

function lienInscription(config, programme) {
  return programme === 'community' ? `${config.baseUrl}/community` : `${config.baseUrl}${config.offres.elite.base}`;
}

module.exports = { jetonMembre, lireJetonMembre, lienRenouvellement, lienInscription };
