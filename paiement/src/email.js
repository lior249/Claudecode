'use strict';

const { echapper } = require('./pages');

// Envoi optionnel via Resend (https://resend.com). Sans RESEND_API_KEY, rien n'est envoyé.
function creerEnvoyeurEmail({ cleResend, expediteur }, fetchImpl = fetch) {
  if (!cleResend) return null;
  return async function envoyerConfirmation({ email, nom, type, nomOffre, lienGuide }) {
    const renouv = type === 'renouvellement';
    const html = `
      <p>Salut ${echapper(nom)},</p>
      <p>Ton paiement pour <b>${echapper(nomOffre)}</b> est confirmé.</p>
      ${renouv
        ? '<p>Ton abonnement est renouvelé. Tu peux retourner sur le Discord.</p>'
        : `<p>Pour accéder à tout, suis le guide : <a href="${echapper(lienGuide)}">${echapper(lienGuide)}</a></p>
           <p>Sur Whop, réponds à la question avec cet email : <b>${echapper(email)}</b>.</p>`}`;
    const reponse = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cleResend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: expediteur, to: [email], subject: `${nomOffre} : paiement confirmé`, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!reponse.ok) throw new Error(`Resend → HTTP ${reponse.status} : ${(await reponse.text()).slice(0, 200)}`);
  };
}

module.exports = { creerEnvoyeurEmail };
