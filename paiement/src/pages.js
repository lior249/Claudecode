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
  lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11l9-5.5z"/></svg>',
};

const STYLE = `
  :root {
    --fond:#000; --surface:#0c0c0c; --surface-2:#151515; --bord:#242424; --bord-fort:#3a3a3a;
    --texte:#fff; --doux:#8c8c8c; --gris:#5a5a5a; --ok:#3ddc84; --erreur:#ff4d4d;
    --police:"Inter",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;
  }
  * { box-sizing:border-box; }
  .retour { display:inline-flex; align-items:center; gap:6px; margin:0 0 14px; padding:8px 14px 8px 10px; border-radius:999px; background:var(--surface-2,#151515); border:1px solid var(--bord-fort,#3a3a3a); color:var(--texte,#fff); font-size:13.5px; font-weight:600; text-decoration:none; }
  .retour span { font-size:20px; line-height:1; margin-top:-2px; }
  .retour:active { transform:scale(.97); }
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
  /* Email à coller sur Whop, avec un bouton Copier. */
  .copie { display:flex; align-items:center; gap:8px; padding:8px 8px 8px 16px; border-radius:14px; background:var(--surface-2); border:1px solid var(--bord-fort); margin:10px 0 0; }
  .copie code { flex:1; min-width:0; font:700 15px/1.3 ui-monospace,"SF Mono",Menlo,monospace; color:#fff; overflow-wrap:anywhere; }
  .copie .bouton { width:auto; flex:none; min-height:40px; margin:0; padding:8px 16px; }
  .etapes-whop { margin:6px 0 0; padding-left:20px; color:var(--doux); }
  .etapes-whop li { margin:6px 0; }
  .etapes-whop b { color:#fff; }
  /* Emplacement réservé tant que la vidéo n'est pas réglée. */
  .video-vide { display:grid; place-items:center; border-style:dashed; border-color:var(--bord-fort); }
  .video-vide > div { display:grid; justify-items:center; gap:4px; padding:16px; text-align:center; }
  .video-vide svg { width:46px; height:46px; padding:12px 11px 12px 13px; border-radius:50%; background:#fff; margin-bottom:6px; }
  .video-vide svg path { fill:#000; stroke:none; }
  .video-vide span { font-weight:600; font-size:14px; }
  .video-vide small { color:var(--doux); font-size:12px; }
  /* Page d'accueil (même mise en forme que l'ancienne page Creato) : logo, vidéo, titre, bouton. */
  dialog.fenetre { background:#0d0d0d; color:#fff; border:1px solid var(--bord-fort); border-radius:22px; padding:22px 20px 20px;
    width:min(460px, calc(100% - 28px)); max-height:calc(100% - 40px); overflow:auto; text-align:left; }
  dialog.fenetre::backdrop { background:rgba(0,0,0,.78); }
  dialog.fenetre .fermer { position:absolute; top:12px; right:12px; width:38px; height:38px; border-radius:50%; border:1px solid var(--bord-fort);
    background:#161616; color:#fff; font:400 22px/1 var(--police); cursor:pointer; display:grid; place-items:center; padding:0; }
  dialog.fenetre h2 { margin:0 44px 8px 0; font-size:20px; letter-spacing:-0.02em; }
  dialog.fenetre .bouton { margin-top:14px; }
  /* Animations : fenêtres (apparition, contenu qui monte en fondu, sortie en fondu dézoomé), reflet des boutons, fondu entre pages. */
  @keyframes ovx-fenetre { from { opacity:0; transform:translateY(14px) scale(.98); } to { opacity:1; transform:none; } }
  @keyframes ovx-fenetre-sortie { from { opacity:1; transform:none; } to { opacity:0; transform:scale(.92); } }
  @keyframes ovx-monte { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  @keyframes ovx-voile { from { opacity:0; } to { opacity:1; } }
  @keyframes ovx-reflet { 0% { transform:translate(-120%, 120%) rotate(25deg); } 55%, 100% { transform:translate(220%, -220%) rotate(25deg); } }
  @keyframes ovx-page { from { opacity:0; } to { opacity:1; } }
  dialog.fenetre[open] { animation:ovx-fenetre .38s cubic-bezier(.2,.8,.2,1) both; }
  dialog.fenetre[open]::backdrop { animation:ovx-voile .3s ease-out both; }
  dialog.fenetre[open] > * { animation:ovx-monte .45s cubic-bezier(.2,.8,.2,1) both; }
  dialog.fenetre[open] > :nth-child(2) { animation-delay:.05s; } dialog.fenetre[open] > :nth-child(3) { animation-delay:.1s; }
  dialog.fenetre[open] > :nth-child(4) { animation-delay:.15s; } dialog.fenetre[open] > :nth-child(5) { animation-delay:.2s; }
  dialog.fenetre[open] > :nth-child(6) { animation-delay:.25s; } dialog.fenetre[open] > :nth-child(n+7) { animation-delay:.3s; }
  dialog.fenetre .fermer { z-index:5; } /* toujours cliquable, au-dessus du contenu animé */
  dialog.fenetre.sortie { animation:ovx-fenetre-sortie .2s ease-in both; } dialog.fenetre.sortie::backdrop { opacity:0; transition:opacity .2s; }
  dialog.fenetre .bouton, dialog.fenetre .a-faire-liste a { position:relative; overflow:hidden; }
  dialog.fenetre .bouton::before, dialog.fenetre .a-faire-liste a::before { content:""; position:absolute; left:0; bottom:0; width:40%; height:300%; pointer-events:none;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); animation:ovx-reflet 3.2s ease-in-out infinite; }
  dialog.fenetre .a-faire-liste a::before { background:linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent); }
  body { animation:ovx-page .32s ease-out both; }
  body.ovx-sortie { opacity:0; transition:opacity .15s ease-in; }
  @media (prefers-reduced-motion: reduce) { dialog.fenetre[open], dialog.fenetre[open] > *, dialog.fenetre.sortie, body, dialog.fenetre .bouton::before, dialog.fenetre .a-faire-liste a::before { animation:none !important; } }
  .tuto-bob ol { list-style:none; padding:0; margin:14px 0 0; display:grid; gap:20px; }
  .tuto-bob li { display:grid; gap:8px; }
  .tuto-bob li p { margin:0; }
  .tuto-bob img { width:100%; max-width:340px; justify-self:center; border-radius:14px; border:1px solid var(--bord); }
  .bienvenue { max-width:560px; margin:0 auto; text-align:center; }
  .bienvenue .hero { height:150px; margin:0 0 6px; }
  .bienvenue .video { margin:0 0 26px; border-radius:20px; box-shadow:0 30px 80px -30px rgba(255,255,255,.22); }
  .bienvenue h1 { font-size:clamp(26px,7.5vw,38px); line-height:1.08; letter-spacing:-0.04em; margin:0 0 10px; text-wrap:balance; }
  .bienvenue .bouton { min-height:56px; font-size:16px; border-radius:16px; }
  .code { font:800 19px/1.2 ui-monospace,"SF Mono",Menlo,monospace; letter-spacing:2px; text-align:center; padding:14px; border-radius:14px;
    background:#000; border:1px dashed #fff; user-select:all; word-break:break-all; }

  [hidden] { display:none !important; }
  @media (prefers-reduced-motion: reduce) { .logo.anime i, .globe { animation:none; } .frise li[data-etat="encours"] .point { animation-duration:2.5s; } }
`;

