'use strict';

// Classement (top 100) : en haut, le total des récompenses générées sur Overmaxx, le nombre de membres et les événements ;
// puis le podium (or, argent, bronze, avec un reflet qui passe sur la bordure ; la médaille pour le premier seulement) ;
// puis le reste du classement. Sur téléphone, tout s'affiche en lignes.
const { echapper } = require('./pages');
const { pageEspace } = require('./pages-espace');
const { ORDRE_ROLES, pastilleRole, nomRole, STYLE_ROLES } = require('./roles');
const { pieceTrophee } = require('./trophees');

// Vues : 999, puis 1.2K, 1.2M, 1.2Md.
function vuesCourtes(n) {
  const v = Number(n) || 0;
  const court = (x, s) => `${(Math.floor(x * 10) / 10).toFixed(1).replace(/\.0$/, '')}${s}`;
  if (v < 1000) return String(Math.round(v));
  if (v < 1e6) return court(v / 1e3, 'K');
  if (v < 1e9) return court(v / 1e6, 'M');
  return court(v / 1e9, 'Md');
}
// La chaîne d'activité (3 jours d'affilée ou plus) juste avant le nombre de jours.
const feu = (n) => (n >= 3 ? `<span class="feu" title="${n} jours d'affilée">🔥${n}</span> · ` : '');
const dollars = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
// Le rôle le plus élevé obtenu (confirmé par le coach).
const roleLePlusHaut = (recompenses = []) => ORDRE_ROLES.find((r) => recompenses.some((x) => String(x.role) === r && x.confirme_le)) || null;

// Le dernier trophée obtenu, à côté du nom.
const trophee = (m) => (m.trophee ? `<span class="tr-cl" title="${echapper(m.trophee.titre)}">${pieceTrophee(m.trophee, { taille: 20 })}<span>${echapper(m.trophee.titre)}</span></span>` : '');
const MEDAILLE = `<svg class="medaille" viewBox="0 0 64 96" aria-label="Médaille du premier">
  <defs><linearGradient id="or-medaille" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f2c230"/><stop offset="1" stop-color="#9a6b00"/></linearGradient></defs>
  <path d="M14 0h14l10 34H24z" fill="#c62828"/><path d="M36 0h14L40 34H26z" fill="#1e3a8a"/><path d="M27 0h10l-4 30h-2z" fill="#fff"/>
  <circle cx="32" cy="62" r="26" fill="url(#or-medaille)" stroke="#7a5200" stroke-width="2"/>
  <circle cx="32" cy="62" r="19" fill="none" stroke="#fff6cf" stroke-opacity=".6" stroke-width="2"/>
  <text x="32" y="72" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="800" font-size="26" fill="#6b4700">1</text></svg>`;

