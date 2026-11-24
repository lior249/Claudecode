'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I pour éviter les confusions

// Code déterministe et impossible à deviner : le même paiement donne toujours le même code,
// ce qui rend le webhook et la page « merci » idempotents sans base de données.
function codePourSession(idSession, secret) {
  const hash = crypto.createHmac('sha256', secret).update(`promo:${idSession}`).digest();
  let code = 'ACCES';
  for (let i = 0; i < 10; i++) code += ALPHABET[hash[i] % ALPHABET.length];
  return code;
}

function montant(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

// Vérifie auprès de SasPay que le paiement est réel, réussi, dans la bonne devise et au bon prix.
async function paiementConforme(saspay, idTransaction, config) {
  const tx = await saspay.verifierPaiement(idTransaction);
  if (!tx || tx.status !== 'SUCCESS') return { ok: false, raison: `statut ${tx && tx.status}` };
  if (String(tx.currency).toUpperCase() !== config.devise.toUpperCase()) {
    return { ok: false, raison: `devise ${tx.currency}` };
  }
  const paye = montant(tx.requested_amount !== undefined ? tx.requested_amount : tx.amount);
  if (!(paye >= montant(config.prix))) return { ok: false, raison: `montant ${tx.requested_amount}` };
  return { ok: true, tx };
}

// Donne l'accès pour une session de checkout payée. Retourne null si le paiement n'est pas conforme.
async function donnerAcces({ saspay, whop, config }, session, idTransaction) {
  if (!session || !session.id) return null;
  if (montant(session.amount) < montant(config.prix)) return null;
  const verif = await paiementConforme(saspay, idTransaction, config);
  if (!verif.ok) {
    console.warn(`[acces] paiement non conforme (${verif.raison}) pour la session ${session.id}`);
    return null;
  }
  const promo = await whop.assurerCodePromo(codePourSession(session.id, config.secretApp));
  const lien = await whop.lienAchatOffre();
  return { code: promo.code, lien, nouveau: promo.nouveau };
}

module.exports = { codePourSession, donnerAcces, paiementConforme };
