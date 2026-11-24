'use strict';

// Toutes les pages HTML du tunnel, à la direction artistique Overmaxx :
// noir et blanc, typographie grotesque très grasse, blocs « glitch », globe en pointillés.
// Les textes de la page d'accueil sont regroupés dans CONTENU pour être modifiés facilement.

const CONTENU = {
  accroche: 'Rejoins la communauté et paie en mobile money.',
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

// Icônes (SVG en trait, pas d'emoji).
const ICONE = {
  retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  fermer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mobile: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  echec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
};

const STYLE = `
  :root {
    --fond:#000; --surface:#0c0c0c; --surface-2:#151515; --bord:#242424; --bord-fort:#3a3a3a;
    --texte:#fff; --doux:#8c8c8c; --gris:#5a5a5a; --ok:#3ddc84; --erreur:#ff4d4d;
    --police:"Inter",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--fond); color:var(--texte); font:15px/1.55 var(--police); }
  main { max-width:460px; margin:0 auto; padding:24px 24px 56px; }
  a { color:var(--texte); }
  h1 { font-size:23px; line-height:1.15; letter-spacing:-0.02em; font-weight:800; margin:8px 0 10px; }
  h2 { font-size:15px; letter-spacing:-0.01em; font-weight:700; margin:0 0 8px; }
  p { margin:0 0 10px; }
  .doux { color:var(--doux); }
  .petit { font-size:13px; }
  .centre { text-align:center; }
  .etiquette { color:var(--doux); font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; }
  .carte { background:var(--surface); border:1px solid var(--bord); border-radius:20px; padding:20px 18px; margin-bottom:16px; }
  svg { width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }

  /* Logo OVERMAXX : dégradé gris → blanc + blocs blancs en différence (effet glitch). */
  .logo { position:relative; display:inline-block; isolation:isolate; font-weight:800; letter-spacing:-0.055em; line-height:1;
    background:linear-gradient(90deg,#7d7d7d 0%,#bdbdbd 22%,#fff 42%,#fff 62%,#a8a8a8 82%,#6f6f6f 100%);
    -webkit-background-clip:text; background-clip:text; color:transparent; padding:0 0.04em; }
  .logo i { position:absolute; background:#fff; mix-blend-mode:difference; pointer-events:none; }
  .logo i:nth-child(1) { left:-3%; top:52%; width:22%; height:46%; }
  .logo i:nth-child(2) { left:55%; top:-14%; width:19%; height:42%; }
  .logo i:nth-child(3) { left:84%; top:68%; width:19%; height:42%; }
  .logo.anime i { animation:glitch 4.5s steps(1) infinite; }
  .logo.anime i:nth-child(2) { animation-delay:-1.4s; }
  .logo.anime i:nth-child(3) { animation-delay:-2.9s; }
  @keyframes glitch { 0%,86%,100% { transform:none; } 88% { transform:translateX(-6px); } 91% { transform:translateX(5px) scaleY(.7); } 94% { transform:translateX(-2px); } }
  .entete { display:flex; justify-content:center; padding:4px 0 22px; }
  .entete .logo { font-size:22px; }

  /* Globe en pointillés derrière le logo de l'accueil. */
  .hero { position:relative; display:grid; place-items:center; height:210px; margin:0 0 10px; overflow:hidden; }
  .globe { position:absolute; width:190px; height:190px; border-radius:50%;
    background-image:radial-gradient(circle,#fff 1.1px,transparent 1.6px); background-size:7px 7px;
    -webkit-mask-image:radial-gradient(circle at 42% 38%,#000 0%,rgba(0,0,0,.55) 45%,transparent 71%);
            mask-image:radial-gradient(circle at 42% 38%,#000 0%,rgba(0,0,0,.55) 45%,transparent 71%);
    opacity:.4; animation:tourne-globe 40s linear infinite; }
  @keyframes tourne-globe { to { background-position:280px 0; } }
  .hero .logo { font-size:clamp(38px,11.5vw,56px); }

  /* Boutons : blanc sur noir, et contour pour le secondaire. */
  .bouton { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:50px; margin-top:16px; padding:13px 18px;
    border:1px solid #fff; border-radius:16px; background:#fff; color:#000; font:700 15px/1.2 var(--police); letter-spacing:-0.01em;
    text-decoration:none; cursor:pointer; transition:transform .12s ease, background .12s ease; }
  .bouton:active { transform:scale(.98); }
  .bouton.secondaire { background:transparent; color:#fff; border-color:var(--bord-fort); }
  .bouton:focus-visible, input:focus-visible, .onglets button:focus-visible, .rond:focus-visible { outline:2px solid #fff; outline-offset:2px; }

  /* Formulaires */
  label { display:block; font-weight:600; font-size:13px; margin:16px 0 6px; }
  input { width:100%; padding:13px 14px; border-radius:14px; border:1px solid var(--bord-fort); background:#000; color:#fff; font:16px var(--police); }
  input::placeholder { color:var(--gris); }
  input[readonly] { color:var(--doux); background:var(--surface-2); }
  .erreur-form { color:var(--erreur); font-size:14px; }
  .erreur-form a { color:var(--erreur); }

  /* Prix et listes */
  .prix { font-size:26px; font-weight:800; letter-spacing:-0.03em; line-height:1.05; }
  .prix small { font-size:13px; font-weight:500; color:var(--doux); letter-spacing:0; }
  .liste { list-style:none; padding:0; margin:0; }
  .liste li { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-top:1px solid var(--bord); }
  .liste li:first-child { border-top:0; padding-top:2px; }
  .liste svg { flex:none; width:18px; height:18px; margin-top:3px; }
  .numero { flex:none; display:grid; place-items:center; width:24px; height:24px; border-radius:50%; background:#fff; color:#000; font-weight:800; font-size:12px; }
  .etapes-guide li { padding:14px 0; }

  /* Page de statut (inspirée de MoonPay, en sombre) */
  .barre { display:grid; grid-template-columns:42px 1fr 42px; align-items:center; margin-bottom:26px; }
  .barre span { text-align:center; font-weight:700; font-size:16px; }
  .rond { display:grid; place-items:center; width:40px; height:40px; border-radius:50%; background:var(--surface-2); color:#fff; border:1px solid var(--bord); }
  .rond svg { width:18px; height:18px; }
  .icone-ronde { display:grid; place-items:center; width:68px; height:68px; margin:4px auto 16px; border-radius:50%; background:#fff; color:#000; }
  .icone-ronde svg { width:30px; height:30px; stroke-width:2.2; }
  .icone-ronde.echec { background:var(--erreur); color:#000; }
  .montant { text-align:center; font-size:26px; margin:0 0 4px; }
  .onglets { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:999px; background:var(--surface-2); margin-bottom:18px; }
  .onglets button { padding:9px; border:0; border-radius:999px; background:transparent; color:var(--doux); font:700 14px var(--police); cursor:pointer; }
  .onglets button[aria-selected="true"] { background:#fff; color:#000; }
  .frise { list-style:none; margin:0; padding:0 4px; }
  .frise li { position:relative; padding:0 0 20px 36px; }
  .frise li:last-child { padding-bottom:4px; }
  .frise li::before { content:""; position:absolute; left:11px; top:26px; bottom:2px; width:1px; background:var(--bord-fort); }
  .frise li:last-child::before { display:none; }
  .point { position:absolute; left:3px; top:2px; width:18px; height:18px; border-radius:50%; border:2px solid var(--bord-fort); background:var(--fond); }
  .frise li[data-etat="fait"] .point { border-color:var(--ok); background:var(--ok); }
  .frise li[data-etat="encours"] .point { border-color:var(--bord-fort); border-top-color:#fff; animation:tourne .8s linear infinite; }
  .frise li[data-etat="echec"] .point { border-color:var(--erreur); background:var(--erreur); }
  .frise .heure { color:var(--doux); font-size:12px; min-height:0; }
  .frise .titre { font-size:15px; font-weight:600; }
  .frise li[data-etat="attente"] .titre { color:var(--gris); }
  .frise li[data-etat="echec"] .titre { color:var(--erreur); }
  .frise .desc { color:var(--doux); font-size:13px; margin-top:3px; }
  .frise li[data-etat="attente"] .desc { display:none; }
  @keyframes tourne { to { transform:rotate(360deg); } }
  .details { margin:0; }
  .details { font-size:14px; }
  .details div { display:flex; justify-content:space-between; gap:16px; padding:11px 0; border-top:1px solid var(--bord); }
  .details div:first-child { border-top:0; padding-top:0; }
  .details dt { color:var(--doux); }
  .details dd { margin:0; text-align:right; font-weight:600; word-break:break-all; }

  /* Guide */
  .video { position:relative; aspect-ratio:16/9; border-radius:18px; overflow:hidden; background:var(--surface-2); border:1px solid var(--bord); margin:4px 0 16px; }
  .video iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .code { font:800 19px/1.2 ui-monospace,"SF Mono",Menlo,monospace; letter-spacing:2px; text-align:center; padding:14px; border-radius:14px;
    background:#000; border:1px dashed #fff; user-select:all; word-break:break-all; }

  [hidden] { display:none !important; }
  @media (prefers-reduced-motion: reduce) { .logo.anime i, .globe { animation:none; } .frise li[data-etat="encours"] .point { animation-duration:2.5s; } }
`;

function logo(classe = '') {
  return `<span class="logo ${classe}" aria-label="Overmaxx">OVERMAXX<i></i><i></i><i></i></span>`;
}

function gabarit(titre, contenu, { script, entete = true } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#000000">
<title>${echapper(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body><main>${entete ? `<header class="entete"><a href="/" style="text-decoration:none">${logo()}</a></header>` : ''}${contenu}</main>${script ? `<script>${script}</script>` : ''}</body>
</html>`;
}

function formatPrix(prix, devise) {
  const n = Number(prix);
  const txt = Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  const fcfa = ['XOF', 'XAF'].includes(String(devise).toUpperCase());
  const euros = fcfa ? ` <small>≈ ${Math.round(n / 655.957)} €</small>` : '';
  return { html: `${echapper(txt)} ${fcfa ? 'FCFA' : echapper(devise)}${euros}`, texte: `${txt} ${fcfa ? 'FCFA' : devise}` };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function blocSupport(config) {
  return config.contactSupport ? `<p class="doux petit centre">Un souci ? Contacte-nous : ${echapper(config.contactSupport)}</p>` : '';
}

// Étape 1 — page d'accueil
function pageAccueil(config, offre = config.offres.community) {
  const inscription = formatPrix(offre.prixEntree, config.devise);
  const renouv = formatPrix(offre.prixRenouvellement, config.devise);
  const periode = offre.dureeJours === 30 ? 'mois' : `${offre.dureeJours} jours`;
  return gabarit(offre.nom, `
  <div class="hero"><div class="globe"></div>${logo('anime')}</div>
  <p class="doux centre">${echapper(CONTENU.accroche)}</p>
  <div class="carte">
    <p class="etiquette">Inscription</p>
    <div class="prix">${inscription.html}</div>
    <p class="doux petit">${offre.dureeJours} premiers jours inclus</p>
    <p class="etiquette" style="margin-top:18px">Ensuite</p>
    <div class="prix" style="font-size:20px">${renouv.html.includes('<small>') ? renouv.html.replace('<small>', `<small>/ ${periode} · `) : `${renouv.html} <small>/ ${periode}</small>`}</div>
    <p class="doux petit">pour garder ton accès. Ton tarif est garanti tant que tu renouvelles avant la fin.</p>
  </div>
  <div class="carte">
    <h2>Ce que tu obtiens</h2>
    <ul class="liste">${CONTENU.avantages.map((a) => `<li>${ICONE.ok}<span>${echapper(a)}</span></li>`).join('')}</ul>
  </div>
  <a class="bouton" href="${offre.base}/paiement">${ICONE.mobile}Payer par mobile money</a>
  <p class="doux petit centre" style="margin-top:12px">Wave, Orange Money, MTN, Moov, via SasPay.</p>
  <p class="doux petit centre">Déjà membre ? <a href="${offre.base}/renouveler">Renouveler mon abonnement</a></p>`, { entete: false });
}

// Étape 2 — informations demandées par SasPay
function pageFormulaire(config, { offre = config.offres.community, type, erreur, valeurs = {}, emailVerrouille, action, montant, retour } = {}) {
  const renouv = type === 'renouvellement';
  const prix = formatPrix(montant || (renouv ? offre.prixRenouvellement : offre.prixEntree), config.devise);
  const cible = action || (renouv ? `${offre.base}/renouveler` : `${offre.base}/paiement`);
  return gabarit(renouv ? 'Renouveler mon abonnement' : 'Paiement', `
  <p class="etiquette">${renouv ? `Renouvellement · ${echapper(offre.nom)}` : `Étape 2 sur 4 · ${echapper(offre.nom)}`}</p>
  <h1>${renouv ? 'Renouveler mon abonnement' : 'Tes informations'}</h1>
  ${renouv ? `<p class="doux">${prix.texte} pour ${offre.dureeJours} jours d'accès en plus.</p>` : `
  <div class="carte">
    <h2>Avant de payer</h2>
    <ul class="liste">
      <li><span class="numero">1</span><span>Garde bien l'email que tu mets ici : tu le redonneras sur Whop pour débloquer ton accès.</span></li>
      <li><span class="numero">2</span><span>Si tu n'as pas encore de compte, crée-le sur <a href="https://whop.com" target="_blank" rel="noopener">whop.com</a>.</span></li>
    </ul>
  </div>`}
  <form class="carte" method="post" action="${echapper(cible)}">
    ${erreur ? `<p class="erreur-form">${erreur}</p>` : ''}
    ${emailVerrouille ? `<input type="hidden" name="m" value="${echapper(valeurs.m)}">` : ''}
    <label for="nom">Ton nom complet</label>
    <input id="nom" name="nom" required maxlength="100" autocomplete="name" value="${echapper(valeurs.nom)}">
    <label for="email">Ton email</label>
    <input id="email" name="email" type="email" required maxlength="200" autocomplete="email" value="${echapper(valeurs.email)}"${emailVerrouille ? ' readonly' : ''}>
    <label for="telephone">Numéro mobile money <span class="doux">(optionnel)</span></label>
    <input id="telephone" name="telephone" type="tel" maxlength="20" autocomplete="tel" placeholder="+228 90 00 00 00" value="${echapper(valeurs.telephone)}">
    <button class="bouton" type="submit">${ICONE.mobile}Payer ${prix.texte}</button>
    <p class="doux petit centre" style="margin:12px 0 0">Tu vas être redirigé vers la page de paiement sécurisée SasPay.</p>
  </form>
  ${retour ? `<a class="bouton secondaire" href="${echapper(retour)}">Retour</a>` : ''}`);
}

// Étape 3 — page de statut : vérifie le paiement puis redirige (onglets Statut / Détails).
function pageConfirmation(config, { ref, type, details }) {
  const renouv = type === 'renouvellement';
  const o = config.offres[(details && details.programme) || 'community'];
  const retour = renouv ? `${o.base}/renouveler` : o.id === 'community' ? `${o.base}/paiement` : o.base;
  const prix = details ? formatPrix(details.montant, details.devise).texte : '';
  const offre = renouv ? 'Renouvellement' : 'Inscription';
  const ligne = (t, v) => (v ? `<div><dt>${t}</dt><dd>${echapper(v)}</dd></div>` : '');
  const dateCreation = details ? new Date(details.creeLe).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '';

  const script = `
  (function () {
    var ref = ${JSON.stringify(ref)};
    var creeLe = ${JSON.stringify(details ? details.creeLe : null)};
    var essais = 0, max = 60, timer = null;
    var $ = function (id) { return document.getElementById(id); };
    var ICONES = ${JSON.stringify({ mobile: ICONE.mobile, ok: ICONE.ok, echec: ICONE.echec })};

    function heure(d) {
      var date = d ? new Date(d) : new Date();
      var h = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return (date.toDateString() === new Date().toDateString() ? "Aujourd'hui à " : date.toLocaleDateString('fr-FR') + ' à ') + h;
    }
    function etape(id, etat, titre, desc, quand) {
      var li = $(id); li.setAttribute('data-etat', etat);
      if (titre) li.querySelector('.titre').textContent = titre;
      if (desc !== undefined) li.querySelector('.desc').textContent = desc;
      li.querySelector('.heure').textContent = quand || '';
    }
    function entete(icone, classe, sousTitre) {
      $('icone').innerHTML = ICONES[icone]; $('icone').className = 'icone-ronde ' + (classe || '');
      $('sous-titre').textContent = sousTitre;
    }
    $('e1').querySelector('.heure').textContent = heure(creeLe);

    function confirme(d) {
      etape('e2', 'fait', 'Paiement confirmé', 'Ton opérateur a validé le paiement.', heure());
      etape('e3', 'fait', null, ${JSON.stringify(renouv ? 'Ton abonnement est prolongé.' : 'Ton accès est prêt.')}, heure());
      entete('ok', '', 'Paiement confirmé');
      $('pied').textContent = 'Redirection en cours…';
      setTimeout(function () { location.href = d.redirection; }, 2200);
    }
    function echec(raison) {
      etape('e2', 'echec', 'Paiement non confirmé', raison, heure());
      entete('echec', 'echec', 'Paiement non confirmé');
      $('actions-echec').hidden = false;
      $('pied').hidden = true;
    }
    function verifier() {
      essais++;
      fetch('/api/commandes/' + encodeURIComponent(ref), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.etat === 'confirme') confirme(d);
          else if (d.etat === 'echec' || d.etat === 'introuvable') {
            echec(d.reessayable
              ? "Le paiement n'est pas passé. Tu peux réessayer sur la page de paiement SasPay."
              : 'Le paiement a échoué, a été annulé ou a expiré.');
          } else if (essais >= max) {
            echec("Nous n'avons pas encore reçu la confirmation. Si tu as bien validé sur ton téléphone, clique sur « Revérifier ».");
          } else timer = setTimeout(verifier, 3000);
        })
        .catch(function () { timer = setTimeout(verifier, 5000); });
    }
    $('reverifier').addEventListener('click', function () {
      essais = 0; clearTimeout(timer);
      $('actions-echec').hidden = true; $('pied').hidden = false;
      etape('e2', 'encours', 'Vérification du paiement', 'On attend la validation de ton opérateur.');
      entete('mobile', '', 'Nous vérifions ton paiement.');
      verifier();
    });

    // Onglets Statut / Détails
    var onglets = document.querySelectorAll('.onglets button');
    onglets.forEach(function (b) {
      b.addEventListener('click', function () {
        onglets.forEach(function (x) {
          var actif = x === b;
          x.setAttribute('aria-selected', actif ? 'true' : 'false');
          $(x.getAttribute('aria-controls')).hidden = !actif;
        });
      });
    });
    verifier();
  })();`;

  return gabarit('Ta commande', `
  <nav class="barre">
    <a class="rond" href="${retour}" aria-label="Retour">${ICONE.retour}</a>
    <span>Ta commande</span>
    <a class="rond" href="${o.base}" aria-label="Fermer">${ICONE.fermer}</a>
  </nav>
  <div id="icone" class="icone-ronde">${ICONE.mobile}</div>
  <h1 class="montant">${echapper(prix)}</h1>
  <p id="sous-titre" class="doux centre">Nous vérifions ton paiement.</p>

  <div class="carte" style="margin-top:26px">
    <div class="onglets" role="tablist">
      <button type="button" role="tab" aria-selected="true" aria-controls="panneau-statut">Statut</button>
      <button type="button" role="tab" aria-selected="false" aria-controls="panneau-details">Détails</button>
    </div>
    <div id="panneau-statut" role="tabpanel">
      <ol class="frise">
        <li id="e1" data-etat="fait"><span class="point"></span><div class="heure"></div><div class="titre">Paiement lancé</div><div class="desc">${echapper(offre)} ${echapper(o.nom)}</div></li>
        <li id="e2" data-etat="encours"><span class="point"></span><div class="heure"></div><div class="titre">Vérification du paiement</div><div class="desc">On attend la validation de ton opérateur.</div></li>
        <li id="e3" data-etat="attente"><span class="point"></span><div class="heure"></div><div class="titre">${renouv ? 'Prolongation de ton accès' : 'Préparation de ton accès'}</div><div class="desc"></div></li>
      </ol>
      <div id="actions-echec" hidden>
        <button id="reverifier" class="bouton" type="button">Revérifier</button>
        <a class="bouton secondaire" href="${retour}">Recommencer le paiement</a>
        ${blocSupport(config)}
      </div>
    </div>
    <div id="panneau-details" role="tabpanel" hidden>
      <dl class="details">
        ${ligne('Offre', `${offre} ${o.nom}`)}
        ${ligne('Montant', prix)}
        ${details ? ligne('Nom', details.nom) : ''}
        ${details ? ligne('Email Whop', details.email) : ''}
        ${details ? ligne('Téléphone', details.telephone) : ''}
        ${ligne('Date', dateCreation)}
        ${ligne('Référence', ref.slice(0, 10).toUpperCase())}
      </dl>
    </div>
  </div>
  <p id="pied" class="doux petit centre">Garde cette page ouverte : tu seras redirigé automatiquement dès que le paiement est confirmé.</p>
  <noscript><p class="centre"><a href="/confirmation/${echapper(ref)}">Recharger la page</a></p></noscript>`, { script, entete: false });
}

// Étape 4 — guide d'accès (inscription) : vidéo Wistia + étapes écrites
function pageGuide(config, { offre, ref, membre, lienWhop, discordLie, erreurDiscord, lienDiscord, codeLiaison }) {
  const wistia = offre.wistiaGuide;
  const video = wistia
    ? `<div class="video"><iframe src="https://fast.wistia.net/embed/iframe/${echapper(wistia)}?videoFoam=true&playerColor=000000"
        title="Comment accéder à ${echapper(offre.nom)}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
    : '';
  const periode = offre.dureeJours === 30 ? 'par mois' : `tous les ${offre.dureeJours} jours`;
  const etapeDiscord = discordLie
    ? `<p class="ok" style="margin:0">Discord connecté${membre.discord_pseudo ? ` (${echapper(membre.discord_pseudo)})` : ''}. Tu es sur le serveur.</p>`
    : `<p class="doux">1. Rejoins le serveur${config.lienDiscord ? '' : ' Discord Overmaxx'} :</p>
       ${config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}">Rejoindre le serveur Discord</a>` : ''}
       ${codeLiaison ? `<p class="doux" style="margin-top:14px">2. Dans Discord, tape cette commande. Bob, notre bot, te donne ton rôle :</p>
       <div class="code" style="font-size:18px;letter-spacing:1px">/lier ${echapper(codeLiaison)}</div>` : ''}
       ${erreurDiscord ? `<p class="erreur-form">${echapper(erreurDiscord)}</p>` : ''}
       ${config.oauthActif ? `<p class="doux petit" style="margin:12px 0 0">Ou, depuis un ordinateur : <a href="${echapper(lienDiscord || `/discord/lier/${ref}`)}">connecter Discord sur le web</a>.</p>` : ''}`;
  return gabarit('Accéder à ton espace', `
  <p class="etiquette">Étape 4 sur 4 · ${echapper(offre.nom)}</p>
  <h1>Bienvenue dans ${echapper(offre.nom)}</h1>
  <p class="doux">Regarde la vidéo, puis suis les étapes ci-dessous.</p>
  ${video}
  <div class="carte">
    <ul class="liste etapes-guide">
      <li><span class="numero">1</span><div><h2>Connecte ton Discord</h2>${etapeDiscord}</div></li>
      <li><span class="numero">2</span><div><h2>Rejoins la formation sur Whop</h2>
        <p class="doux">Ouvre l'offre, puis clique pour la rejoindre. Whop te pose une question : réponds avec <b style="color:#fff">exactement cet email</b>.</p>
        <div class="code" style="font-size:16px;letter-spacing:0">${echapper(membre.email)}</div>
        <a class="bouton" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Ouvrir l'offre sur Whop</a></div></li>
      <li><span class="numero">3</span><div><h2>Validation automatique</h2>
        <p class="doux">Bob vérifie ta demande en quelques minutes : l'accès s'ouvre tout seul sur Whop. Utilise bien le même email, sinon la demande est refusée.</p></div></li>
      <li><span class="numero">4</span><div><h2>Ton abonnement</h2>
        <p class="doux">Ton accès est payé jusqu'au <b style="color:#fff">${echapper(formatDate(membre.acces_jusqu_au))}</b>. Bob te rappellera de renouveler (${formatPrix(membre.prix_renouvellement || offre.prixRenouvellement, config.devise).texte} ${periode}).</p>
        ${offre.id === 'elite' ? '<a class="bouton secondaire" href="/coaching">Réserver mes coachings</a>' : ''}</div></li>
    </ul>
  </div>
  ${blocSupport(config)}`);
}

// Fin du renouvellement
function pageRenouvele(config, { accesJusquAu, whopARejoindre, lienWhop, email }) {
  const whop = whopARejoindre && lienWhop ? `
    <div class="carte">
      <h2>Retrouve l'accès à la formation</h2>
      <p class="doux">Ton accès Whop avait été coupé pendant l'attente. Rejoins à nouveau l'offre et réponds avec <b style="color:#fff">exactement cet email</b> : Bob valide en quelques minutes.</p>
      <div class="code" style="font-size:16px;letter-spacing:0">${echapper(email)}</div>
      <a class="bouton" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Ouvrir l'offre sur Whop</a>
    </div>` : '';
  return gabarit('Abonnement renouvelé', `
  <div id="icone" class="icone-ronde" style="margin-top:20px">${ICONE.ok}</div>
  <h1 class="centre">Abonnement renouvelé</h1>
  <p class="doux centre">Ton paiement est passé.</p>
  <div class="carte" style="margin-top:20px">
    <p>Ton accès est prolongé jusqu'au <b>${echapper(formatDate(accesJusquAu))}</b>.</p>
    <p class="doux" style="margin:0">Tu peux retourner sur le Discord et profiter de tes avantages. Ton rôle revient dans les 2 minutes.</p>
    ${config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}">Retourner sur le Discord</a>` : ''}
  </div>
  ${whop}
  ${blocSupport(config)}`);
}

function pageMessage(config, titre, message, { lien = '/', texteLien = 'Retour' } = {}) {
  return gabarit(titre, `
  <h1>${echapper(titre)}</h1>
  <div class="carte"><p style="margin:0">${echapper(message)}</p></div>
  <a class="bouton" href="${echapper(lien)}">${echapper(texteLien)}</a>
  ${blocSupport(config)}`);
}

module.exports = {
  CONTENU, ICONE, echapper, gabarit, logo, formatPrix, formatDate, blocSupport,
  pageAccueil, pageFormulaire, pageConfirmation, pageGuide, pageRenouvele, pageMessage,
};