const STYLE_CLASSEMENT = `<style>
  .feu { color:#ff9a3c; font-weight:700; white-space:nowrap; }
  .tr-cl { display:inline-flex; align-items:center; gap:4px; margin-top:3px; font-size:11.5px; color:#e8c35a; font-weight:600; white-space:nowrap; } .tr-cl svg { flex:none; }
  .cl-stats { display:grid; grid-template-columns:1fr 1fr 2fr; gap:14px; margin-bottom:18px; }
  .cl-stat { background:var(--surface); border:1px solid var(--bord); border-radius:18px; padding:18px; min-width:0; }
  .cl-stat b { display:block; font-size:30px; font-weight:800; letter-spacing:-0.02em; overflow-wrap:anywhere; }
  .cl-stat span { color:var(--doux); font-size:13px; }
  .cl-stat.evenements b { font-size:18px; } .cl-stat.evenements p { margin:6px 0 0; color:var(--gris); font-size:13px; }
  .podium { display:grid; grid-template-columns:1.12fr 1fr 1fr; gap:14px; align-items:stretch; margin-bottom:22px; }
  /* Bordure métallique (or, argent, bronze) avec un reflet qui passe du bas à gauche vers le haut à droite. */
  .metal { position:relative; border-radius:22px; padding:3px; background:linear-gradient(135deg, var(--m1), var(--m2) 28%, var(--m3) 50%, var(--m2) 72%, var(--m1)); }
  .metal::after { content:''; position:absolute; inset:0; border-radius:22px; padding:3px; pointer-events:none;
    background:linear-gradient(45deg, transparent 42%, rgba(255,255,255,.95) 50%, transparent 58%) 0 0 / 300% 300% no-repeat;
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor;
    mask:linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); animation:reflet 4s ease-in-out infinite; }
  /* La bande claire part du coin en bas à gauche et sort par le coin en haut à droite, puis une pause. */
  @keyframes reflet { 0% { background-position:100% 0%; } 60%, 100% { background-position:0% 100%; } }
  @media (prefers-reduced-motion: reduce) { .metal::after { animation:none; opacity:0; } }
  .metal.or { --m1:#8a6410; --m2:#e8b923; --m3:#fff4c2; box-shadow:0 18px 50px -22px rgba(232,185,35,.55); }
  .metal.argent { --m1:#6b7078; --m2:#c9ced6; --m3:#ffffff; }
  .metal.bronze { --m1:#6e3b17; --m2:#c07a3f; --m3:#ffd9b3; }
  .metal > .interieur { position:relative; height:100%; border-radius:19px; background:linear-gradient(180deg, #1b1c20, #141518); padding:18px; display:flex; flex-direction:column; gap:14px; }
  .metal.or > .interieur { padding:22px 20px; }
  .medaille { position:absolute; top:-6px; right:16px; width:58px; height:88px; filter:drop-shadow(0 6px 10px rgba(0,0,0,.5)); }
  .qui { display:flex; align-items:center; gap:12px; min-width:0; padding-right:64px; }
  .podium .argent .qui, .podium .bronze .qui { padding-right:0; }
  .avatar-cl { position:relative; flex:none; width:52px; height:52px; border-radius:50%; background:#2c2c2e; display:grid; place-items:center; font-weight:800; font-size:20px; }
  .avatar-cl img { width:100%; height:100%; border-radius:50%; object-fit:cover; }
  .avatar-cl .rang { position:absolute; right:-4px; bottom:-4px; width:22px; height:22px; border-radius:50%; display:grid; place-items:center;
    font-size:11px; font-weight:800; color:#000; background:var(--m2, #fff); border:2px solid #141518; }
  .qui .nom { font-weight:700; font-size:16px; color:#fff; text-decoration:none; overflow-wrap:anywhere; display:block; }
  .qui .pseudo { color:var(--doux); font-size:13px; }
  .chiffres { display:grid; grid-template-columns:1fr 1fr; gap:10px 8px; }
  .chiffres .gros { grid-column:1 / -1; }
  .chiffres small { display:block; color:var(--doux); font-size:11px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:2px; }
  .chiffres b { font-size:18px; font-weight:800; }
  .chiffres .gros b { font-size:24px; }
  .metal.or .chiffres .gros b { font-size:28px; }
  .roles { display:flex; flex-wrap:wrap; gap:6px; margin-top:auto; }
  .classement { background:var(--surface); border:1px solid var(--bord); border-radius:22px; padding:18px; }
  .classement h2 { margin:0 0 14px; font-size:22px; }
  table.cl { width:100%; border-collapse:separate; border-spacing:0; font-size:14px; border:1px solid var(--bord); border-radius:14px; overflow:hidden; }
  table.cl th { text-align:left; color:var(--doux); font-weight:600; font-size:12px; padding:12px; border-bottom:1px solid var(--bord); }
  table.cl td { padding:12px; border-bottom:1px solid var(--bord); vertical-align:middle; }
  table.cl tr:last-child td { border-bottom:0; }
  table.cl tr.moi td { background:#1b1b10; }
  table.cl .n { display:inline-grid; place-items:center; min-width:26px; height:26px; border-radius:50%; border:1px solid var(--bord-fort); font-size:12px; font-weight:700; }
  table.cl .membre-cl { display:flex; align-items:center; gap:10px; }
  table.cl .membre-cl .avatar-cl { width:34px; height:34px; font-size:14px; }
  table.cl .membre-cl a { color:#fff; text-decoration:none; font-weight:600; } table.cl .membre-cl small { display:block; color:var(--doux); font-size:12px; }
  .ma-place { border:1px solid var(--bord-fort); border-radius:14px; padding:12px 14px; margin-bottom:14px; font-size:14px; }
  /* Téléphone : tout en lignes. */
  @media (max-width: 760px) {
    .cl-stats { grid-template-columns:1fr 1fr; } .cl-stat.evenements { grid-column:1 / -1; } .cl-stat b { font-size:22px; }
    .podium { grid-template-columns:1fr; gap:10px; }
    .metal > .interieur, .metal.or > .interieur { padding:12px 14px; flex-direction:row; align-items:center; gap:10px; }
    .medaille { width:34px; height:52px; top:-8px; right:10px; }
    .qui { flex:1; padding-right:0; } .avatar-cl { width:42px; height:42px; font-size:16px; }
    .chiffres { display:block; text-align:right; } .chiffres > div:not(.gros) { display:none; } .chiffres small { display:none; }
    .chiffres .gros b, .metal.or .chiffres .gros b { font-size:18px; }
    .metal.or .chiffres { margin-right:34px; }
    .roles { display:none; }
    table.cl thead { display:none; }
    table.cl, table.cl tbody, table.cl tr { display:block; } table.cl { border:0; }
    table.cl tr { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; padding:10px 4px; border-bottom:1px solid var(--bord); }
    table.cl td { padding:0; border:0; background:none !important; } table.cl td.optionnel { display:none; }
    table.cl tr.moi { background:#1b1b10; border-radius:12px; padding:10px 8px; }
  }
</style>`;

