'use strict';

// Mon profil (page d'accueil des élèves Elite) : photo, 3 chiffres, la roue des jours (chaque jour : sa fiche,
// son résultat), la chaîne 🔥, ceux qu'il suit, la tâche du moment ; puis le tableau de bord des revenus.
// Et la page Communauté : suivis (10 places), concurrents (3), invitations, suggestions.
const { echapper } = require('./pages');
const { page, remarque, blocTableau, SCRIPT_TABLEAU, dollars, fenetreAFaire, frise } = require('./pages-parcours');
const { pastilleRole, STYLE_ROLES, nomRole } = require('./roles');
const { jourLisible } = require('./suivi');
const { vuesCourtes } = require('./pages-classement');

const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const ENCOURAGEMENTS = [
  'Une vidéo par jour : c\'est la régularité qui fait décoller un compte.',
  'Les meilleurs ne sont pas les plus doués : ce sont ceux qui ne s\'arrêtent pas.',
  'Chaque compte rendu t\'apprend ce qui marche. Continue.',
  'Une vidéo ratée vaut mieux qu\'une vidéo pas publiée.',
  'Regarde tes chiffres d\'hier, et fais mieux aujourd\'hui.',
  'Ton concurrent publie aujourd\'hui. Et toi ?',
  'Petit à petit : 1 000 $ commencent par le premier dollar.',
];

