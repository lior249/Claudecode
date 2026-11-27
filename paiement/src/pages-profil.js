'use strict';

// Mon profil (page d'accueil des élèves Elite) : photo, 3 chiffres, la roue des jours (chaque jour : sa fiche,
// son résultat), la chaîne 🔥, ceux qu'il suit, la tâche du moment ; puis le tableau de bord des revenus.
// Et la page Communauté : suivis (10 places), concurrents (3), invitations, suggestions.
const { echapper } = require('./pages');
const { blocStats, valeurObjectif, blocHeatmap, STYLE_HEATMAP, SCRIPT_HEATMAP, page, remarque, listeRemarques, blocTableau, SCRIPT_TABLEAU, dollars, fenetreAFaire, frise, texteRicheAnnonce, barreMiseEnForme, texteSimple, zoneImages } = require('./pages-parcours');
const { ICONE } = require('./pages');
const { pastilleRole, STYLE_ROLES, nomRole } = require('./roles');
const { jourLisible } = require('./suivi');
const { vuesCourtes } = require('./pages-classement');
const { pieceTrophee } = require('./trophees');

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
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  bulle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5a2 2 0 0 1-1.5-2z"/><path d="M8.5 9h7M8.5 12.2h4.5"/></svg>',
  reglages: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  fleche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
};