function avatar(m, avecRang) {
  const initiale = echapper((m.nom || '?').trim().charAt(0).toUpperCase());
  return `<span class="avatar-cl">${m.avatar ? `<img src="${echapper(m.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : initiale}${avecRang ? `<span class="rang">${m.rang}</span>` : ''}</span>`;
}
function roles(m) {
  const haut = roleLePlusHaut(m.recompenses);
  return `<div class="roles">${haut ? pastilleRole(haut) : ''}${pastilleRole(m.elite ? 'elite' : 'membre')}</div>`;
}
function cartePodium(m, metal) {
  return `<article class="metal ${metal}" data-lien="/classement/${encodeURIComponent(m.id)}"><div class="interieur">
    ${metal === 'or' ? MEDAILLE : ''}
    <div class="qui">${avatar(m, true)}<div style="min-width:0"><a class="nom" href="/classement/${encodeURIComponent(m.id)}">${echapper(m.nom)}</a>
      <span class="pseudo">@${echapper(m.pseudo || '')}</span>${trophee(m) ? `<br>${trophee(m)}` : ''}</div></div>
    <div class="chiffres"><div class="gros"><small>Revenus générés</small><b>${dollars(m.revenus)}</b></div>
      <div><small>Vues</small><b>${vuesCourtes(m.vues)}</b></div><div><small>Jours</small><b>${feu(m.chaine)}${m.jours}</b></div></div>
    ${roles(m)}
  </div></article>`;
}

const STYLE_EVENEMENTS = `<style>
  .cl-evts { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(260px, 86%); gap:10px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; margin:0 0 16px; }
  .cl-evts::-webkit-scrollbar { display:none; }
  .cl-evt { position:relative; scroll-snap-align:start; display:flex; flex-direction:column; justify-content:flex-end; min-height:130px; padding:14px; border-radius:18px; overflow:hidden;
    color:#fff; text-decoration:none; background:var(--c, #1a1a1a); border:1px solid #2a2a2a; }
  .cl-evt img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .cl-evt .txt { position:relative; background:linear-gradient(0deg, rgba(0,0,0,.75), transparent); margin:-14px; padding:30px 14px 14px; }
  .cl-evt b { display:block; font-size:17px; } .cl-evt small { color:rgba(255,255,255,.8); }
  .cl-vues { display:flex; gap:4px; padding:4px; border-radius:999px; background:#141414; border:1px solid #242424; margin:0 0 14px; width:max-content; max-width:100%; }
  .cl-vues a { padding:8px 14px; border-radius:999px; color:var(--doux); text-decoration:none; font-weight:700; font-size:13px; white-space:nowrap; } .cl-vues a[aria-current] { background:#fff; color:#000; }
  [data-lien] { cursor:pointer; }
</style>`;
const dateCourte = (j) => j.split('-').reverse().slice(0, 2).join('/');
const ETAT_EVT = { a_venir: 'À venir', en_cours: 'En cours', termine: 'Terminé' };