const FLAMME = (allumee) => `<svg class="flamme${allumee ? ' allumee' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 3.2-1.2 5-2.8 6.6C7.6 10.7 6 12.4 6 15a6 6 0 0 0 12 0c0-2.3-1-4-2.2-5.4-.3 1.5-1.1 2.6-2.3 3 .7-3.6-.2-7.4-1.5-10.1z"/><path class="coeur" d="M12 21a2.8 2.8 0 0 1-2.8-2.8c0-1.6 1.3-2.5 2.2-3.6.3 1 1 1.6 1.7 1.9.2-.6.3-1.2.2-1.9 1 1 1.5 2.2 1.5 3.6A2.8 2.8 0 0 1 12 21z"/></svg>`;
const ICONES = {
  cloche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  revenus: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.3c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2 0 2.7 5.8 1.4 5.8 4.2 0 1.2-1.3 2-3 2-1.3 0-2.4-.5-3-1.5M12 6.3v1.6M12 16.1v1.6"/></svg>',
  rang: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 2 3.3-.2.8 3.2 2.6 2-1.4 3 .5 3.3-3.1 1-1.7 2.9L12 19l-3.6 1.2-1.7-2.9-3.1-1 .5-3.3-1.4-3 2.6-2 .8-3.2 3.3.2z"/><path d="M9 12l2 2 4-4"/></svg>',
  jours: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4M8 14h3M8 17h6"/></svg>',
  bulle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a2 2 0 0 1-1.5-2z"/><path d="M8.5 9h7M8.5 12.2h4.5"/></svg>',
  reglages: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  fleche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

const STYLE_PROFIL = `<style>
  .pf { --lime:#c8f23a; --lime-fonce:#1d2408; max-width:560px; margin:0 auto; }
  .pf-haut { display:flex; align-items:center; justify-content:space-between; margin:2px 0 6px; }
  .pf-icone { position:relative; display:grid; place-items:center; width:40px; height:40px; border-radius:50%; color:#fff; }
  .pf-icone svg { width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .pf-icone .point { position:absolute; top:7px; right:8px; width:8px; height:8px; border-radius:50%; background:var(--lime); border:2px solid #000; }
  .pf-chaine { display:inline-flex; align-items:center; gap:6px; padding:7px 12px 7px 9px; border-radius:999px; background:#141414; border:1px solid #242424; font-weight:700; font-size:15px; text-decoration:none; color:#fff; }
  .flamme { width:20px; height:20px; fill:#3a3a3a; } .flamme .coeur { fill:#242424; }
  .flamme.allumee { fill:#ff7a1a; filter:drop-shadow(0 0 6px rgba(255,122,26,.55)); } .flamme.allumee .coeur { fill:#ffd23f; }
  .pf-identite { text-align:center; }
  .pf-avatar { width:92px; height:92px; margin:0 auto 10px; border-radius:50%; padding:5px; border:2px dashed var(--lime); }
  .pf-avatar img, .pf-avatar span { width:100%; height:100%; border-radius:50%; object-fit:cover; display:grid; place-items:center; background:#2a2a2a; font-size:32px; font-weight:800; }
  .pf-identite h1 { font-size:26px; margin:0; letter-spacing:-0.02em; }
  .pf-identite p { margin:2px 0 0; color:var(--doux); font-size:14px; }
  .pf-chiffres { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; margin:20px 0 18px; text-align:center; }
  .pf-chiffres .sep { width:1px; height:34px; background:#262626; }
  .pf-chiffres b { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:18px; white-space:nowrap; }
  .pf-chiffres b svg { width:22px; height:22px; fill:none; stroke:var(--lime); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; flex:none; }
  .pf-chiffres small { display:block; color:var(--doux); font-size:13px; margin-top:2px; }
  .pf-chiffres .role-d { font-size:12px; }
  /* La roue des jours : défile au doigt, le jour au centre grossit. */
  .roue-cadre { position:relative; margin:0 -16px; }
  .roue { display:flex; gap:8px; overflow-x:auto; scroll-snap-type:x mandatory; padding:10px calc(50% - 29px) 14px; scrollbar-width:none; -webkit-overflow-scrolling:touch; perspective:600px; }
  .roue::-webkit-scrollbar { display:none; }
  .roue-jour { flex:none; scroll-snap-align:center; width:58px; height:84px; border-radius:16px; background:#121212; border:1px solid #1f1f1f; color:#9a9a9a;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font:inherit; cursor:pointer; transition:background .2s, border-color .2s, color .2s; will-change:transform; }
  .roue-jour .pts { display:flex; gap:3px; height:6px; } .roue-jour .pts i { width:5px; height:5px; border-radius:50%; background:#555; }
  .roue-jour[data-e="valide"] .pts i { background:var(--lime); } .roue-jour[data-e="attente"] .pts i { background:#f5c542; }
  .roue-jour[data-e="corriger"] .pts i { background:#ff5c5c; } .roue-jour[data-e="publie"] .pts i { background:#fff; } .roue-jour[data-e="vide"] .pts i { background:transparent; }
  .roue-jour small { font-size:13px; } .roue-jour b { font-size:17px; color:#e8e8e8; font-weight:600; }
  .roue-jour.futur { opacity:.45; }
  .roue-jour.centre { border-color:var(--lime); background:#151a08; color:#fff; } .roue-jour.centre b { color:#fff; }
  .roue-jour.aujourdhui small { color:var(--lime); }
  .roue-retour { position:absolute; left:50%; bottom:-8px; transform:translateX(-50%); padding:6px 12px; border-radius:999px; border:1px solid #333; background:#1a1a1a; color:#fff; font:600 12.5px var(--police); cursor:pointer; }
  .roue-retour[hidden] { display:none; }
  .jour-panneau { margin:18px 0 14px; padding:16px; border-radius:20px; background:#101010; border:1px solid #1f1f1f; }
  .jour-panneau h2 { margin:0 0 4px; font-size:16px; } .jour-panneau p { margin:0; color:var(--doux); font-size:14px; }
  .jour-panneau .res { display:flex; gap:18px; margin:10px 0 4px; } .jour-panneau .res b { display:block; font-size:22px; } .jour-panneau .res small { color:var(--doux); font-size:12.5px; }
  .jour-panneau .bouton { margin-top:12px; }
  .rebours { display:inline-flex; align-items:center; gap:6px; margin:8px 0 6px !important; padding:6px 12px; border-radius:999px; background:#1b2208; border:1px solid #3d4f12; color:#dff58f !important; font-weight:700; font-size:14px !important; font-variant-numeric:tabular-nums; }
  .rebours[data-niveau="urgent"] { background:#2a1d05; border-color:#6b4a0e; color:#ffcf6b !important; }
  .rebours[data-niveau="retard"] { background:#2a0b0b; border-color:#7a1d1d; color:#ff8f8f !important; }
  .jour-panneau .encourage { margin-top:10px; font-size:13px; color:#cfe88a; }
  .pf-cartes { display:grid; grid-template-columns:minmax(0, .85fr) minmax(0, 1.15fr); gap:10px; margin-bottom:10px; }
  .pf-carte { position:relative; display:block; padding:14px; border-radius:20px; background:#141414; border:1px solid #1f1f1f; color:#fff; text-decoration:none; overflow:hidden; min-height:112px; }
  .pf-carte h3 { margin:0; font-size:16px; } .pf-carte p { margin:3px 0 0; font-size:12.5px; color:var(--doux); }
  .pf-carte .vert { color:var(--lime); font-weight:600; }
  .pf-suivis { text-align:center; }
  .pf-ronds { display:flex; justify-content:center; margin:2px 0 8px; } .pf-ronds span { width:38px; height:38px; margin-left:-10px; border-radius:50%; border:2px solid #141414; background:#2a2a2a; display:grid; place-items:center; font-weight:700; overflow:hidden; }
  .pf-ronds span:first-child { margin-left:0; } .pf-ronds img { width:100%; height:100%; object-fit:cover; }
  .pf-feu { background:radial-gradient(120% 120% at 100% 100%, #3a2205 0%, #141414 60%); }
  .pf-feu .grande { position:absolute; right:-6px; bottom:-10px; width:86px; height:86px; opacity:.95; }
  .pf-feu .grande.flamme { width:86px; height:86px; }
  .pf-feu .points { display:flex; gap:5px; margin-top:12px; } .pf-feu .points i { width:7px; height:7px; border-radius:50%; background:#333; } .pf-feu .points i.ok { background:#ff9a3c; }
  .pf-tache { display:flex; align-items:center; gap:14px; padding:14px; border-radius:20px; background:#141414; border:1px solid #1f1f1f; text-decoration:none; color:#fff; margin-bottom:22px; }
  .pf-tache .pastille { flex:none; width:64px; height:64px; border-radius:16px; background:var(--lime); color:#111; display:grid; place-items:center; }
  .pf-tache .pastille svg { width:30px; height:30px; fill:none; stroke:#111; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; }
  .pf-tache h3 { margin:0; font-size:16px; } .pf-tache p { margin:3px 0 0; font-size:13px; color:var(--doux); }
  .pf h2.section { font-size:15px; text-transform:uppercase; letter-spacing:.1em; color:var(--doux); margin:6px 0 10px; }
  .pf-groupe { display:flex; align-items:center; gap:6px; }
  .pf-avatar { display:block; text-decoration:none; color:#fff; }
  .pf-frise { display:block; text-decoration:none; color:inherit; margin:0 0 6px; } .pf-frise .etapes { margin-bottom:8px; }
  .pf-carrousel-cadre { padding:0; display:flex; flex-direction:column; }
  .pf-carrousel { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; flex:1; border-radius:20px; }
  .pf-carrousel::-webkit-scrollbar { display:none; }
  .pf-slide { position:relative; flex:0 0 100%; scroll-snap-align:start; padding:14px 14px 4px; color:#fff; text-decoration:none; overflow:hidden; min-height:96px; }
  .pf-slide h3 { margin:0; font-size:15.5px; } .pf-slide p { margin:4px 0 0; font-size:12.5px; color:var(--doux); }
  .pf-slide .gros { font-size:22px; color:#fff; } .pf-slide .lien { display:block; margin-top:8px; font-size:12.5px; color:var(--lime); font-weight:600; }
  .pf-slide.pf-feu { background:radial-gradient(120% 120% at 100% 100%, #3a2205 0%, transparent 60%); }
  .pf-slide.pf-feu { padding-right:58px; } .pf-slide.pf-feu .grande.flamme { width:54px; height:54px; right:4px; bottom:2px; }
  .pf-rang { background:radial-gradient(120% 120% at 100% 100%, #2a2508 0%, transparent 60%); }
  .pf-revenus, .pf-objectif { background:radial-gradient(120% 120% at 100% 100%, #13240a 0%, transparent 60%); }
  .pf-points { display:flex; justify-content:center; gap:5px; padding:6px 0 9px; } .pf-points i { width:6px; height:6px; border-radius:50%; background:#3a3a3a; transition:width .2s; }
  .pf-points i.actif { width:16px; border-radius:3px; background:var(--lime); }
  .cm-barre { height:6px; border-radius:999px; background:#222; margin-top:8px; overflow:hidden; } .cm-barre i { display:block; height:100%; background:#c8f23a; }
  .pf-seance { display:flex; justify-content:space-between; gap:10px; padding:9px 0; border-top:1px solid var(--bord); } .pf-seance:first-child { border-top:0; padding-top:0; }
  .pf-seance span { color:var(--doux); font-size:13px; }
  @media (prefers-reduced-motion: reduce) { .roue { scroll-behavior:auto; } }
</style>`;

// La roue : position de chaque jour, effet de roue (rotation, taille), vibration sur Android, « Aujourd'hui ».
const SCRIPT_ROUE = `(function () {
  var roue = document.querySelector('.roue'); if (!roue) return;
  var jours = Array.prototype.slice.call(roue.querySelectorAll('.roue-jour'));
  var panneaux = document.querySelectorAll('.jour-panneau');
  var retour = document.querySelector('.roue-retour');
  var auj = roue.querySelector('.aujourdhui') || jours[jours.length - 1];
  var courant = null, attente = false;
  function centrer(el, doux) { roue.scrollTo({ left: el.offsetLeft - (roue.clientWidth - el.offsetWidth) / 2, behavior: doux ? 'smooth' : 'auto' }); }
  function dessiner() {
    attente = false;
    var milieu = roue.scrollLeft + roue.clientWidth / 2, meilleur = null, dmin = 1e9;
    jours.forEach(function (el) {
      var c = el.offsetLeft + el.offsetWidth / 2, d = (c - milieu) / (el.offsetWidth + 8);
      var a = Math.min(Math.abs(d), 4);
      el.style.transform = 'rotateY(' + (-d * 14).toFixed(1) + 'deg) scale(' + (1.16 - a * 0.09).toFixed(3) + ')';
      if (Math.abs(d) < dmin) { dmin = Math.abs(d); meilleur = el; }
    });
    if (meilleur && meilleur !== courant) {
      if (courant) { courant.classList.remove('centre'); if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {} }
      courant = meilleur; courant.classList.add('centre');
      var j = courant.getAttribute('data-jour');
      Array.prototype.forEach.call(panneaux, function (p) { p.hidden = p.getAttribute('data-jour') !== j; });
      if (retour) retour.hidden = courant === auj;
    }
  }
  roue.addEventListener('scroll', function () { if (!attente) { attente = true; requestAnimationFrame(dessiner); } }, { passive: true });
  jours.forEach(function (el) { el.addEventListener('click', function () { centrer(el, true); }); });
  if (retour) retour.addEventListener('click', function () { centrer(auj, true); });
  window.addEventListener('resize', function () { requestAnimationFrame(dessiner); });
  centrer(auj, false); dessiner();
})();`;

const SCRIPT_CARROUSEL = `(function () {
  var c = document.querySelector('.pf-carrousel'); if (!c) return;
  var points = document.querySelectorAll('.pf-points i'), n = c.children.length, touche = 0;
  function index() { return Math.round(c.scrollLeft / c.clientWidth); }
  function marquer() { var k = index(); Array.prototype.forEach.call(points, function (p, i) { p.className = i === k ? 'actif' : ''; }); }
  c.addEventListener('scroll', function () { requestAnimationFrame(marquer); }, { passive: true });
  ['touchstart', 'pointerdown', 'wheel'].forEach(function (e) { c.addEventListener(e, function () { touche = Date.now(); }, { passive: true }); });
  if (n > 1 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    setInterval(function () { if (Date.now() - touche < 6000 || document.hidden) return; c.scrollTo({ left: ((index() + 1) % n) * c.clientWidth, behavior: 'smooth' }); }, 3000);
  }
})();`;
// Compte à rebours de la tâche du moment (chaque seconde) : jaune dans le dernier quart, rouge en retard.
const SCRIPT_REBOURS = `(function () {
  var els = document.querySelectorAll('.rebours[data-fin]'); if (!els.length) return;
  function deux(n) { return (n < 10 ? '0' : '') + n; }
  function maj() {
    Array.prototype.forEach.call(els, function (el) {
      var reste = new Date(el.getAttribute('data-fin')) - Date.now(), duree = +el.getAttribute('data-duree') || 0;
      var s = Math.floor(Math.abs(reste) / 1000), j = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      var t = (j ? j + ' j ' : '') + (j || h ? h + ' h ' : '') + deux(m) + ' min ' + deux(sec) + ' s';
      el.querySelector('span').textContent = reste >= 0 ? 'Il te reste ' + t : 'En retard de ' + t;
      el.setAttribute('data-niveau', reste < 0 ? 'retard' : duree && reste < duree / 4 ? 'urgent' : '');
    });
  }
  maj(); setInterval(maj, 1000);
})();`;
const SCRIPT_QUAND = `document.querySelectorAll('[data-quand]').forEach(function (el) {
  var d = new Date(el.getAttribute('data-quand')); if (isNaN(d)) return;
  var t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  el.textContent = t.charAt(0).toUpperCase() + t.slice(1);
});`;

const rond = (x) => `<span>${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>`;

function panneauJour(d, i, tache) {
  const encourage = `<p class="encourage">${echapper(ENCOURAGEMENTS[i % ENCOURAGEMENTS.length])}</p>`;
  const titre = d.aujourdhui ? 'Aujourd\'hui' : jourLisible(d.j);
  let corps;
  if (d.futur) corps = '<p>À venir : prépare ta vidéo.</p>';
  else if (d.aujourdhui && tache) {
    const ech = tache.delai || tache.echeance;
    corps = `<p><b style="color:#fff">${echapper(tache.titre)}</b></p>${ech && ech.fin ? `<p class="rebours" data-fin="${echapper(ech.fin)}" data-duree="${Number(ech.duree) || 0}">⏳ <span>…</span></p>` : ''}<p>${echapper(tache.texte || '')}</p>
      ${tache.lien ? `<a class="bouton" href="${echapper(tache.lien)}">${echapper(tache.bouton || 'Y aller')}</a>` : ''}`;
  } else if (d.e === 'valide' || d.e === 'attente' || d.e === 'corriger') {
    const etat = { valide: 'Compte rendu validé', attente: 'Compte rendu en attente de validation', corriger: 'Compte rendu à corriger' }[d.e];
    corps = `<p>${etat}</p><div class="res"><div><b>${d.g !== null ? dollars(d.g) : '—'}</b><small>Gagné ce jour-là</small></div>
      <div><b>${d.v !== null ? vuesCourtes(d.v) : '—'}</b><small>Vues du jour</small></div><div><b>${d.n}</b><small>Vidéo${d.n > 1 ? 's' : ''}</small></div></div>
      ${d.e === 'corriger' ? `<a class="bouton" href="/parcours/compte-rendu/${d.j}">Corriger mon compte rendu</a>` : ''}`;
  } else if (d.e === 'publie') {
    corps = `<p>${d.n} vidéo${d.n > 1 ? 's' : ''} publiée${d.n > 1 ? 's' : ''}, compte rendu pas encore envoyé.</p><a class="bouton" href="/parcours/compte-rendu/${d.j}">Faire mon compte rendu</a>`;
  } else corps = '<p>Aucune vidéo ce jour-là.</p>';
  return `<section class="jour-panneau" data-jour="${d.j}"${d.aujourdhui ? '' : ' hidden'}><h2>${echapper(titre)}</h2>${corps}${d.futur ? '' : encourage}</section>`;
}

function pageMonProfil(config, { espace, parcours: p, prenom, avatar, stats, role, jourDepuis, jours, chaine, flamme, derniers7, tache, suivis, nbSuivis, nbConcurrents, invitations, notifications, rappel,
  rang, totalClasses, revenusMois, objectif, seances = [], remarquesNouvelles = 0 }) {
  const nom = prenom || p.pseudo || 'Membre';
  const roue = jours.map((d) => `<button type="button" class="roue-jour${d.aujourdhui ? ' aujourdhui' : ''}${d.futur ? ' futur' : ''}" data-jour="${d.j}" data-e="${d.e}" aria-label="${echapper(jourLisible(d.j))}">
      <span class="pts"><i></i></span><small>${JOURS_COURTS[new Date(`${d.j}T12:00:00Z`).getUTCDay()]}</small><b>${Number(d.j.slice(8))}</b></button>`).join('');
  // Le carrousel : chaîne, classement, revenus du mois, prochain objectif (défile tout seul toutes les 3 secondes).
  const slides = [
    `<a class="pf-slide pf-feu" href="/parcours/etape-4"><h3>${flamme ? 'Ne casse pas ta chaîne !' : chaine ? 'Ta chaîne démarre' : 'Allume ta flamme'}</h3>
      <p>${flamme ? `${chaine} jours d'affilée avec un compte rendu.` : `Envoie ton compte rendu 3 jours d'affilée${chaine ? ` (${chaine} / 3)` : ''}.`}</p>
      <div class="points">${derniers7.map((x) => `<i${x ? ' class="ok"' : ''}></i>`).join('')}</div>${FLAMME(flamme).replace('class="flamme', 'class="grande flamme')}</a>`,
    `<a class="pf-slide pf-rang" href="/classement"><h3>Classement</h3><p>${rang ? `Tu es <b class="gros">${rang}<sup>e</sup></b> sur ${totalClasses}` : 'Envoie tes premiers résultats pour entrer au classement.'}</p><span class="lien">Voir le classement ›</span></a>`,
    `<a class="pf-slide pf-revenus" href="/revenus"><h3>Mes revenus</h3><p><b class="gros">${dollars(revenusMois || 0)}</b> ce mois-ci</p><span class="lien">Mon tableau de bord ›</span></a>`,
    objectif ? `<a class="pf-slide pf-objectif" href="/revenus"><h3>Prochain objectif : ${dollars(objectif.montant, { centimes: false })}</h3><p>Encore ${dollars(Math.max(0, objectif.montant - (stats.revenusTotal || 0)))} à gagner.</p>
      <div class="cm-barre"><i style="width:${Math.min(100, Math.round(((stats.revenusTotal || 0) / objectif.montant) * 100))}%"></i></div></a>` : '',
  ].filter(Boolean);
  return page('Mon profil', `${STYLE_PROFIL}${STYLE_ROLES}
  ${fenetreAFaire(rappel)}
  <div class="pf">
    <div class="pf-haut">
      <div class="pf-groupe">
        <a class="pf-icone" href="/notifications" aria-label="Notifications et rappels">${ICONES.cloche}${notifications ? '<span class="point"></span>' : ''}</a>
        <a class="pf-icone" href="/remarques" aria-label="Remarques du coach">${ICONES.bulle}${remarquesNouvelles ? '<span class="point"></span>' : ''}</a>
      </div>
      <div class="pf-groupe">
        <a class="pf-chaine" href="/parcours/etape-4" aria-label="Chaîne de ${chaine} jours">${FLAMME(flamme)}${chaine}</a>
        <a class="pf-icone" href="/reglages" aria-label="Réglages">${ICONES.reglages}</a>
      </div>
    </div>
    <div class="pf-identite">
      <a class="pf-avatar" href="/fiche" aria-label="Ma fiche">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</a>
      <h1>${echapper(nom)}</h1><p>@${echapper(p.pseudo || '')}</p>
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.revenus}${dollars(stats.revenusTotal || 0, { centimes: false })}</b><small>Revenus</small></div><span class="sep"></span>
      <div><b>${pastilleRole(role)}</b><small>Rang</small></div><span class="sep"></span>
      <div><b>${ICONES.jours}${jourDepuis}</b><small>Jours</small></div>
    </div>
    <a class="pf-frise" href="/parcours" aria-label="Mon parcours">${frise(Math.min(p.etape, 5))}</a>
    <div class="roue-cadre"><div class="roue" role="listbox" aria-label="Jours">${roue}</div><button type="button" class="roue-retour" hidden>Revenir à aujourd'hui</button></div>
    ${jours.map((d, i) => panneauJour(d, i, tache)).join('')}
    <div class="pf-cartes">
      <a class="pf-carte pf-suivis" href="/communaute">
        <div class="pf-ronds">${suivis.slice(0, 3).map(rond).join('') || '<span>+</span>'}</div>
        <h3>Je suis</h3><p class="vert">${nbSuivis} / 10${nbConcurrents ? ` · ${nbConcurrents} concurrent${nbConcurrents > 1 ? 's' : ''}` : ''}</p>
        ${invitations ? `<p>${invitations} invitation${invitations > 1 ? 's' : ''} à défier</p>` : ''}
      </a>
      <div class="pf-carte pf-carrousel-cadre">
        <div class="pf-carrousel" aria-roledescription="carrousel">${slides.join('')}</div>
        <div class="pf-points" aria-hidden="true">${slides.map((x, i) => `<i${i ? '' : ' class="actif"'}></i>`).join('')}</div>
      </div>
    </div>
    <a class="bouton secondaire" href="/parcours" style="margin:4px 0 18px">Mon parcours</a>
    ${seances.length ? `<h2 class="section">Mes prochains coachings</h2><div class="carte">${seances.slice(0, 3).map((x) => `<div class="pf-seance"><b data-quand="${echapper(x.debut)}">${echapper(x.date)} à ${echapper(x.heure)} GMT</b><span>${echapper(x.type)}</span></div>`).join('')}
      <a class="bouton secondaire" href="/coaching" style="margin-top:10px">Mes coachings</a></div>` : ''}
  </div>`, espace, 'profil', null, `${SCRIPT_ROUE}${SCRIPT_CARROUSEL}${SCRIPT_QUAND}${SCRIPT_REBOURS}`);
}

// Revenus : le tableau de bord TikTok (ouvert depuis le carrousel de Mon profil).
function pageRevenus(config, { espace, tableau, stats }) {
  return page('Mes revenus', `<a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Mon profil</p><h1>Mes revenus</h1></div><span class="doux petit">Total validé : ${dollars((stats || {}).revenusTotal || 0)}</span></div>
  ${blocTableau(tableau)}`, espace, 'profil', null, SCRIPT_TABLEAU);
}

// Réglages : prénom et pays, lien du compte TikTok, notifications, compte.
function pageReglages(config, { espace, prenom, pays, compteTikTok, parcours: aUnParcours, message, erreur }) {
  return page('Réglages', `<a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Mon compte</p><h1>Réglages</h1></div></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div style="display:grid;gap:4px;max-width:620px">
    <form class="carte" method="post" action="/reglages/profil" style="display:grid;gap:12px">
      <h2 style="margin:0">Mon profil</h2>
      <div class="champ"><label for="prenom">Prénom (affiché au classement)</label><input id="prenom" name="prenom" maxlength="40" value="${echapper(prenom || '')}"></div>
      <div class="champ"><label for="pays">Pays</label><input id="pays" name="pays" maxlength="60" value="${echapper(pays || '')}"></div>
      <button class="bouton" type="submit" style="margin:0">Enregistrer</button>
    </form>
    ${aUnParcours ? `<form class="carte" method="post" action="/reglages/tiktok" style="display:grid;gap:12px">
      <h2 style="margin:0">Mon compte TikTok</h2>
      <div class="champ"><label for="compte">Lien de mon compte</label><input id="compte" name="compte" inputmode="url" value="${echapper(compteTikTok || '')}" placeholder="https://www.tiktok.com/@ton.compte">
        <small>Sur TikTok : ton profil › Partager le profil › Copier le lien.</small></div>
      <button class="bouton" type="submit" style="margin:0">Enregistrer</button>
    </form>` : ''}
    <div class="carte"><h2 style="margin:0 0 6px">Notifications et application</h2><p class="doux petit" style="margin:0 0 4px">Bob ou l'application, tes appareils, installer l'application.</p>
      <a class="bouton secondaire" href="/notifications">Régler mes notifications</a></div>
    <div class="carte"><h2 style="margin:0 0 6px">Coachings</h2><p class="doux petit" style="margin:0 0 4px">Tes créneaux et ton rappel avant chaque séance.</p>
      <a class="bouton secondaire" href="/coaching">Mes coachings</a></div>
    <div class="carte"><h2 style="margin:0 0 10px">Mon compte</h2>
      <a class="bouton secondaire" href="/deconnexion" style="margin:0">Se déconnecter</a>
      <a class="bouton secondaire" href="/deconnexion?autre=1">Changer de compte</a></div>
  </div>`, espace, 'profil');
}

// ---------- Communauté : je suis, mes concurrents, invitations, suggestions ----------
const STYLE_COMMU = `<style>
  .cm-liste { display:grid; gap:8px; }
  .cm-ligne { display:flex; align-items:center; gap:12px; padding:12px; border-radius:16px; background:var(--surface); border:1px solid var(--bord); }
  .cm-ligne .rond { width:42px; height:42px; border-radius:50%; background:#2a2a2a; display:grid; place-items:center; font-weight:700; overflow:hidden; flex:none; }
  .cm-ligne .rond img { width:100%; height:100%; object-fit:cover; }
  .cm-ligne .qui { flex:1; min-width:0; } .cm-ligne .qui b { display:block; overflow-wrap:anywhere; } .cm-ligne .qui small { color:var(--doux); font-size:12.5px; }
  .cm-ligne form { margin:0; display:flex; gap:6px; } .cm-ligne .bouton { margin:0; min-height:36px; padding:6px 14px; font-size:13px; width:auto; }
  .cm-barre { height:6px; border-radius:999px; background:#222; margin-top:6px; overflow:hidden; } .cm-barre i { display:block; height:100%; background:#c8f23a; }
  .cm-tuiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(98px, 1fr)); gap:8px; }
  .cm-tuile { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:8px; border-radius:18px; background:var(--surface); border:1px solid var(--bord); color:#fff; text-decoration:none; text-align:center; min-width:0; }
  .cm-tuile .rond { width:44px; height:44px; border-radius:50%; background:#2a2a2a; display:grid; place-items:center; font-weight:700; overflow:hidden; } .cm-tuile .rond img { width:100%; height:100%; object-fit:cover; }
  .cm-tuile b { font-size:13px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .cm-tuile small { font-size:11px; color:var(--doux); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cm-tuile .cm-barre { width:80%; margin-top:2px; }
  .cm-tuile.vide { border-style:dashed; color:var(--doux); } .cm-tuile.vide .rond { background:transparent; border:1px dashed #444; font-size:20px; }
  .cm-fil { display:grid; gap:6px; max-height:420px; overflow:auto; }
  .cm-nouvelle { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:14px; background:var(--surface); border:1px solid var(--bord); }
  .cm-nouvelle .rond { width:34px; height:34px; border-radius:50%; background:#2a2a2a; display:grid; place-items:center; font-weight:700; overflow:hidden; flex:none; } .cm-nouvelle .rond img { width:100%; height:100%; object-fit:cover; }
  .cm-nouvelle p { flex:1; margin:0; font-size:13.5px; } .cm-nouvelle small { color:var(--doux); font-size:11.5px; flex:none; }
  .cm-section { margin-top:22px; } .cm-section h2 { margin:0 0 4px; font-size:17px; } .cm-section > p { margin:0 0 10px; color:var(--doux); font-size:13px; }
</style>`;
const ligne = (x, actions, sous) => `<div class="cm-ligne"><span class="rond">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
  <div class="qui"><a href="/classement/${encodeURIComponent(x.id)}" style="text-decoration:none"><b>${echapper(x.nom)}</b></a><small>${sous || ''}</small></div>${actions || ''}</div>`;
const bouton = (action, texte, champs = {}, classe = 'secondaire') => `<form method="post" action="${action}">${Object.entries(champs).map(([k, v]) => `<input type="hidden" name="${k}" value="${echapper(v)}">`).join('')}<button class="bouton ${classe}" type="submit">${echapper(texte)}</button></form>`;

const tuile = (x, sous, barre) => `<a class="cm-tuile" href="/classement/${encodeURIComponent(x.id)}"><span class="rond">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
  <b>${echapper(x.nom)}</b><small>${sous || ''}</small>${barre !== undefined ? `<span class="cm-barre"><i style="width:${barre}%"></i></span>` : ''}</a>`;
const tuileVide = (texte, lien) => `<a class="cm-tuile vide" href="${lien}"><span class="rond">+</span><b>${echapper(texte)}</b></a>`;
function phrase(n) {
  const v = n.type === 'gain' ? `a gagné <b>${dollars(n.valeur)}</b>` : n.type === 'vues' ? `a fait <b>${vuesCourtes(n.valeur)} vues</b>` : n.type === 'gagne' ? `a gagné votre concurrence (${dollars(n.valeur, { centimes: false })})` : 'a posté un nouveau résultat';
  return `${n.concurrent ? 'Ton concurrent ' : ''}<b>${echapper(n.membre.nom)}</b> ${v}`;
}
function pageCommunaute(config, { espace, suivis, concurrents, recues, envoyees, enVogue, proches, peutConcourir, places, fil = [], message, erreur }) {
  const flammeTxt = (n) => (n >= 3 ? `🔥 ${n}` : '');
  const autres = suivis.filter((x) => x.type !== 'concurrent');
  const quand = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return page('Je suis', `${STYLE_COMMU}
  <a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Communauté</p><h1>Je suis</h1></div><span class="doux petit">${places} / 10 places</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${recues.length ? `<section class="cm-section"><h2>Invitations à concourir</h2><p>Le premier qui atteint l'objectif gagne. Un concurrent prend une de tes 10 places.</p>
    <div class="cm-liste">${recues.map((c) => ligne(c.membre, `${bouton(`/communaute/concurrences/${c.id}`, 'Refuser', { reponse: 'non' })}${bouton(`/communaute/concurrences/${c.id}`, 'Accepter', { reponse: 'oui' }, 'vert')}`,
    `Premier à ${dollars(c.objectif, { centimes: false })}`)).join('')}</div></section>` : ''}
  <section class="cm-section"><h2>Mes concurrents (${concurrents.length} / 3)</h2>
    ${peutConcourir ? '' : '<p>La concurrence se débloque à l\'étape 4, après ton premier compte rendu.</p>'}
    <div class="cm-tuiles">${concurrents.map((c) => tuile(c.membre, `toi ${dollars(c.moi, { centimes: false })} · ${dollars(c.lui, { centimes: false })}`, Math.min(100, Math.round((Math.max(c.moi, c.lui) / c.objectif) * 100)))).join('')}
      ${envoyees.map((c) => tuile(c.membre, 'invitation envoyée')).join('')}
      ${peutConcourir && concurrents.length + envoyees.length < 3 ? tuileVide('Défier', '#proches') : ''}</div></section>
  <section class="cm-section"><h2>Mes suivis (${autres.length})</h2>
    <div class="cm-tuiles">${autres.map((s) => tuile(s.membre, flammeTxt(s.membre.chaine) || (s.membre.role ? echapper(nomRole(s.membre.role)) : 'Elite'))).join('')}
      ${places < 10 ? tuileVide('Suivre', '#recommandes') : ''}</div>
    <p class="doux petit" style="margin:8px 0 0">Touche un membre pour voir son profil, le défier ou ne plus le suivre.</p></section>
  <section class="cm-section"><h2>Leurs dernières nouvelles</h2>
    <div class="cm-fil">${fil.map((n, i) => `<div class="cm-nouvelle" style="opacity:${Math.max(0.35, 1 - i * 0.13).toFixed(2)}"><span class="rond">${n.membre.avatar ? `<img src="${echapper(n.membre.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((n.membre.nom || '?').charAt(0).toUpperCase())}</span>
      <p>${phrase(n)}</p><small>${echapper(quand(n.quand))}</small></div>`).join('') || '<p class="vide-traiter">Suis des membres pour voir leurs résultats ici.</p>'}</div></section>
  ${proches.length ? `<section class="cm-section" id="proches"><h2>Profils proches du tien</h2><p>Mêmes revenus et mêmes vues que toi ces 10 derniers jours : défie-le.</p>
    <div class="cm-liste">${proches.map((x) => ligne(x.membre, bouton('/communaute/defier', 'Défier', { id: x.membre.id }, 'vert'),
    `${dollars(x.revenus, { centimes: false })} · ${vuesCourtes(x.vues)} vues en 10 jours`)).join('')}</div></section>` : ''}
  <section class="cm-section" id="recommandes"><h2>Recommandés</h2><p>Les meilleurs résultats de la semaine. Places prises ? Retire quelqu'un qui ne poste plus (depuis son profil).</p>
    <div class="cm-liste">${enVogue.map((x) => ligne(x.membre, places >= 10 ? '' : bouton('/communaute/suivre', 'Suivre', { id: x.membre.id }, 'vert'),
    `${dollars(x.revenus, { centimes: false })} · ${vuesCourtes(x.vues)} vues cette semaine${x.chaine >= 3 ? ` · 🔥 ${x.chaine}` : ''}`)).join('') || '<p class="vide-traiter">Pas encore de résultats cette semaine.</p>'}</div>
    <a class="bouton secondaire" href="/classement" style="max-width:420px;margin-top:12px">Trouver des membres dans le classement</a></section>`, espace, 'profil');
}

// ---------- Remarques du coach ----------
function pageRemarques(config, { espace, remarques }) {
  return page('Remarques du coach', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Remarques du coach</h1></div><span class="doux petit">${remarques.length} au total</span></div>
  <div style="display:grid;gap:10px">${remarques.map(remarque).join('') || '<p class="vide-traiter">Pas encore de remarque.</p>'}</div>`, espace, 'remarques');
}

module.exports = { pageMonProfil, pageCommunaute, pageRemarques, pageRevenus, pageReglages, FLAMME };
