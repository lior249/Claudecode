'use strict';

// Toutes les pages HTML du tunnel. Les textes de la page d'accueil sont regroupés dans CONTENU
// pour que tu puisses les modifier facilement.

const CONTENU = {
  accroche: 'Rejoins l\'accompagnement et paie en mobile money.',
  avantages: [
    'La formation vidéo complète, hébergée sur Whop',
    'Le serveur Discord privé de la communauté',
    'Les coachings et le suivi',
  ],
};

function echapper(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function gabarit(titre, contenu, { script } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${echapper(titre)}</title>
<style>
  :root { --fond:#0e0f13; --carte:#181a21; --texte:#f2f3f5; --doux:#a3a7b3; --accent:#7c5cff; --ok:#2ecc71; --erreur:#ff5c5c; --bord:#2a2d38; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:480px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font-size:26px; line-height:1.2; margin:8px 0 12px; }
  h2 { font-size:18px; margin:0 0 10px; }
  .etape { color:var(--doux); font-size:13px; text-transform:uppercase; letter-spacing:1px; }
  .carte { background:var(--carte); border:1px solid var(--bord); border-radius:14px; padding:20px; margin-bottom:16px; }
  .liste { padding-left:20px; margin:0; } .liste li { margin-bottom:8px; }
  .coches { list-style:none; padding:0; margin:0; } .coches li { margin-bottom:8px; } .coches li::before { content:"✓ "; color:var(--ok); font-weight:700; }
  label { display:block; font-weight:600; margin:14px 0 6px; }
  input { width:100%; padding:12px; border-radius:10px; border:1px solid var(--bord); background:#0b0c10; color:var(--texte); font-size:16px; }
  input[readonly] { color:var(--doux); }
  button, .bouton { display:block; width:100%; text-align:center; margin-top:16px; padding:14px; border:0; border-radius:10px; background:var(--accent); color:#fff; font-size:17px; font-weight:700; text-decoration:none; cursor:pointer; font-family:inherit; }
  .bouton.secondaire { background:transparent; border:1px solid var(--bord); color:var(--texte); }
  .doux { color:var(--doux); font-size:14px; }
  .prix { font-size:30px; font-weight:800; line-height:1.1; }
  .prix small { font-size:15px; font-weight:500; color:var(--doux); }
  .code { font:700 24px/1.2 ui-monospace,Menlo,monospace; letter-spacing:2px; background:#0b0c10; border:1px dashed var(--accent); border-radius:10px; padding:14px; text-align:center; user-select:all; word-break:break-all; }
  .erreur { color:var(--erreur); } .ok { color:var(--ok); }
  a { color:var(--accent); }
  .centre { text-align:center; }
  .roue { width:64px; height:64px; margin:24px auto; border-radius:50%; border:6px solid var(--bord); border-top-color:var(--accent); animation:tourne 0.9s linear infinite; }
  .icone { font-size:56px; margin:16px 0 4px; }
  @keyframes tourne { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .roue { animation-duration:3s; } }
  [hidden] { display:none !important; }
</style>
</head>
<body><main>${contenu}</main>${script ? `<script>${script}</script>` : ''}</body>
</html>`;
}

function formatPrix(prix, devise) {
  const n = Number(prix);
  const txt = Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  const fcfa = ['XOF', 'XAF'].includes(String(devise).toUpperCase());
  const euros = fcfa ? ` <small>(≈ ${Math.round(n / 655.957)} €)</small>` : '';
  return { html: `${echapper(txt)} ${fcfa ? 'FCFA' : echapper(devise)}${euros}`, texte: `${txt} ${fcfa ? 'FCFA' : devise}` };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function blocSupport(config) {
  return config.contactSupport ? `<p class="doux centre">Un souci ? Contacte-nous : ${echapper(config.contactSupport)}</p>` : '';
}

// Étape 1 — page d'accueil
function pageAccueil(config) {
  const inscription = formatPrix(config.prixInscription, config.devise);
  const mensuel = formatPrix(config.prixMensuel, config.devise);
  return gabarit(config.nomFormation, `
  <h1>${echapper(config.nomFormation)}</h1>
  <p class="doux">${echapper(CONTENU.accroche)}</p>
  <div class="carte">
    <div class="prix">${inscription.html}</div>
    <p class="doux">pour rejoindre, ${config.dureeAccesJours} premiers jours inclus</p>
    <div class="prix" style="font-size:22px">puis ${mensuel.html} <small>/ mois</small></div>
    <p class="doux">pour garder ton accès. Sans engagement : tu renouvelles quand tu veux.</p>
  </div>
  <div class="carte">
    <h2>Ce que tu obtiens</h2>
    <ul class="coches">${CONTENU.avantages.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul>
  </div>
  <a class="bouton" href="/paiement">Payer par mobile money</a>
  <p class="doux centre">Wave, Orange Money, MTN, Moov… et carte bancaire, via SasPay.</p>
  <p class="doux centre">Déjà membre ? <a href="/renouveler">Renouveler mon abonnement</a></p>`);
}

// Étape 2 — informations demandées par SasPay
function pageFormulaire(config, { type, erreur, valeurs = {}, emailVerrouille } = {}) {
  const renouv = type === 'renouvellement';
  const prix = formatPrix(renouv ? config.prixMensuel : config.prixInscription, config.devise);
  const action = renouv ? '/renouveler' : '/paiement';
  return gabarit(renouv ? 'Renouveler mon abonnement' : 'Paiement', `
  <p class="etape">${renouv ? 'Renouvellement' : 'Étape 2 sur 4'}</p>
  <h1>${renouv ? 'Renouveler mon abonnement' : 'Tes informations'}</h1>
  ${renouv ? `<p class="doux">${prix.html} pour ${config.dureeAccesJours} jours d'accès en plus.</p>` : `
  <div class="carte">
    <b>Important</b>
    <ol class="liste">
      <li>Crée ton compte sur <a href="https://whop.com" target="_blank" rel="noopener">whop.com</a> si ce n'est pas déjà fait.</li>
      <li>Utilise ci-dessous <b>le même email que ton compte Whop</b>.</li>
    </ol>
  </div>`}
  <form class="carte" method="post" action="${action}">
    ${erreur ? `<p class="erreur">${erreur}</p>` : ''}
    ${emailVerrouille ? `<input type="hidden" name="m" value="${echapper(valeurs.m)}">` : ''}
    <label for="nom">Ton nom complet</label>
    <input id="nom" name="nom" required maxlength="100" autocomplete="name" value="${echapper(valeurs.nom)}">
    <label for="email">Email de ton compte Whop</label>
    <input id="email" name="email" type="email" required maxlength="200" autocomplete="email" value="${echapper(valeurs.email)}"${emailVerrouille ? ' readonly' : ''}>
    <label for="telephone">Numéro mobile money (optionnel)</label>
    <input id="telephone" name="telephone" type="tel" maxlength="20" autocomplete="tel" placeholder="+229 01 00 00 00 00" value="${echapper(valeurs.telephone)}">
    <button type="submit">Payer ${prix.texte}</button>
    <p class="doux centre">Tu vas être redirigé vers la page de paiement sécurisée SasPay.</p>
  </form>
  ${renouv ? '' : '<a class="bouton secondaire" href="/">Retour</a>'}`);
}

// Étape 3 — page de chargement : vérifie le paiement puis redirige.
function pageConfirmation(config, { ref, type }) {
  const retour = type === 'renouvellement' ? '/renouveler' : '/paiement';
  const script = `
  (function () {
    var ref = ${JSON.stringify(ref)};
    var essais = 0, max = 60, timer = null;
    function montrer(id) {
      ['chargement', 'confirme', 'echec'].forEach(function (x) { document.getElementById(x).hidden = x !== id; });
    }
    function verifier() {
      essais++;
      fetch('/api/commandes/' + encodeURIComponent(ref), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.etat === 'confirme') {
            montrer('confirme');
            setTimeout(function () { location.href = d.redirection; }, 2000);
          } else if (d.etat === 'echec' || d.etat === 'introuvable') {
            document.getElementById('raison').textContent = d.reessayable
              ? "Le paiement n'est pas passé. Tu peux réessayer sur la page de paiement SasPay."
              : "Le paiement a échoué, a été annulé ou a expiré.";
            montrer('echec');
          } else if (essais >= max) {
            document.getElementById('raison').textContent =
              "Nous n'avons pas encore reçu la confirmation. Si tu as bien validé sur ton téléphone, clique sur « Revérifier ».";
            montrer('echec');
          } else {
            timer = setTimeout(verifier, 3000);
          }
        })
        .catch(function () { timer = setTimeout(verifier, 5000); });
    }
    document.getElementById('reverifier').addEventListener('click', function () {
      essais = 0; montrer('chargement'); clearTimeout(timer); verifier();
    });
    verifier();
  })();`;
  return gabarit('Vérification du paiement', `
  <p class="etape centre">${type === 'renouvellement' ? 'Renouvellement' : 'Étape 3 sur 4'}</p>
  <section id="chargement" class="centre">
    <div class="roue" role="status" aria-label="Vérification en cours"></div>
    <h1>Vérification du paiement…</h1>
    <p class="doux">Si tu dois valider sur ton téléphone, fais-le maintenant. Ne ferme pas cette page.</p>
  </section>
  <section id="confirme" class="centre" hidden>
    <div class="icone">✅</div>
    <h1 class="ok">Paiement confirmé</h1>
    <p class="doux">Redirection en cours…</p>
  </section>
  <section id="echec" class="centre" hidden>
    <div class="icone">❌</div>
    <h1 class="erreur">Paiement non confirmé</h1>
    <p id="raison" class="doux"></p>
    <button id="reverifier" type="button">Revérifier</button>
    <a class="bouton secondaire" href="${retour}">Recommencer le paiement</a>
    ${blocSupport(config)}
  </section>
  <noscript><p class="centre"><a href="/confirmation/${echapper(ref)}">Recharger la page</a></p></noscript>`, { script });
}

// Étape 4 — tutoriel d'accès (inscription)
function pageTutoriel(config, { code, lien, accesJusquAu }) {
  return gabarit('Accéder à la formation', `
  <p class="etape">Étape 4 sur 4</p>
  <h1>Bienvenue ! Voici comment accéder à la formation</h1>
  <div class="carte">
    <h2>Ton code d'accès personnel</h2>
    <div class="code">${echapper(code)}</div>
    <p class="doux">Il ne marche qu'une seule fois. Garde-le pour toi.</p>
  </div>
  <div class="carte">
    <h2>1. Ouvre l'offre sur Whop</h2>
    <p>Clique sur le bouton ci-dessous et connecte-toi avec ton compte Whop (le même email que pour le paiement).</p>
    <a class="bouton" href="${echapper(lien)}" target="_blank" rel="noopener">Ouvrir l'offre sur Whop</a>
  </div>
  <div class="carte">
    <h2>2. Entre ton code promo</h2>
    <p>Au moment de valider, clique sur « code promo » et colle ton code. Le prix passe à <b>0</b> : tu ne paies rien de plus sur Whop.</p>
  </div>
  <div class="carte">
    <h2>3. Rejoins le Discord privé</h2>
    <p>Dans Whop, ouvre la formation puis clique sur <b>« Connecter Discord »</b>. Tu reçois automatiquement l'accès au serveur privé.</p>
  </div>
  <div class="carte">
    <h2>4. Ton abonnement</h2>
    <p>Ton accès est payé jusqu'au <b>${echapper(formatDate(accesJusquAu))}</b>. Avant cette date, le bot Discord te rappellera de renouveler (${formatPrix(config.prixMensuel, config.devise).html} / mois).</p>
  </div>
  ${config.email.cleResend ? '<p class="doux centre">Tu reçois aussi ton code par email.</p>' : ''}
  ${blocSupport(config)}`);
}

// Fin du renouvellement
function pageRenouvele(config, { accesJusquAu }) {
  return gabarit('Abonnement renouvelé', `
  <div class="centre">
    <div class="icone">🎉</div>
    <h1 class="ok">Abonnement renouvelé</h1>
  </div>
  <div class="carte">
    <p>Ton paiement est passé. Ton accès est prolongé jusqu'au <b>${echapper(formatDate(accesJusquAu))}</b>.</p>
    <p>Tu peux retourner sur le Discord et profiter de tes avantages.</p>
    ${config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}">Retourner sur le Discord</a>` : ''}
  </div>
  ${blocSupport(config)}`);
}

function pageMessage(config, titre, message, { lien = '/', texteLien = 'Retour' } = {}) {
  return gabarit(titre, `
  <h1>${echapper(titre)}</h1>
  <div class="carte"><p>${echapper(message)}</p></div>
  <a class="bouton" href="${echapper(lien)}">${echapper(texteLien)}</a>
  ${blocSupport(config)}`);
}

module.exports = {
  CONTENU, echapper, pageAccueil, pageFormulaire, pageConfirmation, pageTutoriel, pageRenouvele, pageMessage,
};