const STYLE_PROFIL = `<style>
  .pf { --lime:#c8f23a; --lime-fonce:#1d2408; max-width:560px; margin:0 auto; }
  /* Ordinateur : deux colonnes (identité et journée à gauche, cartes à droite), plus de place. */
  @media (min-width: 1100px) {
    .pf { max-width:1120px; }
    .pf-cols { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:0 36px; align-items:start; }
    .pf-cols .pf-d { position:sticky; top:20px; }
    .pf-cols .pf-identite { margin-top:0; }
  }
  .pf-haut { display:flex; align-items:center; justify-content:space-between; margin:2px 0 6px; }
  .pf-icone { position:relative; display:grid; place-items:center; width:40px; height:40px; border-radius:50%; color:#fff; }
  .pf-icone svg { width:24px; height:24px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .pf-icone .point { position:absolute; top:7px; right:8px; width:8px; height:8px; border-radius:50%; background:var(--lime); border:2px solid #000; }
  .pf-chaine { display:inline-flex; align-items:center; gap:6px; padding:7px 12px 7px 9px; border-radius:999px; background:#141414; border:1px solid #242424; font-weight:700; font-size:15px; text-decoration:none; color:#fff; }
  .flamme { width:20px; height:20px; fill:#3a3a3a; } .flamme .coeur { fill:#242424; }
  .flamme.allumee { fill:#ff7a1a; filter:drop-shadow(0 0 6px rgba(255,122,26,.55)); } .flamme.allumee .coeur { fill:#ffd23f; }
  .pf-identite { display:flex; align-items:stretch; gap:12px; text-align:left; }
  .pf-identite .qui { flex:none; width:112px; text-align:center; min-width:0; display:flex; flex-direction:column; align-items:center; }
  .pf-identite .qui .pf-avatar { margin:0 0 8px; }
  .pf-identite .qui h1 { font-size:17px; overflow-wrap:anywhere; } .pf-identite .qui p { font-size:12px; overflow-wrap:anywhere; }
  .pf-salle { flex:1; min-width:0; display:flex; flex-direction:column; border-radius:20px; background:#141414; border:1px solid #1f1f1f; overflow:hidden; }
  .pf-salle .defile { flex:1; display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; }
  .pf-salle .defile::-webkit-scrollbar { display:none; }
  .pf-salle a { flex:0 0 100%; scroll-snap-align:start; display:flex; flex-direction:column; justify-content:center; padding:12px 14px; color:#fff; text-decoration:none; box-sizing:border-box; }
  .pf-salle h3 { margin:0; font-size:15px; display:flex; justify-content:space-between; align-items:baseline; gap:6px; }
  .pf-salle h3 small { color:var(--lime); font-size:12.5px; font-weight:600; }
  .pf-salle .pieces { display:flex; gap:4px; margin:10px 0 8px; min-height:44px; align-items:center; }
  .pf-salle .dernier { font-size:12px; color:var(--doux); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pf-salle .dernier b { color:#fff; }
  .pf-salle .pts { display:flex; justify-content:center; gap:5px; padding:0 0 8px; } .pf-salle .pts i { width:5px; height:5px; border-radius:50%; background:#444; }
  .pf-avatar { width:92px; height:92px; margin:0 auto 10px; border-radius:50%; padding:5px; border:2px dashed var(--lime); }
  .pf-avatar img, .pf-avatar span { width:100%; height:100%; border-radius:50%; object-fit:cover; display:grid; place-items:center; background:#2a2a2a; font-size:32px; font-weight:800; }
  .pf-identite h1 { font-size:26px; margin:0; letter-spacing:-0.02em; }
  .pf-identite p { margin:2px 0 0; color:var(--doux); font-size:14px; }
  .pf-chiffres { display:grid; grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; margin:20px 0 18px; text-align:center; }
  .pf-chiffres .sep { width:1px; height:34px; background:#262626; }
  .pf-chiffres b { display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:16px; white-space:nowrap; }
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
  .jp-videos { display:grid; gap:6px; margin-top:10px; }
  .jp-video { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; border-radius:12px; background:#161616; font-size:13.5px; margin-top:6px; }
  .jp-video .bouton { flex:none; width:auto; margin:0 !important; min-height:34px; padding:6px 12px; font-size:13px; }
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
  .pf-menu { cursor:pointer; }
  @media (max-width: 959px) { .pf-doublon { display:none; } }
  @media (min-width: 960px) { .pf-menu { display:none; } }
  .pf-icone .compteur { position:absolute; top:-3px; right:-9px; min-width:19px; height:19px; padding:0 5px; border-radius:10px; background:#ff3b30; color:#fff;
    font:800 11px/19px var(--police); text-align:center; border:2px solid #000; box-sizing:content-box; }
  /* La photo dans une pièce de monnaie : bord cranté de la couleur du rang, sans brillance fixe ;
     seul un reflet passe, du coin bas gauche au coin haut droit, découpé à la forme de la pièce. */
  .pf-avatar.piece { position:relative; width:100px; height:100px; padding:12px; border:0; border-radius:50%; isolation:isolate; overflow:hidden;
    background:
      linear-gradient(135deg, transparent 17%, rgba(255,255,255,.7) 17% 25%, transparent 25% 30%, rgba(255,255,255,.45) 30% 33%, transparent 33% 70%, rgba(255,255,255,.5) 70% 77%, transparent 78%),
      linear-gradient(160deg, color-mix(in srgb, var(--piece) 45%, #fff) 0%, var(--piece) 55%, color-mix(in srgb, var(--piece) 80%, #000) 100%);
    box-shadow:inset 0 -3px 0 color-mix(in srgb, var(--piece) 65%, #000), inset 0 2px 0 color-mix(in srgb, var(--piece) 40%, #fff), 0 6px 18px -8px color-mix(in srgb, var(--piece) 70%, transparent); }
  .pf-avatar.piece .face { position:relative; z-index:1; display:block; width:100%; height:100%; border-radius:50%; overflow:hidden;
    box-shadow:0 0 0 3px color-mix(in srgb, var(--piece) 60%, #000), inset 0 3px 8px rgba(0,0,0,.45); }
  .pf-avatar.piece .face img, .pf-avatar.piece .face > span { position:relative; z-index:-1; }
  .pf-avatar.piece::after { content:""; position:absolute; inset:0; z-index:2; pointer-events:none; border-radius:50%;
    background:linear-gradient(45deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%) no-repeat;
    background-size:250% 250%; background-position:120% -20%; animation:ovx-piece 3.6s ease-in-out infinite; }
  @keyframes ovx-piece { 0% { background-position:100% 0%; } 50%, 100% { background-position:0% 100%; } }
  .pf-avatar.piece[data-sinistre]::after { animation:none; opacity:0; } .pf-avatar.piece[data-sinistre] img { filter:grayscale(1); }
  .pf-objectif-barre { display:block; margin:-4px 0 18px; padding:12px 14px; border-radius:16px; background:#101010; border:1px solid #222; color:#fff; text-decoration:none; }
  .pf-objectif-barre .haut { display:flex; justify-content:space-between; align-items:baseline; font-size:13px; color:var(--doux); }
  .pf-objectif-barre .haut b { color:#fff; font-size:15px; }
  .pf-objectif-barre .barre { display:block; height:8px; margin:8px 0 6px; border-radius:999px; background:#262626; overflow:hidden; }
  .pf-objectif-barre .barre i { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, #9fd11f, var(--lime)); }
  .pf-objectif-barre .bas { font-size:12px; color:var(--doux); }
  @media (prefers-reduced-motion: reduce) { .pf-avatar.piece::after { animation:none; } }
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

// Chaque carrousel de la page (cartes du profil, « Je suis ») défile seul toutes les 3 s, sauf si on vient d'y toucher.
const SCRIPT_CARROUSEL = `document.querySelectorAll('.pf-carrousel').forEach(function (c) {
  var points = c.parentNode.querySelectorAll('.pf-points i'), n = c.children.length, touche = 0;
  function index() { return Math.round(c.scrollLeft / c.clientWidth); }
  function marquer() { var k = index(); Array.prototype.forEach.call(points, function (p, i) { p.className = i === k ? 'actif' : ''; }); }
  c.addEventListener('scroll', function () { requestAnimationFrame(marquer); }, { passive: true });
  ['touchstart', 'pointerdown', 'wheel'].forEach(function (e) { c.addEventListener(e, function () { touche = Date.now(); }, { passive: true }); });
  if (n > 1 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    setInterval(function () { if (Date.now() - touche < 6000 || document.hidden) return; c.scrollTo({ left: ((index() + 1) % n) * c.clientWidth, behavior: 'smooth' }); }, 3000);
  }
});`;
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
  const ETATS = { valide: 'validés', attente: 'en attente', corriger: 'à corriger' };
  const ligneVideo = (v, k) => `<div class="jp-video"><span><b>Vidéo ${k + 1}</b> · ${v.etat ? `${Number(v.vues || 0).toLocaleString('fr-FR')} vues · ${dollars(v.revenus || 0)} (${ETATS[v.etat]})` : v.pret ? 'résultats à donner' : 'résultats dans 24 h'}</span>
    ${v.pret ? `<a class="bouton${!v.etat || v.etat === 'corriger' ? '' : ' secondaire'}" href="/parcours/videos/${v.id}">${!v.etat ? 'Résultats' : v.etat === 'corriger' ? 'Corriger' : 'Mettre à jour'}</a>` : ''}</div>`;
  let corps = '';
  if (d.futur) corps = '<p>À venir : prépare ta vidéo.</p>';
  else {
    if (d.aujourdhui && tache) {
      const ech = tache.delai || tache.echeance;
      corps += `<p><b style="color:#fff">${echapper(tache.titre)}</b></p>${ech && ech.fin ? `<p class="rebours" data-fin="${echapper(ech.fin)}" data-duree="${Number(ech.duree) || 0}">⏳ <span>…</span></p>` : ''}<p>${echapper(tache.texte || '')}</p>
        ${tache.lien ? `<a class="bouton" href="${echapper(tache.lien)}">${echapper(tache.bouton || 'Y aller')}</a>` : ''}`;
    }
    if (d.etape4) {
      corps += d.videos.length ? `<div class="jp-videos">${d.videos.map(ligneVideo).join('')}</div>` : (d.aujourdhui ? '' : '<p>Aucune vidéo déclarée ce jour-là.</p>');
      if (d.cr) corps += `<div class="jp-video"><span><b>Update du compte</b> · ${d.cr.revenus_28j !== null && d.cr.revenus_28j !== undefined ? `${dollars(d.cr.revenus_28j)} sur 28 j · ` : ''}${ETATS[d.cr.etat] || ''}</span>
        ${d.cr.etat === 'corriger' ? `<a class="bouton" href="/parcours/compte-rendu/${d.j}">Corriger</a>` : ''}</div>`;
    } else if (!d.aujourdhui) corps = '<p>Rien à faire ce jour-là : tes tâches sont celles d\'aujourd\'hui.</p>';
  }
  return `<section class="jour-panneau" data-jour="${d.j}"${d.aujourdhui ? '' : ' hidden'}><h2>${echapper(titre)}</h2>${corps}${d.futur ? '' : encourage}</section>`;
}

// Pastille rouge : le nombre, jusqu'à 9+.
const compteur = (n) => (n ? `<span class="compteur">${n > 9 ? '9+' : n}</span>` : '');
// La couleur de la pièce (contour de la photo) : celle du rang Discord.
const couleurPiece = (role) => ({ goat: '#f5c518', 10000: '#f5c518', 5000: '#d9a21b', 1500: '#ee8a2d', elite: '#5b6cff', membre: '#57d17a', sinistre: '#e5484d' })[role] || '#5b6cff';
// Prochain objectif : la barre de progression (ouvre Mes revenus).
function barreObjectif(objectif) {
  if (!objectif) return '';
  const pct = Math.min(100, Math.round(((objectif.valeur || 0) / objectif.seuil) * 100));
  return `<a class="pf-objectif-barre" href="/revenus" aria-label="Prochain objectif : ${pct} %">
    <span class="haut"><span>Prochain objectif</span><b>${echapper(objectif.libelle)}</b></span>
    <span class="barre"><i style="width:${pct}%"></i></span><span class="bas">${valeurObjectif(objectif, objectif.valeur || 0)} · ${pct} %</span></a>`;
}
// Trophy room (Mon profil) : mes derniers trophées, puis ceux de mes concurrents (on fait défiler).
function salleTrophees(salle) {
  if (!salle) return '';
  const pieces = (liste) => liste.slice(0, 4).map((t) => pieceTrophee(t, { taille: 40 })).join('');
  const vide = pieceTrophee({ court: '10K', metal: 'bronze', titre: 'Premier trophée', famille: 'banger' }, { taille: 40, obtenu: false });
  const moi = salle.moi || { obtenus: [] };
  const slides = [`<a href="/trophees"><h3>Trophy room <small>${moi.obtenus.length} / ${moi.total || 22}</small></h3>
      <div class="pieces">${moi.obtenus.length ? pieces(moi.obtenus) : vide}</div>
      <div class="dernier">${moi.obtenus.length ? `Dernier : <b>${echapper(moi.obtenus[0].titre)}</b>` : 'Premier trophée : 10K vues sur une vidéo'}</div></a>`,
    ...(salle.concurrents || []).map((c) => `<a href="/trophees?de=${encodeURIComponent(c.id)}"><h3>${echapper(c.nom)} <small>${c.nb} trophée${c.nb > 1 ? 's' : ''}</small></h3>
      <div class="pieces">${c.trophees.length ? pieces(c.trophees) : '<span class="doux petit">Pas encore de trophée</span>'}</div>
      <div class="dernier">${c.trophees.length ? `Dernier : <b>${echapper(c.trophees[0].titre)}</b>` : 'Concurrent'}</div></a>`)];
  return `<div class="pf-salle"><div class="defile" aria-label="Trophy room">${slides.join('')}</div>${slides.length > 1 ? `<div class="pts" aria-hidden="true">${slides.map(() => '<i></i>').join('')}</div>` : ''}</div>`;
}

// Le profil d'un membre vu par les autres (classement) : comme Mon profil, sans ce qui ne regarde que lui
// (étape, prochain objectif, tâches) : photo et nom, sa Trophy room, revenus, rang, jours, puis ses résultats.
function pageProfilPublic(config, { espace, parcours: p, nom, avatar, role, stats = {}, jours = 1, chaine = 0, trophees = [], totalTrophees = 22, tableau, relation, vueCoach = false }) {
  const pieces = trophees.slice(0, 4).map((t) => pieceTrophee(t, { taille: 40 })).join('');
  const salle = `<a class="pf-salle" href="/trophees?de=${encodeURIComponent(p.discord_id)}" style="color:#fff;text-decoration:none">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:12px 14px"><h3>Trophy room <small>${trophees.length} / ${totalTrophees}</small></h3>
      <div class="pieces">${pieces || '<span class="doux petit">Pas encore de trophée</span>'}</div>
      <div class="dernier">${trophees.length ? `Top : <b>${echapper(trophees[0].titre)}</b>` : 'Voir ses trophées'}</div></div></a>`;
  const boutons = relation ? `${relation.message ? `<p class="message-ok">${echapper(relation.message)}</p>` : ''}${relation.erreur ? `<p class="erreur-form">${echapper(relation.erreur)}</p>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 18px">
    ${relation.concurrent ? `<form method="post" action="/communaute/concurrences/${relation.concurrenceId}/abandon" style="margin:0"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton secondaire" type="submit" style="margin:0">Ton concurrent · abandonner</button></form>`
    : `<form method="post" action="/communaute/${relation.suit ? 'ne-plus-suivre' : 'suivre'}" style="margin:0"><input type="hidden" name="id" value="${echapper(p.discord_id)}"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton${relation.suit ? ' secondaire' : ''}" type="submit" style="margin:0">${relation.suit ? 'Ne plus suivre' : 'Suivre'}</button></form>`}
    ${relation.peutDefier && !relation.concurrent ? `<form method="post" action="/communaute/defier" style="margin:0"><input type="hidden" name="id" value="${echapper(p.discord_id)}"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton secondaire" type="submit" style="margin:0">Défier</button></form>` : ''}
  </div>` : '';
  return page(`Profil de ${nom}`, `${STYLE_PROFIL}${STYLE_ROLES}
  <a class="retour" href="/classement"><span aria-hidden="true">‹</span> Classement</a>
  <div class="pf">
    <div class="pf-identite"><div class="qui">
      <span class="pf-avatar piece" style="--piece:${echapper(couleurPiece(p.sinistre_depuis ? 'sinistre' : role))}"${p.sinistre_depuis ? ' data-sinistre' : ''}>
        <span class="face">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</span></span>
      <h1>${echapper(nom)}</h1><p>@${echapper(p.pseudo || '')}</p></div>
      ${salle}
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.revenus}${dollars(stats.revenusTotal || 0, { centimes: false })}</b><small>Revenus</small></div><span class="sep"></span>
      <div><b>${pastilleRole(p.sinistre_depuis ? 'sinistre' : role)}</b><small>Rang</small></div><span class="sep"></span>
      <div><b>${ICONES.jours}${jours}</b><small>Jours${chaine >= 3 ? ` · 🔥 ${chaine}` : ''}</small></div>
    </div>
    ${vueCoach ? `<a class="bouton secondaire" href="/admin/membres/${encodeURIComponent(p.discord_id)}" style="margin:0 0 14px">Sa fiche</a>` : ''}
    ${boutons}
    ${blocTableau(tableau)}
    ${blocStats(stats)}
  </div>`, espace, 'classement', null, SCRIPT_TABLEAU);
}

// Salle des trophées : par famille, obtenus en couleur, les autres en gris, avec le seuil.
function pageTrophees(config, { espace, salle, membre, mesures = {} }) {
  const valeur = { banger: mesures.banger, compte: mesures.compte, abonnes: mesures.abonnes, revenus: mesures.revenus, regularite: mesures.regularite };
  const style = `<style>.tr-fam { margin:0 0 14px; } .tr-fam h2 { margin:0; } .tr-grille { display:grid; grid-template-columns:repeat(auto-fill, minmax(104px, 1fr)); gap:10px; margin-top:12px; }
  .tr-t { text-align:center; padding:12px 6px; border-radius:16px; background:#111; border:1px solid #222; } .tr-t[data-obtenu="1"] { background:radial-gradient(100% 100% at 50% 0%, #2a2108, #111 70%); border-color:#3a3112; }
  .tr-t b { display:block; margin-top:6px; font-size:14px; } .tr-t small { display:block; color:var(--doux); font-size:11.5px; line-height:1.35; margin-top:2px; }</style>`;
  const nombre = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
  const familles = salle.map((f) => `<div class="carte tr-fam"><div class="envoi-tete"><h2>${echapper(f.titre)}</h2><span class="doux petit">${f.trophees.filter((t) => t.obtenu).length} / ${f.trophees.length}</span></div>
    <p class="doux petit" style="margin:4px 0 0">${echapper(f.texte)}${valeur[f.cle] !== undefined ? ` : <b style="color:#fff">${f.cle === 'revenus' ? dollars(valeur[f.cle]) : f.cle === 'regularite' ? `${nombre(valeur[f.cle])} jour${valeur[f.cle] > 1 ? 's' : ''}` : nombre(valeur[f.cle])}</b>${f.cle === 'banger' ? ' (meilleure vidéo)' : ''}` : ''}</p>
    <div class="tr-grille">${f.trophees.map((t) => `<div class="tr-t" data-obtenu="${t.obtenu ? 1 : 0}">${pieceTrophee(t, { taille: 64, obtenu: !!t.obtenu })}<b>${echapper(t.titre)}</b>
      <small>${t.obtenu ? `Obtenu le ${echapper(jourLisible(t.obtenu.obtenu_le.slice(0, 10)))}` : `Objectif : ${echapper(t.but)}`}</small></div>`).join('')}</div></div>`).join('');
  const total = salle.reduce((n, f) => n + f.trophees.filter((t) => t.obtenu).length, 0);
  return page(membre ? `Trophées de ${membre.nom}` : 'Mes trophées', `${style}<a class="retour" href="${membre ? `/classement/${encodeURIComponent(membre.id)}` : '/profil'}"><span aria-hidden="true">‹</span> ${membre ? `Profil de ${echapper(membre.nom)}` : 'Mon profil'}</a>
  <div class="titre-page"><div><p class="etiquette">Trophy room</p><h1>${membre ? `Trophées de ${echapper(membre.nom)}` : 'Mes trophées'}</h1></div><span class="doux petit">${total} / ${salle.reduce((n, f) => n + f.trophees.length, 0)}</span></div>
  <p class="doux" style="margin:0 0 14px">Les trophées se gagnent avec les résultats validés par ton coach : vues d'une vidéo, vues du compte, abonnés et revenus.</p>
  ${familles}`, espace, 'profil');
}

function pageMonProfil(config, { espace, parcours: p, prenom, avatar, stats, role, jourDepuis, jours, chaine, flamme, derniers7, tache, suivis, concurrents = [], activite = {}, aujourdhui, nbSuivis, nbConcurrents, invitations, notifications, rappel,
  rang, totalClasses, revenusMois, objectif, seances = [], remarquesNouvelles = 0, annonce, salleTrophees: salle }) {
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
    objectif ? `<a class="pf-slide pf-objectif" href="/revenus"><h3>Prochain objectif : ${echapper(objectif.libelle)}</h3><p>Encore ${valeurObjectif(objectif, Math.max(0, objectif.seuil - (objectif.valeur || 0)))}${objectif.type === 'revenus' ? ' à gagner' : ''}.</p>
      <div class="cm-barre"><i style="width:${Math.min(100, Math.round(((objectif.valeur || 0) / objectif.seuil) * 100))}%"></i></div></a>` : '',
  ].filter(Boolean);
  return page('Mon profil', `${STYLE_PROFIL}${STYLE_ROLES}
  ${fenetreAFaire(rappel)}
  <div class="pf">
    ${carteAnnonce(annonce)}
    <div class="pf-haut">
      <div class="pf-groupe">
        <label class="pf-icone pf-menu" for="menu-ouvert" aria-label="Ouvrir le menu">${ICONES.menu}</label>
        <a class="pf-icone pf-doublon" href="/notifications" aria-label="Notifications${notifications ? ` : ${notifications} non lue(s)` : ''}">${ICONES.cloche}${compteur(notifications)}</a>
        <a class="pf-icone pf-doublon" href="/remarques" aria-label="Remarques du coach${remarquesNouvelles ? ` : ${remarquesNouvelles} nouvelle(s)` : ''}">${ICONES.bulle}${compteur(remarquesNouvelles)}</a>
      </div>
      <div class="pf-groupe">
        <button class="pf-chaine" type="button" data-ouvrir="regularite-fenetre" aria-label="Chaîne de ${chaine} jours : voir ma régularité" style="cursor:pointer;font-family:inherit">${FLAMME(flamme)}${chaine}</button>
        <a class="pf-icone" href="/reglages" aria-label="Réglages">${ICONES.reglages}</a>
      </div>
    </div>
    <div class="pf-cols"><div class="pf-g">
    <div class="pf-identite"><div class="qui">
      <a class="pf-avatar piece" style="--piece:${echapper(couleurPiece(p.sinistre_depuis ? 'sinistre' : role))}"${p.sinistre_depuis ? ' data-sinistre' : ''} href="/fiche" aria-label="Ma fiche">
        <span class="face">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</span></a>
      <h1>${echapper(nom)}</h1><p>@${echapper(p.pseudo || '')}</p></div>
      ${salleTrophees(salle)}
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.revenus}${dollars(stats.revenusTotal || 0, { centimes: false })}</b><small>Revenus</small></div><span class="sep"></span>
      <div><b>${pastilleRole(p.sinistre_depuis ? 'sinistre' : role)}</b><small>Rang</small></div><span class="sep"></span>
      <div><b>${ICONES.jours}${jourDepuis}</b><small>Jours</small></div>
    </div>
    ${barreObjectif(objectif)}
    <a class="pf-frise" href="/parcours" aria-label="Mon parcours">${frise(Math.min(p.etape, 5))}</a>
    <div class="roue-cadre"><div class="roue" role="listbox" aria-label="Jours">${roue}</div><button type="button" class="roue-retour" hidden>Revenir à aujourd'hui</button></div>
    ${jours.map((d, i) => panneauJour(d, i, tache)).join('')}
    </div><div class="pf-d">
    <div class="pf-cartes">
      <div class="pf-carte pf-carrousel-cadre">
        <div class="pf-carrousel" aria-roledescription="carrousel" aria-label="Je suis">
          <a class="pf-slide pf-suivis" href="/communaute">
            <div class="pf-ronds">${concurrents.slice(0, 3).map(rond).join('') || '<span>⚔</span>'}</div>
            <h3>Mes concurrents</h3><p class="vert">${nbConcurrents} / 3</p>
            ${invitations ? `<p>${invitations} invitation${invitations > 1 ? 's' : ''} à défier</p>` : `<p>${nbConcurrents ? 'Le premier à l\'objectif gagne.' : 'Défie un profil proche du tien.'}</p>`}</a>
          <a class="pf-slide pf-suivis" href="/communaute">
            <div class="pf-ronds">${suivis.slice(0, 3).map(rond).join('') || '<span>+</span>'}</div>
            <h3>Mes suivis</h3><p class="vert">${nbSuivis} / 10</p><p>${suivis.length ? 'Leurs résultats arrivent chez toi.' : 'Suis ceux qui t\'inspirent.'}</p></a>
        </div>
        <div class="pf-points" aria-hidden="true"><i class="actif"></i><i></i></div>
      </div>
      <div class="pf-carte pf-carrousel-cadre">
        <div class="pf-carrousel" aria-roledescription="carrousel">${slides.join('')}</div>
        <div class="pf-points" aria-hidden="true">${slides.map((x, i) => `<i${i ? '' : ' class="actif"'}></i>`).join('')}</div>
      </div>
    </div>
    <div class="pf-carte" style="min-height:0;margin:0 0 4px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h3>Ma régularité</h3>
      <span class="doux petit">${chaine >= 3 ? `🔥 ${chaine} jours d'affilée` : 'Chaque jour, tes tâches faites'}</span></div>
      <div style="margin-top:10px">${blocHeatmap(activite, aujourdhui, { id: 'regularite-page' })}</div></div>
    <a class="bouton secondaire" href="/parcours" style="margin:10px 0 18px">Mon parcours</a>
    ${seances.length ? `<h2 class="section">Mes prochains coachings</h2><div class="carte">${seances.slice(0, 3).map((x) => `<div class="pf-seance"><b data-quand="${echapper(x.debut)}">${echapper(x.date)} à ${echapper(x.heure)} GMT</b><span>${echapper(x.type)}</span></div>`).join('')}
      <a class="bouton secondaire" href="/coaching" style="margin-top:10px">Mes coachings</a></div>` : ''}
    </div></div>
  </div>
  ${STYLE_HEATMAP}<dialog class="fenetre" id="regularite-fenetre" aria-labelledby="regularite-titre">
    <button class="fermer" type="button" aria-label="Fermer" data-fermer>×</button>
    <h2 id="regularite-titre">${FLAMME(flamme)} Ma régularité</h2>
    <p class="doux petit" style="margin:0 0 14px">${flamme ? `${chaine} jours d'affilée : ne casse pas ta chaîne !` : 'Chaque jour, les tâches faites : plus c\'est vert, plus tu as avancé.'}</p>
    ${blocHeatmap(activite, aujourdhui, { id: 'regularite-profil' })}</dialog>`, espace, 'profil', null, `${SCRIPT_ROUE}${SCRIPT_CARROUSEL}${SCRIPT_QUAND}${SCRIPT_REBOURS}${SCRIPT_HEATMAP}
