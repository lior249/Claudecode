'use strict';

const { echapper } = require('./pages');

// Envoi optionnel via Resend (https://resend.com). Sans RESEND_API_KEY, rien n'est envoyé :
// le client voit quand même son code sur la page « merci ».
function creerEnvoyeurEmail({ cleResend, expediteur }, fetchImpl = fetch) {
  if (!cleResend) return null;
  return async function envoyerAcces({ email, nom, code, lien, nomFormation }) {
    const html = `
      <p>Salut ${echapper(nom)},</p>
      <p>Ton paiement pour <b>${echapper(nomFormation)}</b> est confirmé. Voici ton accès :</p>
      <ol>
        <li>Ouvre ce lien : <a href="${echapper(lien)}">${echapper(lien)}</a></li>
        <li>Connecte-toi avec ton compte Whop (${echapper(email)}).</li>
        <li>Entre le code promo <b style="font-size:18px">${echapper(code)}</b> : le prix passe à 0.</li>
        <li>Dans Whop, clique sur « Connecter Discord » pour rejoindre le serveur privé.</li>
      </ol>
      <p>Ce code ne fonctionne qu'une seule fois. Ne le partage pas.</p>`;
    const reponse = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cleResend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: expediteur, to: [email], subject: `Ton accès à ${nomFormation}`, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!reponse.ok) throw new Error(`Resend → HTTP ${reponse.status} : ${(await reponse.text()).slice(0, 200)}`);
  };
}

module.exports = { creerEnvoyeurEmail };
