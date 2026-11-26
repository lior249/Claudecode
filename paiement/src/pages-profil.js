'use strict';

// Mon profil (page d'accueil des élèves Elite) : photo, 3 chiffres, la roue des jours (chaque jour : sa fiche,
// son résultat), la chaîne 🔥, ceux qu'il suit, la tâche du moment ; puis le tableau de bord des revenus.
// Et la page Communauté : suivis (10 places), concurrents (3), invitations, suggestions.
const { echapper } = require('./pages');
const { page, remarque, listeRemarques, blocTableau, SCRIPT_TABLEAU, dollars, fenetreAFaire, frise, texteRicheAnnonce } = require('./pages-parcours');
const { ICONE } = require('./pages');
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
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
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
  .pf-menu { cursor:pointer; }
  @media (max-width: 959px) { .pf-doublon { display:none; } }
  @media (min-width: 960px) { .pf-menu { display:none; } }
  .pf-icone .compteur { position:absolute; top:-3px; right:-9px; min-width:19px; height:19px; padding:0 5px; border-radius:10px; background:#ff3b30; color:#fff;
    font:800 11px/19px var(--police); text-align:center; border:2px solid #000; box-sizing:content-box; }
  /* La photo dans une pièce de monnaie : bord cranté de la couleur du rang, sans brillance fixe ;
     seul un reflet passe, du coin bas gauche au coin haut droit, découpé à la forme de la pièce. */
  .pf-avatar.piece { position:relative; width:104px; height:104px; padding:6px; border:0; border-radius:50%; isolation:isolate;
    clip-path:polygon(100.00% 50.00%,98.68% 51.27%,99.93% 52.62%,98.55% 53.82%,99.73% 55.23%,98.28% 56.36%,99.38% 57.82%,97.88% 58.87%,98.91% 60.40%,97.35% 61.37%,98.30% 62.94%,96.69% 63.83%,97.55% 65.45%,95.91% 66.26%,96.68% 67.92%,94.99% 68.64%,95.68% 70.34%,93.96% 70.97%,94.55% 72.70%,92.80% 73.24%,93.30% 75.00%,91.52% 75.45%,91.93% 77.23%,90.13% 77.58%,90.45% 79.39%,88.64% 79.65%,88.86% 81.47%,87.03% 81.63%,87.16% 83.46%,85.33% 83.52%,85.36% 85.36%,83.52% 85.33%,83.46% 87.16%,81.63% 87.03%,81.47% 88.86%,79.65% 88.64%,79.39% 90.45%,77.58% 90.13%,77.23% 91.93%,75.45% 91.52%,75.00% 93.30%,73.24% 92.80%,72.70% 94.55%,70.97% 93.96%,70.34% 95.68%,68.64% 94.99%,67.92% 96.68%,66.26% 95.91%,65.45% 97.55%,63.83% 96.69%,62.94% 98.30%,61.37% 97.35%,60.40% 98.91%,58.87% 97.88%,57.82% 99.38%,56.36% 98.28%,55.23% 99.73%,53.82% 98.55%,52.62% 99.93%,51.27% 98.68%,50.00% 100.00%,48.73% 98.68%,47.38% 99.93%,46.18% 98.55%,44.77% 99.73%,43.64% 98.28%,42.18% 99.38%,41.13% 97.88%,39.60% 98.91%,38.63% 97.35%,37.06% 98.30%,36.17% 96.69%,34.55% 97.55%,33.74% 95.91%,32.08% 96.68%,31.36% 94.99%,29.66% 95.68%,29.03% 93.96%,27.30% 94.55%,26.76% 92.80%,25.00% 93.30%,24.55% 91.52%,22.77% 91.93%,22.42% 90.13%,20.61% 90.45%,20.35% 88.64%,18.53% 88.86%,18.37% 87.03%,16.54% 87.16%,16.48% 85.33%,14.64% 85.36%,14.67% 83.52%,12.84% 83.46%,12.97% 81.63%,11.14% 81.47%,11.36% 79.65%,9.55% 79.39%,9.87% 77.58%,8.07% 77.23%,8.48% 75.45%,6.70% 75.00%,7.20% 73.24%,5.45% 72.70%,6.04% 70.97%,4.32% 70.34%,5.01% 68.64%,3.32% 67.92%,4.09% 66.26%,2.45% 65.45%,3.31% 63.83%,1.70% 62.94%,2.65% 61.37%,1.09% 60.40%,2.12% 58.87%,0.62% 57.82%,1.72% 56.36%,0.27% 55.23%,1.45% 53.82%,0.07% 52.62%,1.32% 51.27%,0.00% 50.00%,1.32% 48.73%,0.07% 47.38%,1.45% 46.18%,0.27% 44.77%,1.72% 43.64%,0.62% 42.18%,2.12% 41.13%,1.09% 39.60%,2.65% 38.63%,1.70% 37.06%,3.31% 36.17%,2.45% 34.55%,4.09% 33.74%,3.32% 32.08%,5.01% 31.36%,4.32% 29.66%,6.04% 29.03%,5.45% 27.30%,7.20% 26.76%,6.70% 25.00%,8.48% 24.55%,8.07% 22.77%,9.87% 22.42%,9.55% 20.61%,11.36% 20.35%,11.14% 18.53%,12.97% 18.37%,12.84% 16.54%,14.67% 16.48%,14.64% 14.64%,16.48% 14.67%,16.54% 12.84%,18.37% 12.97%,18.53% 11.14%,20.35% 11.36%,20.61% 9.55%,22.42% 9.87%,22.77% 8.07%,24.55% 8.48%,25.00% 6.70%,26.76% 7.20%,27.30% 5.45%,29.03% 6.04%,29.66% 4.32%,31.36% 5.01%,32.08% 3.32%,33.74% 4.09%,34.55% 2.45%,36.17% 3.31%,37.06% 1.70%,38.63% 2.65%,39.60% 1.09%,41.13% 2.12%,42.18% 0.62%,43.64% 1.72%,44.77% 0.27%,46.18% 1.45%,47.38% 0.07%,48.73% 1.32%,50.00% 0.00%,51.27% 1.32%,52.62% 0.07%,53.82% 1.45%,55.23% 0.27%,56.36% 1.72%,57.82% 0.62%,58.87% 2.12%,60.40% 1.09%,61.37% 2.65%,62.94% 1.70%,63.83% 3.31%,65.45% 2.45%,66.26% 4.09%,67.92% 3.32%,68.64% 5.01%,70.34% 4.32%,70.97% 6.04%,72.70% 5.45%,73.24% 7.20%,75.00% 6.70%,75.45% 8.48%,77.23% 8.07%,77.58% 9.87%,79.39% 9.55%,79.65% 11.36%,81.47% 11.14%,81.63% 12.97%,83.46% 12.84%,83.52% 14.67%,85.36% 14.64%,85.33% 16.48%,87.16% 16.54%,87.03% 18.37%,88.86% 18.53%,88.64% 20.35%,90.45% 20.61%,90.13% 22.42%,91.93% 22.77%,91.52% 24.55%,93.30% 25.00%,92.80% 26.76%,94.55% 27.30%,93.96% 29.03%,95.68% 29.66%,94.99% 31.36%,96.68% 32.08%,95.91% 33.74%,97.55% 34.55%,96.69% 36.17%,98.30% 37.06%,97.35% 38.63%,98.91% 39.60%,97.88% 41.13%,99.38% 42.18%,98.28% 43.64%,99.73% 44.77%,98.55% 46.18%,99.93% 47.38%,98.68% 48.73%);
    background:repeating-conic-gradient(from 0deg, var(--piece) 0deg 1.5deg, color-mix(in srgb, var(--piece) 75%, #000) 1.5deg 3deg); }
  .pf-avatar.piece .face { position:relative; z-index:1; display:block; width:100%; height:100%; border-radius:50%; overflow:hidden;
    box-shadow:0 0 0 2px color-mix(in srgb, var(--piece) 55%, #000); }
  .pf-avatar.piece::after { content:""; position:absolute; inset:0; z-index:2; pointer-events:none;
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
      <a class="bouton${d.e === 'corriger' ? '' : ' secondaire'}" href="/parcours/compte-rendu/${d.j}">${d.e === 'corriger' ? 'Corriger mon compte rendu' : 'Voir mon compte rendu'}</a>`;
  } else if (d.e === 'publie') {
    corps = `<p>${d.n} vidéo${d.n > 1 ? 's' : ''} publiée${d.n > 1 ? 's' : ''}, compte rendu pas encore envoyé.</p><a class="bouton" href="/parcours/compte-rendu/${d.j}">Faire mon compte rendu</a>`;
  } else corps = d.etape4 ? '<p>Aucune vidéo déclarée ce jour-là.</p>' : '<p>Rien à faire ce jour-là : tes tâches sont celles d\'aujourd\'hui.</p>';
  return `<section class="jour-panneau" data-jour="${d.j}"${d.aujourdhui ? '' : ' hidden'}><h2>${echapper(titre)}</h2>${corps}${d.futur ? '' : encourage}</section>`;
}

// Pastille rouge : le nombre, jusqu'à 9+.
const compteur = (n) => (n ? `<span class="compteur">${n > 9 ? '9+' : n}</span>` : '');
// La couleur de la pièce (contour de la photo) : celle du rang Discord.
const couleurPiece = (role) => ({ goat: '#f5c518', 10000: '#f5c518', 5000: '#d9a21b', 1500: '#ee8a2d', elite: '#5b6cff', membre: '#57d17a', sinistre: '#e5484d' })[role] || '#5b6cff';
// Prochain objectif : la barre de progression (ouvre Mes revenus).
function barreObjectif(objectif, total) {
  if (!objectif) return '';
  const pct = Math.min(100, Math.round((total / objectif.montant) * 100));
  return `<a class="pf-objectif-barre" href="/revenus" aria-label="Prochain objectif : ${pct} %">
    <span class="haut"><span>Prochain objectif</span><b>${dollars(objectif.montant, { centimes: false })}</b></span>
    <span class="barre"><i style="width:${pct}%"></i></span><span class="bas">${dollars(total)} · ${pct} %</span></a>`;
}
function pageMonProfil(config, { espace, parcours: p, prenom, avatar, stats, role, jourDepuis, jours, chaine, flamme, derniers7, tache, suivis, nbSuivis, nbConcurrents, invitations, notifications, rappel,
  rang, totalClasses, revenusMois, objectif, seances = [], remarquesNouvelles = 0, annonce }) {
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
    ${carteAnnonce(annonce)}
    <div class="pf-haut">
      <div class="pf-groupe">
        <label class="pf-icone pf-menu" for="menu-ouvert" aria-label="Ouvrir le menu">${ICONES.menu}</label>
        <a class="pf-icone pf-doublon" href="/notifications" aria-label="Notifications${notifications ? ` : ${notifications} non lue(s)` : ''}">${ICONES.cloche}${compteur(notifications)}</a>
        <a class="pf-icone pf-doublon" href="/remarques" aria-label="Remarques du coach${remarquesNouvelles ? ` : ${remarquesNouvelles} nouvelle(s)` : ''}">${ICONES.bulle}${compteur(remarquesNouvelles)}</a>
      </div>
      <div class="pf-groupe">
        <a class="pf-chaine" href="/parcours/etape-4" aria-label="Chaîne de ${chaine} jours">${FLAMME(flamme)}${chaine}</a>
        <a class="pf-icone" href="/reglages" aria-label="Réglages">${ICONES.reglages}</a>
      </div>
    </div>
    <div class="pf-identite">
      <a class="pf-avatar piece" style="--piece:${echapper(couleurPiece(p.sinistre_depuis ? 'sinistre' : role))}"${p.sinistre_depuis ? ' data-sinistre' : ''} href="/fiche" aria-label="Ma fiche">
        <span class="face">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</span></a>
      <h1>${echapper(nom)}</h1><p>@${echapper(p.pseudo || '')}</p>
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.revenus}${dollars(stats.revenusTotal || 0, { centimes: false })}</b><small>Revenus</small></div><span class="sep"></span>
      <div><b>${pastilleRole(p.sinistre_depuis ? 'sinistre' : role)}</b><small>Rang</small></div><span class="sep"></span>
      <div><b>${ICONES.jours}${jourDepuis}</b><small>Jours</small></div>
    </div>
    ${barreObjectif(objectif, stats.revenusTotal || 0)}
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
function pageRevenus(config, { espace, tableau, stats, objectif }) {
  const style = `<style>.pf-objectif-barre { display:block; margin:0 0 18px; padding:12px 14px; border-radius:16px; background:#101010; border:1px solid #222; color:#fff; text-decoration:none; max-width:640px; }
  .pf-objectif-barre .haut { display:flex; justify-content:space-between; font-size:13px; color:var(--doux); } .pf-objectif-barre .haut b { color:#fff; font-size:15px; }
  .pf-objectif-barre .barre { display:block; height:8px; margin:8px 0 6px; border-radius:999px; background:#262626; overflow:hidden; }
  .pf-objectif-barre .barre i { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg, #9fd11f, #c8f23a); } .pf-objectif-barre .bas { font-size:12px; color:var(--doux); }</style>`;
  return page('Mes revenus', `${style}<a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Mon profil</p><h1>Mes revenus</h1></div><span class="doux petit">Total validé : ${dollars((stats || {}).revenusTotal || 0)}</span></div>
  ${barreObjectif(objectif, (stats || {}).revenusTotal || 0)}
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
  ${remarques.length ? listeRemarques(remarques) : '<p class="vide-traiter">Pas encore de remarque.</p>'}`, espace, 'remarques');
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
  .pl-onglets { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; padding:4px; border-radius:999px; background:var(--surface-2,#151515); margin:0 0 16px; max-width:640px; }
  .pl-onglets a { padding:10px 6px; border-radius:999px; color:var(--doux); font-weight:700; font-size:13.5px; text-decoration:none; text-align:center; }
  .pl-onglets a[aria-current] { background:#fff; color:#000; }
  .pl-ecrire > summary { list-style:none; cursor:pointer; text-align:center; } .pl-ecrire > summary::-webkit-details-marker { display:none; }
  .pl-ecrire[open] > summary { background:transparent; color:#fff; border:1px solid var(--bord-fort); }
</style>`;
const dateCourte = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
function pageAnnonces(config, { espace, annonces = [], nbEleves = 0, eleves = [], remarques = [], onglet = 'evenement', message, erreur, test, maintenant = new Date().toISOString() }) {
  const fin7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const estMessage = (a) => a.fin_le && a.fin_le === a.cree_le; // message seul : jamais dans la bannière
  const enCours = (a) => !estMessage(a) && (a.fin_le ? a.fin_le > maintenant : a.cree_le > new Date(Date.now() - 7 * 864e5).toISOString());
  const recu = (a) => (a.notifier === 0 ? 'sans notification' : a.envoyes === null ? 'envoi en cours…' : `reçu par ${a.envoyes} / ${a.destinataires}`);
  const onglets = `<nav class="pl-onglets" aria-label="Planifier">${[['evenement', 'Événement'], ['remarque', 'Remarque'], ['message', 'Message à tous']]
    .map(([c, l]) => `<a href="/admin/planifier${c === 'evenement' ? '' : `?onglet=${c}`}"${onglet === c ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const lien = `<button id="ajouter-lien" class="bouton secondaire" type="button" style="margin:0;width:auto;justify-self:start">+ Ajouter un lien</button>
    <div id="zone-lien" class="champ" hidden><label for="lien">Lien</label>
      <div style="display:flex;gap:8px"><input id="lien" name="lien" inputmode="url" placeholder="https://… ou une page du site : /parcours/etape-4">
      <button id="retirer-lien" class="bouton secondaire" type="button" style="margin:0;width:auto">Retirer</button></div>
      <small>Une page du site (/parcours, /coaching…) ouvre l'espace de chaque élève, déjà connecté.</small></div>`;
  let corps;
  if (onglet === 'remarque') {
    corps = `<details class="pl-ecrire" ${erreur ? 'open' : ''}><summary class="bouton" style="max-width:640px">Écrire une remarque</summary>
      <form class="carte" method="post" action="/admin/planifier/remarque" style="display:grid;gap:12px;max-width:640px;margin-top:10px">
      <p class="doux petit" style="margin:0">Elle s'affiche dans ses Remarques du coach (pastille rouge sur sa bulle), et Bob le prévient.</p>
      <div class="champ"><label for="eleve">Élève</label><select id="eleve" name="eleve" required><option value="">Choisis un élève</option>
        ${eleves.map((e) => `<option value="${echapper(e.id)}">${echapper(e.nom)}${e.pseudo ? ` (@${echapper(e.pseudo)})` : ''} · étape ${e.etape >= 5 ? 'GOAT' : e.etape}</option>`).join('')}</select></div>
      <div class="champ"><label for="texte">Remarque</label><textarea id="texte" name="texte" maxlength="2000" required placeholder="Ce qui va, ce qu'il doit changer…"></textarea></div>
      <div data-images="/admin/images"><label class="fichier">${ICONE.plus}<span><b>Joindre des images</b><br>Captures, exemples… (facultatif)</span><input type="file" accept="image/*" multiple hidden></label>
        <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>
      <button class="bouton" type="submit" style="margin:0">Envoyer la remarque</button></form></details>
    <h2 style="font-size:16px;margin:22px 0 4px">Mes dernières remarques</h2>
    <p class="doux petit" style="margin:0 0 10px">Tu peux les modifier, pas les supprimer. Si l'élève l'avait déjà lue, Bob le prévient qu'elle a changé.</p>
    <div style="display:grid;gap:8px;max-width:640px">${remarques.map((x) => `<div class="carte" style="margin:0">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><b>${echapper(x.nom)}</b>
        <span class="doux petit">${echapper(dateCourte(x.modifie_le || x.cree_le))}${x.modifie_le ? ' · modifiée' : ''} · ${x.lue ? 'lue' : 'pas encore lue'}</span></div>
      <p style="margin:6px 0 0;white-space:pre-line">${echapper(x.texte)}</p>${x.images.length ? `<p class="doux petit" style="margin:4px 0 0">${x.images.length} image(s)</p>` : ''}
      <details style="margin-top:8px"><summary class="doux petit" style="cursor:pointer">Modifier</summary>
        <form method="post" action="/admin/remarques/${x.id}" style="display:grid;gap:8px;margin-top:8px"><textarea name="texte" maxlength="8000" required>${echapper(x.texte)}</textarea>
          <button class="bouton secondaire" type="submit" style="margin:0">Enregistrer la modification</button></form></details></div>`).join('') || '<p class="vide-traiter">Aucune remarque pour le moment.</p>'}</div>`;
  } else if (onglet === 'message') {
    const messages = annonces.filter(estMessage);
    corps = `<form id="form-annonce" class="carte" method="post" action="/admin/planifier/message" data-n="${nbEleves}" style="display:grid;gap:12px;max-width:640px">
      <p class="doux petit" style="margin:0">Une simple notification à tous les élèves Elite (application ou Bob), sans bannière.</p>
      <div class="champ"><label for="titre">Titre</label><input id="titre" name="titre" maxlength="120" required placeholder="ex. Pense à ton compte rendu"></div>
      <div class="champ"><label for="texte">Message</label><textarea id="texte" name="texte" maxlength="1800" required placeholder="Colle ton texte ici."></textarea></div>
      ${lien}<input type="hidden" name="notifier" value="1">
      <button class="bouton" type="submit" style="margin:0">Envoyer à tous les élèves</button></form>
    <form class="carte" method="post" action="/admin/notifications/test" style="display:grid;gap:10px;max-width:640px">
      <h2 style="margin:0">Tester une notification</h2>
      <p class="doux petit" style="margin:0">Envoyée à ce seul compte : dans l'application ou par Bob, et rangée dans ses notifications (pastille rouge sur sa cloche).</p>
      ${test ? `<p class="message-ok" style="margin:0">${echapper(test)}</p>` : ''}
      <div style="display:flex;gap:8px"><input name="pseudo" placeholder="Pseudo Discord, ex. @ton_compte_test" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="41" required>
        <button class="bouton secondaire" type="submit" style="margin:0;width:auto;white-space:nowrap">Envoyer un test</button></div></form>
    <h2 style="font-size:16px;margin:22px 0 10px">Messages envoyés</h2>
    <div style="display:grid;gap:8px;max-width:640px">${messages.map((a) => `<div class="carte" style="margin:0"><b>${echapper(a.titre)}</b>
      <p class="doux petit" style="margin:4px 0 0">${echapper(dateCourte(a.cree_le))} GMT · ${recu(a)}</p></div>`).join('') || '<p class="vide-traiter">Aucun message pour le moment.</p>'}</div>`;
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
  ${corps}`, espace, 'planifier', null, SCRIPT_ANNONCE);
}

// Profil du coach : sa pièce dorée, ses chiffres, les raccourcis et ses meilleurs élèves.
function pageCoach(config, { espace, pseudo, avatar, nbEleves, aTraiter, faites = 0, seancesAujourdhui, seancesFaites = 0, top = [] }) {
  const nom = pseudo || 'Coach';
  const barre = (titre, fait, total, lien, vide, pleineSiVide) => `<a class="pf-objectif-barre" href="${lien}">
    <span class="haut"><span>${titre}</span><b>${total ? `${fait} / ${total}` : vide}</b></span>
    <span class="barre"><i style="width:${total ? Math.round((fait / total) * 100) : pleineSiVide ? 100 : 0}%"></i></span></a>`;
  return page('Mon profil', `${STYLE_PROFIL}${STYLE_ROLES}
  <div class="pf">
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
    <div class="pf-cartes" style="grid-template-columns:1fr 1fr">
      <a class="pf-carte" href="/admin/a-traiter"><h3>À traiter</h3><p class="vert">${aTraiter} en attente</p><p>Exercices, vidéos, comptes rendus, candidatures…</p></a>
      <a class="pf-carte" href="/admin/eleves"><h3>Élèves Elite</h3><p class="vert">${nbEleves} élève(s)</p><p>Kanban ou liste triable.</p></a>
    </div>
    <h2 class="section">Meilleurs élèves</h2>
    <div class="cm-liste">${top.map((m, i) => `<a class="cm-ligne" href="/classement/${encodeURIComponent(m.id)}" style="color:#fff;text-decoration:none"><span class="rond">${i + 1}</span>
      <div class="qui"><b>${echapper(m.nom)}</b><small>${dollars(m.revenus, { centimes: false })} · ${vuesCourtes(m.vues)} vues</small></div></a>`).join('') || '<p class="vide-traiter">Pas encore de résultats.</p>'}</div>
  </div>${STYLE_COMMU}`, espace, 'coach');
}

module.exports = { carteAnnonce, pageAnnonces, pageCoach, pageMonProfil, pageCommunaute, pageRemarques, pageRevenus, pageReglages, FLAMME };