(function () { var d = document.getElementById('regularite-fenetre'); if (!d || !d.showModal) return;
  document.querySelectorAll('[data-ouvrir="regularite-fenetre"]').forEach(function (b) { b.onclick = function () { d.showModal(); }; });
  d.querySelector('[data-fermer]').onclick = function () { d.close(); };
  d.addEventListener('click', function (e) { if (e.target === d) d.close(); }); })();`);
}

// Revenus : le tableau de bord TikTok (ouvert depuis le carrousel de Mon profil).
function pageRevenus(config, { espace, tableau, stats, objectif }) {
  const style = `<style>.pf-objectif-barre { display:block; margin:0 0 18px; padding:12px 14px; border-radius:16px; background:#101010; border:1px solid #222; color:#fff; text-decoration:none; max-width:640px; }
  .pf-objectif-barre .haut { display:flex; justify-content:space-between; font-size:13px; color:var(--doux); } .pf-objectif-barre .haut b { color:#fff; font-size:15px; }
  .pf-objectif-barre .barre { display:block; height:8px; margin:8px 0 6px; border-radius:999px; background:#262626; overflow:hidden; }
  .pf-objectif-barre .barre i { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, #9fd11f, #c8f23a); } .pf-objectif-barre .bas { font-size:12px; color:var(--doux); }</style>`;
  return page('Mes revenus', `${style}<a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Mon profil</p><h1>Mes revenus</h1></div><span class="doux petit">Total validé : ${dollars((stats || {}).revenusTotal || 0)}</span></div>
  ${barreObjectif(objectif)}
  ${blocTableau(tableau)}`, espace, 'profil', null, SCRIPT_TABLEAU);
}

// Réglages : prénom et pays, lien du compte TikTok, notifications, compte.
function pageReglages(config, { espace, prenom, pays, compteTikTok, parcours: aUnParcours, etape = 0, compte = {}, message, erreur }) {
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
    ${aUnParcours && etape >= 4 ? (compte.valide && !compte.autorise
    ? `<div class="carte" style="display:grid;gap:10px"><div class="envoi-tete"><h2 style="margin:0">Mon compte TikTok</h2><span class="etat" data-etat="valide">Validé</span></div>
      <p style="margin:0;overflow-wrap:anywhere">${echapper(compteTikTok || '')}</p>
      ${compte.demande ? `<p class="doux petit" style="margin:0">Demande de changement envoyée : ton coach va répondre.</p>`
    : `<details><summary class="doux petit" style="cursor:pointer">Demander un changement de compte</summary>
        <form method="post" action="/reglages/tiktok/demande" style="display:grid;gap:10px;margin-top:10px">
          <textarea name="motif" maxlength="1000" required placeholder="Pourquoi ? ex. Mon compte est shadowban depuis une semaine."></textarea>
          <button class="bouton secondaire" type="submit" style="margin:0">Envoyer la demande au coach</button></form></details>`}</div>`
    : `<form class="carte" method="post" action="/reglages/tiktok" style="display:grid;gap:12px">
      <h2 style="margin:0">Mon compte TikTok${compte.autorise ? ' : nouveau compte' : ''}</h2>
      ${compte.autorise ? '<p class="message-ok" style="margin:0">Ton coach autorise le changement : envoie le lien du nouveau compte.</p>' : ''}
      <div class="champ"><label for="compte">Lien de mon compte</label><input id="compte" name="compte" inputmode="url" value="${compte.autorise ? '' : echapper(compteTikTok || '')}" placeholder="https://www.tiktok.com/@ton.compte">
        <small>Sur TikTok : ton profil › Partager le profil › Copier le lien. Ton coach le valide ensuite.</small></div>
      <button class="bouton" type="submit" style="margin:0">Envoyer</button>
    </form>`) : ''}
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
// Remarques et messages du coach ; « Écrire au coach » : un message direct, rangé dans son À traiter.
function pageRemarques(config, { espace, remarques, envoyes = [], fait, erreur }) {
  return page('Remarques du coach', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Remarques du coach</h1></div><span class="doux petit">${remarques.length} au total</span></div>
  ${fait ? '<p class="message-ok">Message envoyé : ton coach le reçoit dans ses notifications.</p>' : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <a class="bouton secondaire" href="/aide" style="margin:0 0 10px">Un problème ? Demander de l'aide</a>
  <details class="carte ecrire-coach"${erreur ? ' open' : ''} style="margin:0 0 14px"><summary style="cursor:pointer;font-weight:700;list-style:none">✉️ Écrire au coach</summary>
    <form method="post" action="/remarques/ecrire" style="display:grid;gap:10px;margin-top:10px">
      <textarea name="texte" maxlength="4000" required placeholder="Ta question, ta demande… Ton coach te répond ici, dans tes remarques."></textarea>
      <div data-images="/api/parcours/image"><label class="fichier">${ICONE.plus}<span><b>Joindre des images</b><br>Captures (facultatif)</span><input type="file" accept="image/*" multiple hidden></label>
        <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>
      <button class="bouton" type="submit" style="margin:0">Envoyer au coach</button></form>
    ${envoyes.length ? `<div style="display:grid;gap:6px;margin-top:12px"><b class="petit">Mes derniers messages</b>${envoyes.slice(0, 5).map((m) => `<div class="doux petit" style="border-left:2px solid #333;padding-left:10px">
      <span>${echapper(new Date(m.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }))} · ${m.traite_le ? 'répondu' : m.lu_le ? 'lu par le coach' : 'envoyé'}</span>
      <p style="margin:2px 0 0;color:#ddd;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${echapper(m.texte)}</p></div>`).join('')}</div>` : ''}
  </details>
  ${remarques.length ? listeRemarques(remarques) : '<p class="vide-traiter">Pas encore de remarque.</p>'}`, espace, 'remarques');
}
// Coach : un message reçu d'un élève, et sa réponse.
function pageMessageRecu(config, { espace, m, nom, fait }) {
  const p = m.parcours || {};
  return page('Message reçu', `${STYLE_MESSAGES}<a class="retour" href="/admin/a-traiter"><span aria-hidden="true">‹</span> À traiter</a>
  <div class="titre-page"><div><p class="etiquette">Message d'un élève</p><h1><a href="/admin/membres/${encodeURIComponent(m.discord_id)}" style="color:inherit">${echapper(nom)}</a></h1></div>
    <span class="doux petit">${echapper(dateCourte(m.cree_le))} GMT${m.traite_le ? ' · traité' : ''}</span></div>
  ${fait ? '<p class="message-ok">Réponse envoyée : il la voit dans ses Remarques, et Bob l\'a prévenu.</p>' : ''}
  <div class="carte" style="max-width:640px">${m.sujet ? `<p class="etiquette" style="margin:0 0 6px">${echapper(m.sujet)}</p>` : ''}<p style="margin:0;white-space:pre-line">${echapper(m.texte)}</p>
    ${m.images.length ? `<div class="images" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${m.images.map((x) => `<a href="/fichiers/images/${echapper(x)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(x)}" alt="" style="max-height:180px;border-radius:12px"></a>`).join('')}</div>` : ''}
    <p class="doux petit" style="margin:10px 0 0">${p.pseudo ? `@${echapper(p.pseudo)} · ` : ''}étape ${p.etape >= 5 ? 'GOAT' : p.etape || '?'} · <a href="/admin/membres/${encodeURIComponent(m.discord_id)}">Voir sa fiche</a></p></div>
  <h2 style="font-size:16px;margin:18px 0 0">Répondre</h2>
  ${formulaireMessage({ pour: { id: m.discord_id, nom }, action: `/admin/messages-recus/${m.id}/repondre`, ouvert: true })}
  ${m.traite_le ? '' : `<form method="post" action="/admin/messages-recus/${m.id}/traite" style="max-width:640px;margin-top:10px"><button class="bouton secondaire" type="submit" style="margin:0">Marquer comme traité, sans répondre</button></form>`}`,
  espace, 'traiter');
}

// ---------- Annonces du coach ----------
const STYLE_ANNONCE = `<style>
  .annonce { position:relative; margin:0 0 16px; border-radius:20px; overflow:hidden; background:#121212; border:1px solid #2a2a2a; }
  .annonce img { display:block; width:100%; max-height:220px; object-fit:cover; }
  .annonce .corps { padding:14px 16px 16px; } .annonce .etiquette { margin:0 0 4px; color:#c8f23a; }
  .annonce h2 { margin:0 34px 6px 0; font-size:17px; } .annonce p { margin:0; color:#cfcfcf; font-size:14px; white-space:pre-line; }
  .annonce .bouton { margin-top:12px; }
  .annonce .fermer { position:absolute; top:10px; right:10px; width:32px; height:32px; border-radius:50%; border:0; background:rgba(0,0,0,.6); color:#fff; font:400 20px/1 var(--police); cursor:pointer; }
</style>`;
// La dernière annonce (7 jours), en haut de Mon profil ; « × » la masque sur ce téléphone.
function carteAnnonce(a) {
  if (!a) return '';
  return `${STYLE_ANNONCE}<section class="annonce" data-annonce="${a.id}">
    <button class="fermer" type="button" aria-label="Masquer l'annonce">×</button>
    ${a.image ? `<img src="/fichiers/images/${echapper(a.image)}" alt="">` : ''}
    <div class="corps"><p class="etiquette">Annonce du coach</p><h2>${echapper(a.titre)}</h2><p>${echapper(a.texte)}</p>
    ${a.lien ? `<a class="bouton" href="${echapper(a.lien)}"${a.lien.startsWith('/') ? '' : ' target="_blank" rel="noopener"'}>Ouvrir</a>` : ''}</div></section>
  <script>(function () { var c = document.querySelector('[data-annonce]'); if (!c) return; var k = 'ovx-annonce-' + c.getAttribute('data-annonce');
    try { if (localStorage.getItem(k)) { c.remove(); return; } } catch (e) {}
    c.querySelector('.fermer').onclick = function () { try { localStorage.setItem(k, '1'); } catch (e) {} c.remove(); }; })();</script>`;
}
const SCRIPT_ANNONCE = `(function () {
  var f = document.getElementById('form-annonce'); if (!f) return;
  var zone = document.getElementById('zone-lien'), ajouter = document.getElementById('ajouter-lien');
  ajouter.onclick = function () { zone.hidden = false; ajouter.hidden = true; f.lien.focus(); };
  document.getElementById('retirer-lien').onclick = function () { f.lien.value = ''; zone.hidden = true; ajouter.hidden = false; };
  f.addEventListener('submit', function (e) { if (f.notifier.checked && !confirm('Publier et envoyer une notification à ' + f.getAttribute('data-n') + ' élève(s) ?')) e.preventDefault(); });
  // Couleur dominante : la moyenne du côté gauche de l'image (là où s'écrit le texte).
  var apercus = f.querySelector('.apercus');
  new MutationObserver(function () {
    var img = apercus.querySelector('img'); if (!img) return;
    var calc = function () {
      try {
        var c = document.createElement('canvas'), w = 40, h = 20; c.width = w; c.height = h;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, img.naturalWidth * 0.3, img.naturalHeight, 0, 0, w, h);
        var d = x.getImageData(0, 0, w, h).data, r = 0, g = 0, b = 0, n = d.length / 4;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        var hex = function (v) { return ('0' + Math.round(v / n).toString(16)).slice(-2); };
        f.couleur.value = '#' + hex(r) + hex(g) + hex(b);
      } catch (e) {}
    };
    if (img.complete) calc(); else img.onload = calc;
  }).observe(apercus, { childList: true });
})();`;
// Planifier (coach) : trois onglets. Événement (bannière, notification facultative), Remarque à un élève, Message à tous les élèves.
const STYLE_PLANIFIER = `<style>
  .pl-onglets { display:grid; grid-template-columns:repeat(2, 1fr); gap:4px; padding:4px; border-radius:999px; background:var(--surface-2,#151515); margin:0 0 16px; max-width:640px; }
  .pl-onglets a { padding:10px 6px; border-radius:999px; color:var(--doux); font-weight:700; font-size:13.5px; text-decoration:none; text-align:center; }
  .pl-onglets a[aria-current] { background:#fff; color:#000; }
  .pl-ecrire > summary { list-style:none; cursor:pointer; text-align:center; } .pl-ecrire > summary::-webkit-details-marker { display:none; }
  .pl-ecrire[open] > summary { background:transparent; color:#fff; border:1px solid var(--bord-fort); }
</style>`;
const dateCourte = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
// Choix des destinataires : la liste des élèves à cocher, une recherche par nom, « Tout sélectionner ».
function choixDestinataires(eleves, choisis = []) {
  const coches = new Set(choisis.map(String));
  return `<div class="ds">
    <button class="bouton secondaire ds-ouvrir" type="button" style="margin:0">Sélectionner les destinataires</button>
    <p class="doux petit ds-resume" style="margin:6px 0 0">Aucun destinataire.</p>
    <dialog class="fenetre ds-fenetre" aria-label="Destinataires"><div class="ds-boite">
      <div class="ds-haut"><b>Destinataires</b><button class="bouton ds-ok" type="button" style="margin:0;width:auto">OK</button></div>
      <input class="ds-cherche" type="search" placeholder="Rechercher un élève…" autocomplete="off">
      <label class="ds-ligne ds-tous"><input type="checkbox" class="ds-tout"> <b>Tout sélectionner</b></label>
      <div class="ds-liste">${eleves.map((e) => `<label class="ds-ligne" data-nom="${echapper(`${e.nom} ${e.pseudo || ''}`.toLowerCase())}">
        <input type="checkbox" name="ids" value="${echapper(e.id)}"${coches.has(String(e.id)) ? ' checked' : ''}>
        <span><b>${echapper(e.nom)}</b><small>${e.pseudo ? `@${echapper(e.pseudo)} · ` : ''}étape ${e.etape >= 5 ? 'GOAT' : e.etape}</small></span></label>`).join('') || '<p class="doux">Aucun élève Elite.</p>'}</div>
    </div></dialog></div>`;
}
const SCRIPT_DESTINATAIRES = `(function () {
  document.querySelectorAll('.ds').forEach(function (d) {
    var f = d.querySelector('dialog'), boites = d.querySelectorAll('.ds-liste input'), tout = d.querySelector('.ds-tout'), cherche = d.querySelector('.ds-cherche'), resume = d.querySelector('.ds-resume');
    var maj = function () {
      var c = [].filter.call(boites, function (b) { return b.checked; });
      var noms = c.map(function (b) { return b.parentNode.querySelector('b').textContent; });
      resume.textContent = c.length ? c.length + ' destinataire' + (c.length > 1 ? 's' : '') + ' : ' + noms.slice(0, 4).join(', ') + (noms.length > 4 ? '…' : '') : 'Aucun destinataire.';
      d.querySelector('.ds-ouvrir').textContent = c.length ? 'Destinataires (' + c.length + ')' : 'Sélectionner les destinataires';
      var visibles = [].filter.call(boites, function (b) { return !b.closest('label').hidden; });
      tout.checked = visibles.length > 0 && visibles.every(function (b) { return b.checked; });
    };
    d.querySelector('.ds-ouvrir').onclick = function () { f.showModal(); };
    d.querySelector('.ds-ok').onclick = function () { f.close(); };
    f.addEventListener('click', function (e) { if (e.target === f) f.close(); });
    boites.forEach(function (b) { b.addEventListener('change', maj); });
    tout.addEventListener('change', function () { boites.forEach(function (b) { if (!b.closest('label').hidden) b.checked = tout.checked; }); maj(); });
    cherche.addEventListener('input', function () { var v = cherche.value.trim().toLowerCase();
      boites.forEach(function (b) { var l = b.closest('label'); l.hidden = Boolean(v) && l.getAttribute('data-nom').indexOf(v) < 0; }); maj(); });
    var form = d.closest('form'); if (form) form.addEventListener('submit', function (e) {
      if (![].some.call(boites, function (b) { return b.checked; })) { e.preventDefault(); f.showModal(); return; }
      var n = [].filter.call(boites, function (b) { return b.checked; }).length;
      if (n > 1 && !confirm('Envoyer ce message à ' + n + ' élèves ?')) e.preventDefault(); });
    maj();
  });
})();`;
const STYLE_MESSAGES = `<style>
  .ds-fenetre { width:min(520px, calc(100vw - 24px)); max-height:min(640px, calc(100dvh - 40px)); padding:0; }
  .ds-boite { display:flex; flex-direction:column; gap:10px; padding:16px; max-height:inherit; box-sizing:border-box; }
  .ds-haut { display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .ds-liste { overflow:auto; display:grid; gap:2px; min-height:120px; }
  .ds-ligne { display:flex; gap:12px; align-items:center; padding:8px; margin:0 !important; border-radius:12px; cursor:pointer; font-weight:400; }
  .ds-ligne span b { font-size:15px; } .ds-ligne span small { margin:0; }
  .ds-ligne:hover { background:rgba(255,255,255,.05); } .ds-ligne[hidden] { display:none; }
  .ds-ligne input { width:20px; height:20px; margin:0; flex:none; accent-color:#c8f23a; }
  .ds-ligne span { display:grid; } .ds-ligne small { color:var(--doux); font-size:12.5px; }
  .ds-tous { border-bottom:1px solid var(--bord,#222); border-radius:0; }
  .msg-envoi .titre-msg { display:block; font-weight:800; font-size:15px; color:#fff; }
  .accuses { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .accuses details { position:relative; } .accuses summary { display:inline-block; list-style:none; cursor:pointer; padding:5px 11px; border-radius:999px; background:rgba(255,255,255,.07); font-weight:700; font-size:13.5px; }
  .accuses summary::-webkit-details-marker { display:none; } .accuses details[open] summary { background:#fff; color:#000; }
  .accuses .qui-liste { margin:8px 0 0; padding:10px 12px; border-radius:12px; background:var(--surface-2,#151515); font-size:13.5px; display:grid; gap:4px; min-width:180px; }
  .accuses .qui-liste a { color:#fff; }
</style>`;
const accuse = (emoji, libelle, liste, id) => `<details><summary title="${libelle}">${emoji} ${liste.length}</summary>
  <div class="qui-liste"><b>${libelle}</b>${liste.map((d) => `<a href="/admin/membres/${encodeURIComponent(d.id)}">${echapper(d.nom)}${d.pseudo ? ` <span class="doux">@${echapper(d.pseudo)}</span>` : ''}</a>`).join('') || '<span class="doux">Personne.</span>'}</div></details>`;
function carteEnvoi(e) {
  const pasLus = e.destinataires.filter((d) => !d.lu);
  return `<details class="remarque compacte msg-envoi">
    <summary><span class="qui">${echapper(dateCourte(e.modifie_le || e.cree_le))} GMT${e.modifie_le ? ' · modifié' : ''} · ${e.destinataires.length === 1 ? echapper(e.destinataires[0].nom) : `${e.destinataires.length} élèves`}${e.images.length ? ` · ${e.images.length} image(s)` : ''}</span>
      ${e.titre ? `<b class="titre-msg">${echapper(e.titre)}</b>` : ''}<span class="apercu">${echapper(texteSimple(e.texte))}</span></summary>
    <p>${texteRicheAnnonce(e.texte)}</p>
    ${e.images.length ? `<div class="images">${e.images.map((x) => `<a href="/fichiers/images/${echapper(x)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(x)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
    <div class="accuses">${accuse('👎', 'Non délivré', e.nonLivres)}${accuse('👍', 'Délivré, pas encore lu', e.livres)}${accuse('👁️', 'Lu', e.lus)}${e.enCours.length ? accuse('⏳', 'Envoi en cours', e.enCours) : ''}</div>
    ${pasLus.length ? `<form method="post" action="/admin/messages/${e.id}/relancer" style="margin:10px 0 0" onsubmit="return confirm('Renvoyer une notification aux ${pasLus.length} élève(s) qui ne l\'ont pas lu ?')">
      <button class="bouton secondaire" type="submit" style="margin:0;width:auto">Relancer ceux qui ne l'ont pas lu (${pasLus.length})</button></form>` : ''}
    <details style="margin-top:10px"><summary class="doux petit" style="cursor:pointer">Modifier</summary>
      <form method="post" action="/admin/messages/${e.id}" style="display:grid;gap:8px;margin-top:8px">
        <input name="titre" maxlength="120" value="${echapper(e.titre || '')}" placeholder="Titre">
        ${barreMiseEnForme(`modif-${e.id}`)}<textarea id="modif-${e.id}" name="texte" maxlength="4000" required>${echapper(e.texte)}</textarea>
        <button class="bouton secondaire" type="submit" style="margin:0">Enregistrer la modification</button>
        <small class="doux">Ceux qui l'avaient déjà lu sont prévenus qu'il a changé.</small></form></details>
  </details>`;
}
// Le formulaire « Envoyer un message » : Planifier (plusieurs élèves) et fiche d'un élève (lui seul : `pour`).
function formulaireMessage({ eleves = [], choisis = [], pour = null, action = '/admin/planifier/message', ouvert = false, test = false, testTexte = null }) {
  const id = pour ? 'msg-texte-fiche' : 'msg-texte';
  const form = `<form class="carte" method="post" action="${action}" style="display:grid;gap:12px;max-width:640px;margin-top:10px">
      ${pour ? `<input type="hidden" name="ids" value="${echapper(pour.id)}"><p class="doux petit" style="margin:0">À <b>${echapper(pour.nom)}</b> : dans ses Remarques du coach, et Bob le prévient.</p>`
    : `<p class="doux petit" style="margin:0">Chaque élève le reçoit dans ses Remarques du coach (pastille rouge) et en notification (application ou Bob).</p>${choixDestinataires(eleves, choisis)}`}
      <div class="champ"><label for="${id}-titre">Titre</label><input id="${id}-titre" name="titre" maxlength="120" required placeholder="ex. Ton accroche peut être plus forte"></div>
      <div class="champ"><label for="${id}">Message</label>${barreMiseEnForme(id)}<textarea id="${id}" name="texte" maxlength="4000" required placeholder="Ce qui va, ce qu'il faut changer… Sélectionne un mot puis G, I ou S pour le mettre en forme."></textarea></div>
      ${zoneImages()}
      <button class="bouton" type="submit" style="margin:0">Envoyer le message</button></form>`;
  return `${STYLE_MESSAGES}<details class="pl-ecrire" ${ouvert ? 'open' : ''}><summary class="bouton" style="max-width:640px">Écrire un message</summary>${form}</details>
    ${test ? `<details class="carte" style="max-width:640px;margin-top:12px"><summary style="cursor:pointer;font-weight:700">Tester une notification</summary>
      <form method="post" action="/admin/notifications/test" style="display:grid;gap:10px;margin-top:10px">
      <p class="doux petit" style="margin:0">Envoyée à ce seul compte : dans l'application ou par Bob, et rangée dans ses notifications.</p>
      ${testTexte ? `<p class="message-ok" style="margin:0">${echapper(testTexte)}</p>` : ''}
      <div style="display:flex;gap:8px"><input name="pseudo" placeholder="Pseudo Discord, ex. @ton_compte_test" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="41" required>
        <button class="bouton secondaire" type="submit" style="margin:0;width:auto;white-space:nowrap">Envoyer un test</button></div></form></details>` : ''}`;
}
function pageAnnonces(config, { espace, annonces = [], nbEleves = 0, eleves = [], envois = [], choisis = [], onglet = 'evenement', message, erreur, test, maintenant = new Date().toISOString() }) {
  const fin7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const estMessage = (a) => a.fin_le && a.fin_le === a.cree_le; // message seul : jamais dans la bannière
  const enCours = (a) => !estMessage(a) && (a.fin_le ? a.fin_le > maintenant : a.cree_le > new Date(Date.now() - 7 * 864e5).toISOString());
  const recu = (a) => (a.notifier === 0 ? 'sans notification' : a.envoyes === null ? 'envoi en cours…' : `reçu par ${a.envoyes} / ${a.destinataires}`);
  const onglets = `<nav class="pl-onglets" aria-label="Planifier">${[['evenement', 'Événement'], ['message', 'Envoyer un message']]
    .map(([c, l]) => `<a href="/admin/planifier${c === 'evenement' ? '' : `?onglet=${c}`}"${onglet === c ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const lien = `<button id="ajouter-lien" class="bouton secondaire" type="button" style="margin:0;width:auto;justify-self:start">+ Ajouter un lien</button>
    <div id="zone-lien" class="champ" hidden><label for="lien">Lien</label>
      <div style="display:flex;gap:8px"><input id="lien" name="lien" inputmode="url" placeholder="https://… ou une page du site : /parcours/etape-4">
      <button id="retirer-lien" class="bouton secondaire" type="button" style="margin:0;width:auto">Retirer</button></div>
      <small>Une page du site (/parcours, /coaching…) ouvre l'espace de chaque élève, déjà connecté.</small></div>`;
  let corps;
  if (onglet === 'message') {
    corps = formulaireMessage({ eleves, choisis, test: true, testTexte: test, ouvert: Boolean(erreur || choisis.length) }) + `
    <h2 style="font-size:16px;margin:22px 0 4px">Messages envoyés</h2>
    <p class="doux petit" style="margin:0 0 10px">👎 non délivré · 👍 délivré · 👁️ lu. Touche un nombre pour voir qui. Tu peux modifier un message, pas le supprimer.</p>
    <div class="remarques-liste${envois.length > 3 ? ' repliee' : ''}" style="max-width:640px">${envois.map(carteEnvoi).join('') || '<p class="vide-traiter">Aucun message pour le moment.</p>'}</div>
    ${envois.length > 3 ? `<button class="bouton secondaire tout-afficher" type="button" style="max-width:640px" onclick="var l=this.previousElementSibling;l.classList.remove('repliee');this.remove();">Tout afficher (${envois.length})</button>` : ''}`;
  } else {
    const evenements = annonces.filter((a) => !estMessage(a));
    corps = `<p class="doux" style="max-width:640px;margin:0 0 12px">Chaque événement s'affiche dans la bannière en haut des pages des élèves (plusieurs : elles défilent).
      Image au format <b>16:5</b> (par exemple 1600 × 500 px), sans texte : le titre s'écrit à gauche, sur la couleur dominante.</p>
    <form id="form-annonce" class="carte" method="post" action="/admin/annonces" data-n="${nbEleves}" style="display:grid;gap:12px;max-width:640px">
      <div class="champ"><label for="titre">Titre</label><input id="titre" name="titre" maxlength="120" required placeholder="ex. Live de groupe ce soir à 21 h"></div>
      <div class="champ"><label for="texte">Message</label><textarea id="texte" name="texte" maxlength="1800" required placeholder="Colle ton texte ici."></textarea></div>
      ${lien}
      <div data-images="/admin/images" data-une>
        <label class="fichier">${ICONE.plus}<span><b>Ajouter une image</b><br>Format 16:5, sans texte (facultatif)</span><input type="file" accept="image/*" hidden></label>
        <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:end">
        <div class="champ"><label for="couleur">Couleur dominante</label><input id="couleur" name="couleur" type="color" value="#1a1a1a" style="width:64px;height:44px;padding:2px"></div>
        <div class="champ"><label for="fin">Afficher jusqu'au</label><input id="fin" name="fin" type="date" value="${fin7}"></div>
      </div>
      <small class="doux" style="margin-top:-6px">La couleur se règle toute seule d'après le côté gauche de l'image ; tu peux la changer.</small>
      <label style="display:flex;gap:10px;align-items:center;font-weight:600"><input type="checkbox" name="notifier" value="1" checked style="width:auto;margin:0"> Envoyer aussi une notification à tous les élèves</label>
      <button class="bouton" type="submit" style="margin:0">Publier</button></form>
    <h2 style="font-size:16px;margin:22px 0 10px">Événements publiés</h2>
    <div style="display:grid;gap:8px;max-width:640px">${evenements.map((a) => `<div class="carte" style="margin:0"><b>${echapper(a.titre)}</b>
      <p class="doux petit" style="margin:4px 0 0">${echapper(dateCourte(a.cree_le))} GMT ·
      ${enCours(a) ? 'dans la bannière' : 'terminé'} · ${recu(a)}${a.lien ? ` · lien : ${echapper(a.lien)}` : ''}${a.image ? ' · avec image' : ''}</p>
      ${enCours(a) ? `<form method="post" action="/admin/annonces/${a.id}/retirer" style="margin:8px 0 0"><button class="bouton secondaire" type="submit" style="margin:0;width:auto">Retirer de la bannière</button></form>` : ''}</div>`).join('') || '<p class="vide-traiter">Aucun événement pour le moment.</p>'}</div>`;
  }
  return page('Planifier', `${STYLE_PLANIFIER}
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Planifier</h1></div><span class="doux petit">${nbEleves} élève(s) Elite</span></div>
  ${onglets}
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${corps}`, espace, 'planifier', null, SCRIPT_ANNONCE + SCRIPT_DESTINATAIRES);
}

// Gestion (coach) : Planifier, Élèves Elite et Ressources, en cases côte à côte (la barre du bas reste courte).
function pageGestion(config, { espace, nbEleves = 0, evenements = 0, ressources = 0, aValider = 0, aCompleter = 0, serveurGratuit = null }) {
  const tuile = (lien, titre, ligne, texte, alerte) => `<a class="pf-carte" href="${lien}" style="min-height:140px"><h3>${titre}</h3>
    <p class="vert">${ligne}</p><p>${texte}</p>${alerte ? `<p style="color:#ffb35c;font-weight:700;margin-top:6px">${alerte}</p>` : ''}</a>`;
  return page('Gestion', `${STYLE_PROFIL}
  <div class="titre-page"><div><p class="etiquette">Coach</p><h1>Gestion</h1></div></div>
  <div class="pf"><div class="pf-cartes" style="grid-template-columns:1fr 1fr">
    ${tuile('/admin/planifier', 'Planifier', `${evenements} événement(s) en cours`, 'Événements, messages aux élèves, accusés de lecture.')}
    ${tuile('/admin/eleves', 'Gérer les élèves', `${nbEleves} élève(s)`, 'Kanban par étape, ou liste triable.', aCompleter ? `${aCompleter} à compléter` : '')}
    ${espace.ressources ? tuile('/ressources', 'Ressources', `${ressources} publiée(s)`, 'Niches, méthodes 10K, tutoriels.', aValider ? `${aValider} proposition(s) à relire` : '') : ''}
    ${tuile('/notifications?onglet=rappels', 'Mes rappels', 'Tes rappels', 'Une fois, chaque jour ou certains jours.')}
  </div>
  ${serveurGratuit ? `<div class="carte" style="margin-top:14px"><div class="envoi-tete"><h2>Serveur gratuit (ancien serveur)</h2>
      <span class="etat" data-etat="${serveurGratuit.actif ? 'valide' : 'attente'}">${serveurGratuit.actif ? 'Actif' : 'Pas encore'}</span></div>
    <p class="doux" style="margin:8px 0 0">${serveurGratuit.actif
    ? 'Les candidats et les membres dont l\'accès a expiré y vont ; le serveur des membres est réservé à ceux qui ont payé (Community, Elite).'
    : 'Invite Bob sur l\'ancien serveur : il le reconnaît tout seul, y crée une invitation, et s\'en sert comme serveur gratuit / d\'attente.'}</p>
    ${serveurGratuit.invitationBob && !serveurGratuit.actif ? `<a class="bouton" href="${echapper(serveurGratuit.invitationBob)}" target="_blank" rel="noopener">Inviter Bob sur l'ancien serveur</a>` : ''}
    ${serveurGratuit.lien ? `<p class="doux petit" style="margin:8px 0 0">Lien public : ${echapper(serveurGratuit.lien)}</p>` : ''}</div>` : ''}
  </div>`, espace, 'gestion');
}

// Profil du coach : sa pièce dorée, ses chiffres, les raccourcis et ses meilleurs élèves.
function pageCoach(config, { espace, pseudo, avatar, nbEleves, aTraiter, faites = 0, seancesAujourdhui, seancesFaites = 0, top = [], aLaUne = [] }) {
  const nom = pseudo || 'Coach';
  const barre = (titre, fait, total, lien, vide, pleineSiVide) => `<a class="pf-objectif-barre" href="${lien}">
    <span class="haut"><span>${titre}</span><b>${total ? `${fait} / ${total}` : vide}</b></span>
    <span class="barre"><i style="width:${total ? Math.round((fait / total) * 100) : pleineSiVide ? 100 : 0}%"></i></span></a>`;
  return page('Mon profil', `${STYLE_PROFIL}${STYLE_ROLES}
  <div class="pf">
    <div class="pf-cols"><div class="pf-g">
    <div class="pf-identite" style="margin-top:6px">
      <span class="pf-avatar piece" style="--piece:#f5c518"><span class="face">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</span></span>
      <h1>${echapper(nom)}</h1><p>Coach Overmaxx</p>
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.jours}${nbEleves}</b><small>Élèves</small></div><span class="sep"></span>
      <div><b>${aTraiter}</b><small>À traiter</small></div><span class="sep"></span>
      <div><b>${seancesAujourdhui}</b><small>Coachings auj.</small></div>
    </div>
    <h2 class="section">Aujourd'hui</h2>
    ${barre('Tâches du jour', faites, faites + aTraiter, '/admin/a-traiter', 'Rien à traiter', true)}
    ${barre('Coachings du jour', seancesFaites, seancesAujourdhui, '/admin', 'Aucun coaching')}
    </div><div class="pf-d">
    <div class="pf-cartes" style="grid-template-columns:1fr 1fr">
      <a class="pf-carte" href="#a-la-une"><h3>À la une</h3><p class="vert">${aLaUne.length} résultat(s)</p><p>Les meilleurs résultats de tes élèves, 7 derniers jours.</p></a>
      <a class="pf-carte" href="/classement"><h3>Classement</h3><p class="vert">${top.length ? `1er : ${echapper(top[0].nom)}` : 'Top 100'}</p><p>Tous les élèves, par revenus.</p></a>
    </div>
    <h2 class="section" id="a-la-une">À la une</h2>
    <div class="cm-liste">${aLaUne.map((x) => `<a class="cm-ligne" href="/admin/resultats/${x.id}" style="color:#fff;text-decoration:none"><span class="rond">${echapper(x.nom.charAt(0).toUpperCase())}</span>
      <div class="qui"><b>${echapper(x.nom)}</b><small>${dollars(x.revenus)} · ${vuesCourtes(x.vues)} vues · vidéo du ${echapper(jourLisible(x.jour))}</small></div></a>`).join('') || '<p class="vide-traiter">Pas encore de résultat validé cette semaine.</p>'}</div>
    <h2 class="section">Meilleurs élèves</h2>
    <div class="cm-liste">${top.map((m, i) => `<a class="cm-ligne" href="/classement/${encodeURIComponent(m.id)}" style="color:#fff;text-decoration:none"><span class="rond">${i + 1}</span>
      <div class="qui"><b>${echapper(m.nom)}</b><small>${dollars(m.revenus, { centimes: false })} · ${vuesCourtes(m.vues)} vues</small></div></a>`).join('') || '<p class="vide-traiter">Pas encore de résultats.</p>'}</div>
    </div></div>
  </div>${STYLE_COMMU}`, espace, 'coach');
}

module.exports = { pageProfilPublic, pageTrophees, pageGestion, pageMessageRecu, formulaireMessage, SCRIPT_DESTINATAIRES, carteAnnonce, pageAnnonces, pageCoach, pageMonProfil, pageCommunaute, pageRemarques, pageRevenus, pageReglages, FLAMME };