function pageClassement(config, { espace, top, totalRevenus, totalMembres, monRang, total, evenements = [], evenementChoisi = null, participants = [], moi: moiId = null }) {
  const { classementEvenement } = require('./pages-evenements');
  const evts = evenements.length ? `<section class="cl-evts" aria-label="Événements">${evenements.map((e) => `<a class="cl-evt" href="/evenements/${e.id}" style="--c:${echapper(e.couleur || '#1a1a1a')}">
      ${e.banniere ? `<img src="/fichiers/images/${echapper(e.banniere)}" alt="">` : ''}<span class="txt"><b>${echapper(e.titre)}</b>
      <small>${ETAT_EVT[e.etat] || ''} · du ${dateCourte(e.debut)} au ${dateCourte(e.fin)} · ${e.nb} inscrit${e.nb > 1 ? 's' : ''}</small></span></a>`).join('')}</section>`
    : '<div class="cl-stat evenements" style="margin:0 0 16px"><b>Événements</b><p>Aucun événement pour le moment.</p></div>';
  const vues = evenements.length ? `<nav class="cl-vues" aria-label="Classement"><a href="/classement"${evenementChoisi ? '' : ' aria-current="page"'}>Classement all-time</a>
    <a href="/classement?vue=evenement"${evenementChoisi ? ' aria-current="page"' : ''}>Classement événement</a></nav>` : '';
  if (evenementChoisi) {
    return pageEspace('Classement', `${STYLE_CLASSEMENT}${STYLE_EVENEMENTS}${STYLE_ROLES}
  <div class="titre-page"><div><p class="etiquette">Overmaxx</p><h1>Classement</h1></div></div>
  ${evts}${vues}
  ${evenements.length > 1 ? `<nav class="cl-vues" aria-label="Événement">${evenements.map((e) => `<a href="/classement?vue=evenement&amp;e=${e.id}"${e.id === evenementChoisi.id ? ' aria-current="page"' : ''}>${echapper(e.titre)}</a>`).join('')}</nav>` : ''}
  <section class="classement"><h2>${echapper(evenementChoisi.titre)}</h2><p class="doux petit" style="margin:-8px 0 12px">Revenus générés du ${dateCourte(evenementChoisi.debut)} au ${dateCourte(evenementChoisi.fin)} par les inscrits.</p>
    ${classementEvenement(participants, moiId)}</section>`, espace, 'classement');
  }

  const podium = top.slice(0, 3);
  const reste = top.slice(3);
  const metaux = ['or', 'argent', 'bronze'];
  const moi = espace && espace.session && espace.session.id;
  return pageEspace('Classement', `${STYLE_CLASSEMENT}${STYLE_EVENEMENTS}${STYLE_ROLES}
  <div class="titre-page"><div><p class="etiquette">Overmaxx</p><h1>Classement</h1></div><span class="doux petit">Top 100</span></div>
  ${evts}
  <div class="cl-stats" style="grid-template-columns:1fr 1fr">
    <div class="cl-stat"><b>${dollars(totalRevenus)}</b><span>Revenus générés sur Overmaxx</span></div>
    <div class="cl-stat"><b>${Number(totalMembres).toLocaleString('fr-FR')}</b><span>Membres</span></div>
  </div>
  ${vues}
  ${monRang && monRang > 100 ? `<p class="ma-place">Tu es <b>${monRang}<sup>e</sup></b> sur ${total}. Entre dans le top 100 pour apparaître ici. <a href="/profil">Mon profil</a></p>` : ''}
  ${podium.length ? `<section class="podium" aria-label="Podium">${podium.map((m, i) => cartePodium(m, metaux[i])).join('')}</section>`
    : '<div class="carte"><p class="doux" style="margin:0">Le classement apparaîtra avec les premiers comptes rendus validés.</p></div>'}
  ${reste.length ? `<section class="classement"><h2>Classement général</h2>
    <table class="cl"><thead><tr><th>Rang</th><th>Membre</th><th>Revenus générés</th><th class="optionnel">Vues</th><th class="optionnel">Jours</th><th class="optionnel">Rôle</th></tr></thead><tbody>
    ${reste.map((m) => `<tr${m.id === moi ? ' class="moi"' : ''} data-lien="/classement/${encodeURIComponent(m.id)}"><td><span class="n">${m.rang}</span></td>
      <td><div class="membre-cl">${avatar(m)}<div><a href="/classement/${encodeURIComponent(m.id)}">${echapper(m.nom)}</a><small>@${echapper(m.pseudo || '')}</small>${trophee(m)}</div></div></td>
      <td><b>${dollars(m.revenus)}</b></td><td class="optionnel">${vuesCourtes(m.vues)}</td><td class="optionnel">${feu(m.chaine)}${m.jours}</td>
      <td class="optionnel">${pastilleRole(roleLePlusHaut(m.recompenses) || (m.elite ? 'elite' : 'membre'))}</td></tr>`).join('')}
    </tbody></table></section>` : ''}
  <script>document.querySelectorAll('[data-lien]').forEach(function (el) { el.addEventListener('click', function (e) {
    if (e.target.closest('a, button, form')) return; location.href = el.getAttribute('data-lien'); }); });</script>`, espace, 'classement');
}

module.exports = { pageClassement, vuesCourtes, roleLePlusHaut, nomRole };
