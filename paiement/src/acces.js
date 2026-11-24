'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I pour éviter les confusions

// Code déterministe et impossible à deviner : la même commande donne toujours le même code,
// ce qui rend la création du code idempotente (webhook rejoué, page rechargée…).
function codePourRef(ref, secret) {
  const hash = crypto.createHmac('sha256', secret).update(`promo:${ref}`).digest();
  let code = 'ACCES';
  for (let i = 0; i < 10; i++) code += ALPHABET[hash[i] % ALPHABET.length];
  return code;
}

function centimes(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

// Vérifie auprès de SasPay que le paiement est réel, réussi, dans la bonne devise et au bon montant.
async function paiementConforme(saspay, idTransaction, { montant, devise }) {
  const tx = await saspay.verifierPaiement(idTransaction);
  if (!tx || tx.status !== 'SUCCESS') return { ok: false, raison: `statut ${tx && tx.status}` };
  if (String(tx.currency).toUpperCase() !== String(devise).toUpperCase()) {
    return { ok: false, raison: `devise ${tx.currency}` };
  }
  const paye = centimes(tx.requested_amount !== undefined ? tx.requested_amount : tx.amount);
  if (!(paye >= centimes(montant))) return { ok: false, raison: `montant ${tx.requested_amount}` };
  return { ok: true, tx };
}

module.exports = { codePourRef, paiementConforme, centimes };