function logo(classe = '') {
  return `<span class="logo ${classe}" aria-label="Overmaxx">OVERMAXX<i></i><i></i><i></i></span>`;
}

// Fondu en sortie de page (lien interne) et fermeture des fenêtres en fondu dézoomé.
const SCRIPT_TRANSITIONS = `
(function () {
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('pageshow', function () { document.body.classList.remove('ovx-sortie'); });
  if (!calme) document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
    var u; try { u = new URL(a.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash) || a.getAttribute('href').charAt(0) === '#') return;
    e.preventDefault(); document.body.classList.add('ovx-sortie');
    setTimeout(function () { location.href = a.href; }, 140);
  });
  var P = window.HTMLDialogElement && HTMLDialogElement.prototype;
  if (P && !P.__ovx && !calme) {
    P.__ovx = 1; var fermer = P.close;
    P.close = function (v) {
      var d = this;
      if (!d.open || !d.classList.contains('fenetre') || d.classList.contains('sortie')) return fermer.call(d, v);
      d.classList.add('sortie');
      setTimeout(function () { d.classList.remove('sortie'); fermer.call(d, v); }, 190);
    };
  }
})();`;
function gabarit(titre, contenu, { script, entete = true, brut = false, jetonApp } = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#000000">
<link rel="manifest" href="/manifest.webmanifest${jetonApp ? `?u=${encodeURIComponent(jetonApp)}` : ''}">
<link rel="icon" type="image/png" sizes="192x192" href="/static/icones/globe-192.png">
<link rel="apple-touch-icon" href="/static/icones/globe-apple-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Overmaxx">
<title>${echapper(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body${brut ? ' class="espace-body"' : ''}>${brut ? contenu : `<main>${entete ? `<header class="entete"><a href="/" style="text-decoration:none">${logo()}</a></header>` : ''}${contenu}</main>`}${script ? `<script>${script}</script>` : ''}<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () {});${SCRIPT_NOTIF_APP}${SCRIPT_CELEBRATIONS}${SCRIPT_TRANSITIONS}</script></body>
</html>`;
}

// Trophées gagnés et « Garde ce qui marche » : une fenêtre façon pièce de récompense, à l'ouverture d'une page de l'élève.
const SCRIPT_CELEBRATIONS = `(function () {
  if (!/^\\/(profil|parcours|trophees|classement|communaute|revenus|fiche|coaching|remarques|notifications|reglages|app)(\\/|$)/.test(location.pathname)) return;
  var DISSUASION = 'Cette vidéo a été conçue pour être regardée encore et encore. D’ici 1 à 2 semaines, tu auras besoin de la revoir pour refaire un banger.\\n\\nVeux-tu quand même désactiver ce message ?';
  function poster(corps) { return fetch('/api/celebrations/vu', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(function () {}); }
  function style() {
    if (document.getElementById('ovx-cel-style')) return;
    var st = document.createElement('style'); st.id = 'ovx-cel-style';
    st.textContent = '.ovx-cel{position:fixed;inset:0;z-index:9998;width:100%;height:100%;max-width:none;max-height:none;margin:0;border:0;box-sizing:border-box;place-items:center;padding:20px;overflow:auto;background:rgba(0,0,0,.88);color:#fff;animation:ovxf .25s ease}.ovx-cel[open]{display:grid}.ovx-cel::backdrop{background:transparent}'
      + '.ovx-cel .boite{position:relative;width:min(380px,100%);text-align:center;color:#fff;font-family:Inter,system-ui,sans-serif}'
      + '.ovx-cel .rayons{position:absolute;left:50%;top:95px;width:360px;height:360px;margin:-180px 0 0 -180px;border-radius:50%;pointer-events:none;'
      + 'background:repeating-conic-gradient(from 0deg,rgba(255,214,90,.22) 0 10deg,transparent 10deg 24deg);-webkit-mask:radial-gradient(circle,#000 25%,transparent 70%);mask:radial-gradient(circle,#000 25%,transparent 70%);animation:ovxr 14s linear infinite}'
      + '.ovx-cel .piece{position:relative;display:inline-block;margin-top:20px;filter:drop-shadow(0 0 28px rgba(255,200,60,.45));animation:ovxp .7s cubic-bezier(.2,1.6,.4,1) both}'
      + '.ovx-cel .etiq{position:relative;margin:22px 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#f5c518;font-weight:800}'
      + '.ovx-cel h2{position:relative;margin:0;font-size:28px;letter-spacing:-.02em}.ovx-cel p{position:relative;margin:8px 0 0;color:#cfcfcf;font-size:15px;line-height:1.45}'
      + '.ovx-cel ul{position:relative;margin:12px 0 0;padding:0;list-style:none;text-align:left;display:grid;gap:8px}.ovx-cel li{padding:10px 12px;border-radius:12px;background:#151515;border:1px solid #2a2a2a;font-size:14px}'
      + '.ovx-cel .b{position:relative;display:block;width:100%;margin-top:18px;padding:14px;border:0;border-radius:14px;background:#c8f23a;color:#000;font:800 16px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none;box-sizing:border-box}'
      + '.ovx-cel .b2{background:#1b1b1b;color:#fff;border:1px solid #333;margin-top:10px}.ovx-cel .off{position:relative;margin-top:14px;background:none;border:0;color:#8c8c8c;font-size:13px;text-decoration:underline;cursor:pointer}'
      + '@keyframes ovxf{from{opacity:0}}@keyframes ovxr{to{transform:rotate(360deg)}}@keyframes ovxp{from{transform:scale(.2) rotate(-25deg);opacity:0}}'
      + '@media (prefers-reduced-motion:reduce){.ovx-cel .rayons,.ovx-cel .piece{animation:none}}';
    document.head.appendChild(st);
  }
  function fenetre(html, apres) {
    style();
    var d = document.createElement('dialog'); d.className = 'ovx-cel';
    d.innerHTML = '<div class="boite"><div class="rayons"></div>' + html + '</div>';
    document.body.appendChild(d);
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    d.addEventListener('cancel', function (e) { e.preventDefault(); });
    if (navigator.vibrate) navigator.vibrate([20, 30, 60]);
    function fermer() { if (d.open && d.close) d.close(); if (d.parentNode) d.parentNode.removeChild(d); if (apres) apres(); }
    return { el: d, fermer: fermer };
  }
  function txt(t) { var e = document.createElement('span'); e.textContent = t == null ? '' : String(t); return e.innerHTML.replace(/"/g, '&quot;'); }
  function suite(liste, i, banger) {
    if (i < liste.length) {
      var t = liste[i];
      var f = fenetre('<div class="piece">' + t.piece + '</div><p class="etiq">Nouveau trophée</p><h2>' + txt(t.titre) + '</h2><p>' + txt(t.label) + ' !</p>'
        + '<button class="b" type="button" data-ok>' + (i + 1 < liste.length || banger ? 'Continuer' : 'Génial') + '</button><a class="b b2" href="/trophees">Voir mes trophées</a>', function () { suite(liste, i + 1, banger); });
      poster({ trophees: [t.cle] });
      f.el.querySelector('[data-ok]').onclick = f.fermer;
      return;
    }
    if (!banger) return;
    var g = fenetre('<div class="piece">' + banger.piece + '</div><p class="etiq">Garde ce qui marche</p><h2>Cette vidéo est un banger</h2>'
      + '<ul>' + banger.raisons.map(function (r) { return '<li>' + txt(r) + '</li>'; }).join('') + '</ul>'
      + '<p>Regarde la leçon « Garde ce qui marche » pour refaire une vidéo comme celle-là.</p>'
      + (banger.lecon ? '<a class="b" href="' + txt(banger.lecon) + '" target="_blank" rel="noopener" data-ok>Regarder la leçon</a>' : '')
      + '<button class="b b2" type="button" data-ok>Compris</button><button class="off" type="button" data-off>Ne plus afficher ce message</button>');
    poster({ banger: true });
    g.el.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(g.fermer, 50); }); });
    g.el.querySelector('[data-off]').onclick = function () { if (confirm(DISSUASION)) { poster({ bangersOff: true }); g.fermer(); } };
  }
  // Après les autres fenêtres (ex. « Ce qu'il te reste à faire ») : on attend qu'elles soient fermées.
  function quandLibre(f) { if (document.querySelector('dialog[open]:not(.ovx-cel)')) setTimeout(function () { quandLibre(f); }, 600); else f(); }
  fetch('/api/celebrations', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
    if (x && ((x.trophees && x.trophees.length) || x.banger)) setTimeout(function () { quandLibre(function () { suite(x.trophees || [], 0, x.banger); }); }, 400);
  }).catch(function () {});
})();`;

// ---------- Espace de gestion : barre latérale (ordinateur) / menu repliable (téléphone) ----------
// À chaque ouverture : l'abonnement du téléphone est resynchronisé avec le site (un téléphone peut le changer seul),
// et une notification reçue pendant que l'application est ouverte s'affiche en bannière en haut de l'écran.
const SCRIPT_NOTIF_APP = `(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data || {}; if (d.type !== 'ovx-notification') return;
    var b = document.createElement('a'); b.className = 'ovx-banniere'; b.href = d.url || '/app';
    b.setAttribute('style', 'position:fixed;z-index:9999;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));display:block;padding:12px 14px;border-radius:16px;background:#1b1b1b;border:1px solid #333;color:#fff;text-decoration:none;box-shadow:0 12px 30px rgba(0,0,0,.6);font:14px/1.35 var(--police, system-ui);transition:transform .3s, opacity .3s;transform:translateY(-120%);opacity:0');
    var t = document.createElement('b'); t.textContent = d.titre || 'Overmaxx'; t.style.display = 'block';
    var c = document.createElement('span'); c.textContent = d.corps || ''; c.style.color = '#cfcfcf';
    b.appendChild(t); b.appendChild(c); document.body.appendChild(b);
    requestAnimationFrame(function () { b.style.transform = 'none'; b.style.opacity = '1'; });
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    setTimeout(function () { b.style.transform = 'translateY(-120%)'; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 400); }, 6000);
  });
  if (!('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return;
  fetch('/api/notifications/cle', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (k) {
    if (!k || !k.cle) return;
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        if (s) return s;
        var b = k.cle, p = '='.repeat((4 - b.length % 4) % 4), x = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(x.length);
        for (var i = 0; i < x.length; i++) a[i] = x.charCodeAt(i);
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: a });
      }).then(function (s) {
        if (!s || (k.connus || []).indexOf(s.endpoint) >= 0) return;
        var ios = /iPhone|iPad|iPod/.test(navigator.userAgent), app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
        return fetch('/api/notifications/abonnement', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abonnement: s.toJSON(), appareil: (/Android/.test(navigator.userAgent) ? 'Android' : ios ? 'iPhone' : 'Ordinateur') + ' · ' + (app ? 'application' : 'navigateur') + ' (resynchronisé)' }) });
      });
    });
  }).catch(function () {});
})();`;

const ICONES_NAV = {
  calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  candidatures: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M15 4v5h5M10 13h7M10 17h5"/></svg>',
  eleves: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>',
  membres: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/></svg>',
  coaching: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  parcours: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M6.2 16.3l4.6-8.6M13.2 7.7l4.6 8.6"/></svg>',
  annonces: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>',
  remarques: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h0a2 2 0 0 1-1.5-2z"/><path d="M8.5 9h7M8.5 12.2h4.5"/></svg>',
  communaute: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><circle cx="16.5" cy="10" r="2.6"/><path d="M3.5 19.5c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M14.5 15c2.6-.6 5 .9 6 4"/></svg>',
  profil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6"/></svg>',
  fiche: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.3c.6-1.7 1.8-2.6 3.2-2.6s2.6.9 3.2 2.6M14.5 10h3.5M14.5 13.5h3.5"/></svg>',
  traiter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5l2.4-7.2A2 2 0 0 1 8.3 5h7.4a2 2 0 0 1 1.9 1.3L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5l1.2 2h4.6l1.2-2H20"/></svg>',
  pages: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 8.5h17M7 12.5h6M7 16h9"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 3.5 5.6 3.5 8.5s-1 5.8-3.5 8.5c-2.5-2.7-3.5-5.6-3.5-8.5s1-5.8 3.5-8.5z"/></svg>',
  classement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>',
  notifications: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  sortie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>',
  ressources: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h5.5a2 2 0 0 1 2 2V20a1.8 1.8 0 0 0-1.8-1.8H5z"/><path d="M19 4.5h-5.5a2 2 0 0 0-1 .3M19 4.5v13.7h-5.7a1.8 1.8 0 0 0-1.8 1.8"/></svg>',
  gestion: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

const STYLE_ESPACE = `
  body.espace-body { background:var(--fond); }
  .espace { min-height:100vh; }
  main.espace-contenu { max-width:1120px; margin:0 auto; padding:20px 20px 56px; }
  /* Barre du bas (élèves, sur téléphone) : Classement, Remarques, Rappels, Profil. */
  .barre-bas { position:fixed; z-index:25; left:0; right:0; bottom:0; display:grid; grid-template-columns:repeat(4, 1fr); padding:8px 6px calc(8px + env(safe-area-inset-bottom));
    background:rgba(10,10,10,.94); border-top:1px solid #1d1d1d; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
  .barre-bas a { position:relative; display:flex; flex-direction:column; align-items:center; gap:3px; padding:4px 2px; color:#8a8a8a; text-decoration:none; font-size:11.5px; font-weight:600; }
  .barre-bas svg { width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
  .barre-bas a.actif { color:#c8f23a; } .barre-bas a.actif::before { content:""; position:absolute; top:-9px; width:34px; height:3px; border-radius:0 0 3px 3px; background:#c8f23a; }
  .avec-barre-bas main.espace-contenu { padding-bottom:110px; }
  .barre-bas .icone-bb { position:relative; display:inline-flex; }
  .barre-bas .compteur-bb { position:absolute; top:-8px; right:-15px; min-width:17px; height:17px; padding:0 4px; border-radius:9px; background:#ff3b30; color:#fff;
    font:800 10.5px/17px var(--police); text-align:center; border:2px solid #0a0a0a; box-sizing:content-box; }
  @media (min-width: 960px) { .barre-bas { display:none; } .avec-barre-bas main.espace-contenu { padding-bottom:64px; } }
  .sidebar { position:fixed; z-index:30; top:0; bottom:0; left:-290px; width:264px; display:flex; flex-direction:column; gap:6px;
    padding:18px 12px 14px; background:#0a0a0a; border-right:1px solid #1c1c1c; transition:left .22s ease; overflow-y:auto; }
  #menu-ouvert:checked ~ .sidebar { left:0; }
  .sb-voile { position:fixed; inset:0; z-index:20; background:rgba(0,0,0,.6); display:none; }
  #menu-ouvert:checked ~ .sb-voile { display:block; }
  .sb-logo { display:block; padding:4px 10px 18px; text-decoration:none; } .sb-logo .logo { font-size:21px; }
  .sb-section { color:var(--gris); font:600 11px var(--police); letter-spacing:.12em; text-transform:uppercase; margin:14px 12px 6px; }
  .sb-lien { display:flex; align-items:center; gap:11px; padding:9px 12px; border-radius:10px; color:#a3a3a3; text-decoration:none;
    font:500 14.5px var(--police); transition:background .12s, color .12s; }
  .sb-lien svg { width:19px; height:19px; flex:none; }
  .sb-lien:hover { background:#151515; color:#fff; }
  .sb-lien.actif { background:#1f1f1f; color:#fff; }
  .sb-badge { margin-left:auto; min-width:20px; padding:1px 7px; border-radius:999px; background:#ff8a00; color:#000; font:700 11.5px/18px var(--police); text-align:center; }
  .sb-pied { margin-top:auto; border-top:1px solid #1c1c1c; padding-top:12px; display:flex; flex-direction:column; gap:4px; }
  .sb-compte { display:flex; align-items:center; gap:10px; padding:6px 10px 10px; }
  .sb-avatar { display:grid; place-items:center; width:32px; height:32px; border-radius:50%; background:#fff; color:#000; font:800 14px var(--police); flex:none; }
  .sb-compte b { display:block; font-size:14px; line-height:1.2; } .sb-compte small { color:var(--doux); font-size:12px; }
  .topbar { position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:12px; padding:10px 16px; background:rgba(0,0,0,.92);
    border-bottom:1px solid #161616; backdrop-filter:blur(8px); }
  .topbar-menu { display:grid; place-items:center; width:38px; height:38px; border-radius:10px; border:1px solid var(--bord); cursor:pointer; }
  .topbar .logo { font-size:17px; }
  .topbar { padding:8px 16px 0; background:transparent; position:static; border:0 !important; backdrop-filter:none !important; }
  /* Bannière des événements (format 16:5) : couleur dominante à gauche sous le texte, image en fondu vers la droite. */
  .evts { position:relative; margin:0 0 16px; }
  .evts-piste { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; border-radius:18px; }
  .evts-piste::-webkit-scrollbar { display:none; }
  .evt { position:relative; flex:0 0 100%; scroll-snap-align:start; aspect-ratio:16 / 5; min-height:104px; overflow:hidden; border-radius:18px; background:var(--c, #1a1a1a); color:#fff; text-decoration:none; }
  .evt img { position:absolute; top:0; right:0; width:72%; height:100%; object-fit:cover;
    -webkit-mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.6) 25%, #000 55%); mask-image:linear-gradient(to right, transparent 0%, rgba(0,0,0,.6) 25%, #000 55%); }
  .evt.sans-image { background:linear-gradient(110deg, var(--c, #1a1a1a) 0%, color-mix(in srgb, var(--c, #1a1a1a) 55%, #000) 100%); }
  .evt-texte { position:absolute; inset:0 auto 0 0; width:58%; padding:10px 14px; display:flex; flex-direction:column; justify-content:center; gap:3px; z-index:1;
    background:linear-gradient(to right, var(--c, #1a1a1a) 55%, transparent); }
  .evt.sans-image .evt-texte { width:100%; background:none; }
  .evt-texte > * { flex:none; }
  .evt-texte b { font-size:clamp(14px, 4.2vw, 22px); line-height:1.2; letter-spacing:-0.02em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; padding-bottom:1px; }
  .evt-texte span { font-size:clamp(11px, 3vw, 14px); color:rgba(255,255,255,.82); line-height:1.3; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
  .evt.sans-image .evt-texte span { -webkit-line-clamp:2; }
  .evt-texte em { font-style:normal; align-self:flex-start; margin-top:4px; padding:4px 11px; border-radius:999px; background:rgba(255,255,255,.92); color:#000; font-size:11.5px; font-weight:700; }
  .evts-points { display:flex; justify-content:center; gap:5px; margin-top:7px; } .evts-points i { width:6px; height:6px; border-radius:50%; background:#3a3a3a; transition:width .2s; }
  .evts-points i.actif { width:16px; border-radius:3px; background:#fff; }
  .titre-page { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .titre-page h1 { margin:0; }
  @media (min-width: 960px) {
    .espace { display:grid; grid-template-columns:264px minmax(0, 1fr); }
    .sidebar { position:sticky; left:0; height:100vh; }
    .sb-voile, .topbar { display:none !important; }
    main.espace-contenu { padding:36px 44px 64px; }
    main.espace-contenu h1 { font-size:28px; }
  }
`;

// nav : [{ cle, libelle, lien, icone, badge }] ; actif : cle de la page ; compte : { pseudo, role }.
// Les événements en cours (bannière qui défile toute seule s'il y en a plusieurs).
function banniereEvenements(evts = []) {
  if (!evts.length) return '';
  const slide = (e) => {
    const balise = e.lien ? 'a' : 'div';
    const attrs = e.lien ? ` href="${echapper(e.lien)}"${e.lien.startsWith('/') ? '' : ' target="_blank" rel="noopener"'}` : '';
    return `<${balise} class="evt${e.image ? '' : ' sans-image'}" style="--c:${echapper(/^#[0-9a-f]{6}$/i.test(e.couleur || '') ? e.couleur : '#1a1a1a')}"${attrs}>
      ${e.image ? `<img src="/fichiers/images/${echapper(e.image)}" alt="">` : ''}
      <span class="evt-texte"><b>${echapper(e.titre)}</b>${e.texte ? `<span>${echapper(e.texte)}</span>` : ''}${e.lien ? '<em>Voir ›</em>' : ''}</span></${balise}>`;
  };
  return `<section class="evts" aria-label="Événements en cours"><div class="evts-piste">${evts.map(slide).join('')}</div>
    ${evts.length > 1 ? `<div class="evts-points" aria-hidden="true">${evts.map((e, i) => `<i${i ? '' : ' class="actif"'}></i>`).join('')}</div>
    <script>(function () { var c = document.querySelector('.evts-piste'), pts = document.querySelectorAll('.evts-points i'), n = c.children.length, touche = 0;
      function k() { return Math.round(c.scrollLeft / c.clientWidth); }
      c.addEventListener('scroll', function () { var i = k(); Array.prototype.forEach.call(pts, function (p, j) { p.className = j === i ? 'actif' : ''; }); }, { passive: true });
      ['touchstart', 'pointerdown', 'wheel'].forEach(function (e) { c.addEventListener(e, function () { touche = Date.now(); }, { passive: true }); });
      setInterval(function () { if (Date.now() - touche < 6000 || document.hidden) return; c.scrollTo({ left: ((k() + 1) % n) * c.clientWidth, behavior: 'smooth' }); }, 4000); })();</script>` : ''}</section>`;
}
function gabaritEspace(titre, contenu, { script, nav = [], actif, compte, jetonApp, barreBas, evenements = [], pastilleApp = null, sansHaut = false } = {}) {
  // Nombre sur l'icône de l'application (écran d'accueil) : notifications non lues + nouvelles remarques.
  const scriptPastille = pastilleApp === null ? '' : `;(function () { try { var n = ${Number(pastilleApp) || 0};
    if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(function () {}); else if (!n && navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); } catch (e) {} })();`;
  const liens = nav.map((n) => (n.section
    ? `<p class="sb-section">${echapper(n.section)}</p>`
    : `<a class="sb-lien${n.cle === actif ? ' actif' : ''}" href="${echapper(n.lien)}"${n.externe ? ' target="_blank" rel="noopener"' : ''}>${ICONES_NAV[n.icone] || ''}<span>${echapper(n.libelle)}</span>${n.badge ? `<span class="sb-badge">${echapper(n.badge)}</span>` : ''}</a>`)).join('');
  const initiale = compte && compte.pseudo ? compte.pseudo.trim().charAt(0).toUpperCase() : '?';
  return gabarit(titre, `<style>${STYLE_ESPACE}</style>
<div class="espace${barreBas ? ' avec-barre-bas' : ''}">
  <input type="checkbox" id="menu-ouvert" hidden>
  <aside class="sidebar" aria-label="Navigation">
    <a class="sb-logo" href="${echapper((nav.find((n) => n.lien) || {}).lien || '/')}">${logo()}</a>
    <nav>${liens}</nav>
    <div class="sb-pied">
      ${compte ? `<div class="sb-compte"><span class="sb-avatar">${echapper(initiale)}</span><div><b>${echapper(compte.pseudo)}</b><small>${echapper(compte.role || '')}</small></div></div>` : ''}
      <a class="sb-lien" href="/autre-compte" target="_blank" rel="noopener" title="Une 2e connexion dans ce navigateur, sans déconnecter celle-ci">${ICONES_NAV.membres}<span>Autre compte (2e session) ↗</span></a>
      <a class="sb-lien" href="/deconnexion">${ICONES_NAV.sortie}<span>Se déconnecter</span></a>
    </div>
  </aside>
  <label for="menu-ouvert" class="sb-voile" aria-hidden="true"></label>
  <div class="espace-corps">
    ${sansHaut ? '' : `<header class="topbar"><label for="menu-ouvert" class="topbar-menu" aria-label="Ouvrir le menu">${ICONES_NAV.menu}</label></header>`}
    <main class="espace-contenu">${banniereEvenements(evenements)}${contenu}</main>
  </div>
  ${barreBas ? `<nav class="barre-bas" aria-label="Navigation rapide" style="grid-template-columns:repeat(${barreBas.length}, 1fr)">${barreBas.map((n) => `<a href="${echapper(n.lien)}"${(n.actifs || [n.cle]).includes(actif) ? ' class="actif" aria-current="page"' : ''}${n.badge ? ` aria-label="${echapper(n.libelle)} : ${n.badge} nouveau(x)"` : ''}><span class="icone-bb">${ICONES_NAV[n.icone] || ''}${n.badge ? `<span class="compteur-bb">${n.badge > 9 ? '9+' : n.badge}</span>` : ''}</span><span>${echapper(n.libelle)}</span></a>`).join('')}</nav>` : ''}
</div>`, { script: `${script || ''}${scriptPastille}`, entete: false, brut: true, jetonApp });
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
// Vidéo Wistia, ou un emplacement réservé (même taille) tant que l'identifiant n'est pas réglé.
function blocVideo(wistiaId, titre) {
  if (wistiaId) {
    return `<div class="video"><iframe src="https://fast.wistia.net/embed/iframe/${echapper(wistiaId)}?videoFoam=true&playerColor=000000"
      title="${echapper(titre)}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
  }
  return `<div class="video video-vide" role="img" aria-label="${echapper(titre)} : vidéo bientôt disponible"><div>${ICONE.lecture}
    <span>${echapper(titre)}</span><small>Vidéo bientôt disponible</small></div></div>`;
}

// overmaxx.online : la seule page ouverte à tous. Son seul but : faire entrer sur le Discord (étape En Attente).
// Fenêtre « Autorise Bob à t'écrire » : le réglage Discord qui permet à Bob d'envoyer ses messages privés,
// en 4 captures annotées. Ouverte par tout bouton portant data-tuto-bob (ex. « Rejoindre le Discord »).
const ETAPES_TUTO_BOB = [
  ['bob-1.jpg', 'Ouvre Discord et touche <b>ton nom</b>, en bas de l\'écran.'],
  ['bob-2.jpg', 'Sur ton profil, touche <b>Paramètres</b> (Settings), en bas.'],
  ['bob-3.jpg', 'Touche <b>Contenu et social</b> (Content &amp; Social).'],
  ['bob-4.jpg', 'Active <b>Messages privés et demandes d\'ami</b> (Direct Messages and Friend Requests). C\'est ce réglage qui permet à Bob de t\'écrire.'],
];
function fenetreTutoBob(config, { rejoindre = true } = {}) {
  return `<dialog class="fenetre tuto-bob" id="tuto-bob" aria-labelledby="tuto-bob-titre">
    <button class="fermer" type="button" aria-label="Fermer" data-fermer>×</button>
    <h2 id="tuto-bob-titre">${rejoindre ? 'Avant de rejoindre le Discord' : 'Autorise Bob à t\'écrire'}</h2>
    <p class="doux" style="margin:0">Bob, notre bot, t'écrit en message privé : connexion au site, rappels, coachings.
      Vérifie ce réglage dans ton application Discord${rejoindre ? ', puis rejoins le serveur' : ''} : sinon, ses messages ne t'arrivent pas.</p>
    <ol>${ETAPES_TUTO_BOB.map(([img, t], i) => `<li><p><b>${i + 1}.</b> ${t}</p><img src="/static/aide/${img}" alt="Étape ${i + 1} dans Discord" loading="lazy"></li>`).join('')}</ol>
    <p class="doux petit" style="margin:16px 0 0">Les réglages des demandes d'ami ne changent rien pour Bob.</p>
    ${rejoindre && config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}">C'est fait, rejoindre le Discord</a>`
    : '<button class="bouton" type="button" data-fermer>C\'est fait</button>'}
  </dialog>
  <script>(function () {
    var d = document.getElementById('tuto-bob'); if (!d || !d.showModal) return;
    document.querySelectorAll('[data-tuto-bob]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); d.showModal(); }); });
    d.querySelectorAll('[data-fermer]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  })();</script>`;
}

// Page d'accueil : la vidéo, puis rejoindre le Discord ; « Déjà membre ? » se connecter (avec son compte Discord, via Bob).
// Déjà connecté : un bouton vers son espace (ou, s'il n'a pas encore de programme, les deux programmes).
function pageBienvenue(config, { pseudo, espace, appareil } = {}) {
  const changer = '<p class="doux petit" style="margin:16px 0 0"><a href="/deconnexion?autre=1">Ce n\'est pas toi ? Changer de compte</a></p>';
  // Appareil reconnu (déjà connecté ici) : « Me reconnecter », sans passer par Bob.
  const seConnecter = appareil ? `
    <p class="doux petit" style="margin:22px 0 0">Déjà membre ? Content de te revoir, <b>${echapper(appareil.prenom || appareil.pseudo)}</b>.</p>
    <form method="post" action="/connexion/appareil" style="margin:8px 0 0"><input type="hidden" name="retour" value="/app">
      <button class="bouton secondaire" type="submit" style="margin:0">Me reconnecter</button></form>
    <p class="doux petit" style="margin:12px 0 0"><a href="/connexion/oublier?retour=%2Fapp">Ce n'est pas toi ? Autre compte</a></p>` : `
    <p class="doux petit" style="margin:22px 0 0">Déjà membre ?</p>
    <a class="bouton secondaire" href="/connexion?retour=%2Fapp" style="margin-top:8px">Se connecter</a>`;
  // Visiteur : la vidéo, puis Rejoindre le Discord (bouton blanc) ; « Déjà membre ? » Se connecter (bouton transparent).
  const actions = !pseudo ? `
    <h1>Bienvenue sur Overmaxx</h1>
    <p class="doux">Rejoins le serveur Discord : Bob, notre bot, t'accueille et t'ouvre ton espace.</p>
    ${config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}" data-tuto-bob>Rejoindre le Discord</a>
    ${fenetreTutoBob(config)}` : ''}${seConnecter}`
    : espace ? `
    <h1>Bon retour, ${echapper(pseudo)}</h1>
    <p class="doux">Ton espace Overmaxx t'attend.</p>
    <a class="bouton" href="${echapper(espace)}">Ouvrir mon espace</a>${changer}`
      : `
    <h1>Bienvenue, ${echapper(pseudo)}</h1>
    <p class="doux">Choisis ton programme pour commencer.</p>
    <a class="bouton" href="${echapper(config.offres.community.base)}">Rejoindre la Community</a>
    <a class="bouton secondaire" href="${echapper(config.offres.elite.base)}">Postuler à l'Elite</a>${changer}`;
  return gabarit(config.nomFormation || 'Overmaxx', `
  <div class="bienvenue">
    <div class="hero"><div class="globe"></div>${logo('anime')}</div>
    ${blocVideo(config.wistiaAccueil, 'Présentation Overmaxx')}
    ${actions}
  </div>`, { entete: false });
}

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
function pageFormulaire(config, { offre = config.offres.community, type, erreur, valeurs = {}, emailVerrouille, action, montant, retour, lienCarte } = {}) {
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
  ${lienCarte ? `<a class="bouton secondaire" href="${echapper(lienCarte)}">Payer plutôt par carte bancaire</a>` : ''}
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

// Bouton « Copier » (avec secours pour les anciens téléphones).
const SCRIPT_COPIER = `
  function copierSecours(t) { var z = document.createElement('textarea'); z.value = t; z.setAttribute('readonly', ''); z.style.position = 'fixed'; z.style.opacity = '0';
    document.body.appendChild(z); z.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(z); }
  document.querySelectorAll('[data-copier]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copier');
      var fini = function () { b.textContent = 'Copié'; setTimeout(function () { b.textContent = 'Copier'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fini, function () { copierSecours(t); fini(); });
      else { copierSecours(t); fini(); }
    });
  });`;

// L'étape Whop, en une fois : copier l'email, ouvrir l'offre, coller l'email. La validation est automatique.
function blocWhop({ titre, intro, email, lienWhop }) {
  return `<div class="carte">
    <h2>${echapper(titre)}</h2>
    ${intro ? `<p class="doux">${intro}</p>` : ''}
    <ol class="etapes-whop">
      <li><b>Copie ton email</b> :</li>
    </ol>
    <div class="copie"><code>${echapper(email)}</code><button class="bouton" type="button" data-copier="${echapper(email)}">Copier</button></div>
    <ol class="etapes-whop" start="2">
      <li><b>Ouvre l'offre sur Whop</b>, connecte-toi (ou crée ton compte), puis demande l'accès.</li>
      <li>À la question de Whop, <b>colle cet email</b>.</li>
    </ol>
    <a class="bouton" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Ouvrir l'offre sur Whop</a>
    <p class="doux petit" style="margin:12px 0 0">Ton accès est validé automatiquement en moins d'une minute. Bob te prévient sur Discord.
      <a href="/acces/email-whop">J'ai donné un autre email à Whop</a></p>
  </div>`;
}

// Étape 4 — guide d'accès (inscription) : vidéo, puis une seule chose à faire (Whop) ; le reste est déjà fait.
function pageGuide(config, { offre, ref, membre, lienWhop, discordLie, erreurDiscord, lienDiscord, codeLiaison }) {
  const video = blocVideo(offre.wistiaGuide, `Comment accéder à ${offre.nom}`);
  const periode = offre.dureeJours === 30 ? 'par mois' : `tous les ${offre.dureeJours} jours`;
  const etapeDiscord = discordLie
    ? `<p class="ok" style="margin:0">Discord connecté${membre.discord_pseudo ? ` (${echapper(membre.discord_pseudo)})` : ''}. Tu es sur le serveur.</p>`
    : `<p class="doux">1. Rejoins le serveur${config.lienDiscord ? '' : ' Discord Overmaxx'} :</p>
       ${config.lienDiscord ? `<a class="bouton" href="${echapper(config.lienDiscord)}">Rejoindre le serveur Discord</a>` : ''}
       ${codeLiaison ? `<p class="doux" style="margin-top:14px">2. Dans Discord, tape cette commande. Bob, notre bot, te donne ton rôle :</p>
       <div class="code" style="font-size:18px;letter-spacing:1px">/lier ${echapper(codeLiaison)}</div>` : ''}
       ${erreurDiscord ? `<p class="erreur-form">${echapper(erreurDiscord)}</p>` : ''}
       ${config.oauthActif ? `<p class="doux petit" style="margin:12px 0 0">Ou, depuis un ordinateur : <a href="${echapper(lienDiscord || `/discord/lier/${ref}`)}">connecter Discord sur le web</a>.</p>` : ''}`;
  const whopFait = Boolean(membre.whop_membership_id);
  return gabarit('Accéder à ton espace', `
  <p class="etiquette">Étape 4 sur 4 · ${echapper(offre.nom)}</p>
  <h1>Bienvenue dans ${echapper(offre.nom)}</h1>
  <p class="doux">${whopFait ? 'Tout est prêt : ta formation t\'attend sur Whop.' : 'Regarde la vidéo, puis débloque ta formation sur Whop : c\'est la seule chose qu\'il te reste à faire.'}</p>
  ${video}
  ${whopFait ? `<a class="bouton" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Ouvrir la formation sur Whop</a>`
    : blocWhop({ titre: 'Débloque ta formation sur Whop', email: membre.email_whop || membre.email, lienWhop })}
  <div class="carte">
    <h2>Déjà fait</h2>
    <ul class="liste">
      <li>${ICONE.ok}<span>${offre.id === 'elite'
        ? `Paiement confirmé : ton accompagnement de 90 jours court jusqu'au <b style="color:#fff">${echapper(formatDate(membre.acces_jusqu_au))}</b>.`
        : `Paiement confirmé : accès jusqu'au <b style="color:#fff">${echapper(formatDate(membre.acces_jusqu_au))}</b>.
        Bob te rappellera de renouveler (${formatPrix(membre.prix_renouvellement || offre.prixRenouvellement, config.devise).texte} ${periode}).`}</span></li>
      ${discordLie ? `<li>${ICONE.ok}<span>Discord connecté${membre.discord_pseudo ? ` (${echapper(membre.discord_pseudo)})` : ''} : ton rôle est ajouté sur le serveur.</span></li>` : ''}
      ${whopFait ? `<li>${ICONE.ok}<span>Accès Whop validé.</span></li>` : ''}
    </ul>
    ${discordLie ? '' : `<h2 style="margin-top:14px">Connecte ton Discord</h2>${etapeDiscord}`}
    ${offre.id === 'elite' ? '<a class="bouton" href="/parcours">Commencer mon parcours</a>' : ''}
  </div>
  ${blocSupport(config)}`, { script: SCRIPT_COPIER });
}

// Fin du renouvellement
function pageRenouvele(config, { accesJusquAu, whopARejoindre, lienWhop, email }) {
  const whop = whopARejoindre && lienWhop
    ? blocWhop({ titre: 'Retrouve l\'accès à la formation', intro: 'Ton accès Whop avait été coupé pendant l\'attente : redemande-le.', email, lienWhop }) : '';
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
  ${blocSupport(config)}`, whop ? { script: SCRIPT_COPIER } : {});
}

// /acces/email-whop : le membre indique l'email qu'il a donné à Whop ; la synchro l'accepte avec celui-là.
function pageEmailWhop(config, { membres = [], erreur, valeur, fait } = {}) {
  if (fait) {
    return gabarit('Email Whop', `
    <div class="icone-ronde">${ICONE.ok}</div>
    <h1 class="centre">C'est noté</h1>
    <div class="carte"><p style="margin:0">Ta demande d'accès Whop faite avec <b>${echapper(fait)}</b> sera validée dans la minute.
      Bob te prévient sur Discord. Si tu n'as pas encore fait la demande sur Whop, fais-la avec cet email.</p></div>`);
  }
  if (!membres.length) {
    return gabarit('Email Whop', `
    <h1>Email Whop</h1>
    <div class="carte"><p style="margin:0">Aucun accès en attente de Whop n'est relié à ton compte Discord : soit ton accès Whop est déjà validé,
      soit ton paiement a été fait avec un autre compte Discord.</p></div>
    ${blocSupport(config)}`);
  }
  const payes = membres.map((m) => `<b>${echapper(m.email)}</b> (${echapper(config.offres[m.programme].nom)})`).join(', ');
  return gabarit('Email Whop', `
  <p class="etiquette">Accès à la formation</p>
  <h1>Quel email as-tu donné à Whop ?</h1>
  <p class="doux">Ton paiement est enregistré avec ${payes}. Si tu as répondu autre chose à la question de Whop, écris-le ici : on validera ta demande avec cet email.</p>
  <form class="carte" method="post" action="/acces/email-whop" novalidate>
    <label for="email"><b>L'email donné à Whop</b></label>
    <input id="email" name="email" type="email" value="${echapper(valeur || '')}" autocomplete="email" autocapitalize="none" maxlength="200" required style="margin-top:8px">
    ${erreur ? `<p class="erreur-form" style="margin:10px 0 0">${echapper(erreur)}</p>` : ''}
    <button class="bouton" type="submit">Valider cet email</button>
  </form>
  ${blocSupport(config)}`);
}

function pageMessage(config, titre, message, { lien = '/', texteLien = 'Retour' } = {}) {
  return gabarit(titre, `
  <h1>${echapper(titre)}</h1>
  <div class="carte"><p style="margin:0">${echapper(message)}</p></div>
  <a class="bouton" href="${echapper(lien)}">${echapper(texteLien)}</a>
  ${blocSupport(config)}`);
}

module.exports = { banniereEvenements,
  CONTENU, ICONE, echapper, gabarit, gabaritEspace, logo, formatPrix, formatDate, blocSupport, blocVideo,
  pageBienvenue, pageAccueil, fenetreTutoBob, pageEmailWhop, pageFormulaire, pageConfirmation, pageGuide, pageRenouvele, pageMessage,
};
