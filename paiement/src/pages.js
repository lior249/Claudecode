'use strict';

function echapper(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function gabarit(titre, contenu, { rafraichir } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${rafraichir ? `<meta http-equiv="refresh" content="${Number(rafraichir)}">` : ''}
<title>${echapper(titre)}</title>
<style>
  :root { --fond:#0e0f13; --carte:#181a21; --texte:#f2f3f5; --doux:#a3a7b3; --accent:#7c5cff; --ok:#2ecc71; --erreur:#ff5c5c; --bord:#2a2d38; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:480px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-size:24px; margin:8px 0 16px; }
  .carte { background:var(--carte); border:1px solid var(--bord); border-radius:14px; padding:20px; margin-bottom:16px; }
  .etapes { padding-left:20px; margin:0; } .etapes li { margin-bottom:8px; }
  label { display:block; font-weight:600; margin:14px 0 6px; }
  input { width:100%; padding:12px; border-radius:10px; border:1px solid var(--bord); background:#0b0c10; color:var(--texte); font-size:16px; }
  button, .bouton { display:block; width:100%; text-align:center; margin-top:20px; padding:14px; border:0; border-radius:10px; background:var(--accent); color:#fff; font-size:17px; font-weight:700; text-decoration:none; cursor:pointer; }
  .doux { color:var(--doux); font-size:14px; }
  .prix { font-size:28px; font-weight:800; }
  .code { font:700 24px/1.2 ui-monospace,Menlo,monospace; letter-spacing:2px; background:#0b0c10; border:1px dashed var(--accent); border-radius:10px; padding:14px; text-align:center; user-select:all; word-break:break-all; }
  .erreur { color:var(--erreur); } .ok { color:var(--ok); }
  a { color:var(--accent); }
</style>
</head>
<body><main>${contenu}</main></body>
</html>`;
}

function formatPrix(prix, devise) {
  const n = Number(prix);
  const txt = Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  return `${txt} ${devise}`;
}

function pageAchat(config, { erreur, valeurs = {} } = {}) {
  return gabarit(`Acheter — ${config.nomFormation}`, `
  <h1>${echapper(config.nomFormation)}</h1>
  <div class="carte">
    <div class="prix">${echapper(formatPrix(config.prix, config.devise))}</div>
    <p class="doux">Paiement par mobile money ou carte via SasPay. Accès à la formation sur Whop et au Discord privé.</p>
  </div>
  <div class="carte">
    <b>Avant de payer</b>
    <ol class="etapes">
      <li>Crée ton compte sur <a href="https://whop.com" target="_blank" rel="noopener">whop.com</a> si ce n'est pas déjà fait.</li>
      <li>Entre ci-dessous <b>l'email de ton compte Whop</b>.</li>
    </ol>
  </div>
  <form class="carte" method="post" action="/acheter">
    ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ''}
    <label for="nom">Ton nom complet</label>
    <input id="nom" name="nom" required maxlength="100" autocomplete="name" value="${echapper(valeurs.nom)}">
    <label for="email">Email de ton compte Whop</label>
    <input id="email" name="email" type="email" required maxlength="200" autocomplete="email" value="${echapper(valeurs.email)}">
    <label for="telephone">Téléphone (optionnel)</label>
    <input id="telephone" name="telephone" type="tel" maxlength="20" autocomplete="tel" value="${echapper(valeurs.telephone)}">
    <button type="submit">Payer ${echapper(formatPrix(config.prix, config.devise))}</button>
  </form>`);
}

function pageAcces(config, { code, lien }) {
  return gabarit(`Ton accès — ${config.nomFormation}`, `
  <h1 class="ok">Paiement confirmé ✅</h1>
  <div class="carte">
    <p>Ton code d'accès (une seule utilisation) :</p>
    <div class="code">${echapper(code)}</div>
  </div>
  <div class="carte">
    <ol class="etapes">
      <li>Clique sur le bouton ci-dessous.</li>
      <li>Connecte-toi avec ton compte Whop.</li>
      <li>Entre le code promo ci-dessus : le prix passe à 0.</li>
      <li>Dans Whop, clique sur <b>« Connecter Discord »</b> pour rejoindre le serveur privé.</li>
    </ol>
    <a class="bouton" href="${echapper(lien)}" target="_blank" rel="noopener">Accéder à la formation sur Whop</a>
  </div>
  <p class="doux">Garde ce code pour toi : il ne marche qu'une fois.${config.email.cleResend ? ' Tu le reçois aussi par email.' : ''}</p>`);
}

function pageAttente(config) {
  return gabarit(`Paiement en cours — ${config.nomFormation}`, `
  <h1>Paiement en cours de confirmation…</h1>
  <div class="carte">
    <p>Si tu viens de valider le paiement sur ton téléphone, patiente quelques secondes. Cette page se recharge toute seule.</p>
  </div>`, { rafraichir: 5 });
}

function pageMessage(config, titre, message) {
  const support = config.contactSupport
    ? `<p class="doux">Un souci ? Contacte-nous : ${echapper(config.contactSupport)}</p>`
    : '';
  return gabarit(`${titre} — ${config.nomFormation}`, `
  <h1>${echapper(titre)}</h1>
  <div class="carte"><p>${echapper(message)}</p></div>
  ${support}
  <a class="bouton" href="/">Retour</a>`);
}

module.exports = { echapper, pageAchat, pageAcces, pageAttente, pageMessage };
