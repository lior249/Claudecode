'use strict';

// Mon profil (page d'accueil des élèves Elite) : photo, 3 chiffres, la roue des jours (chaque jour : sa fiche,
// son résultat), la chaîne 🔥, ceux qu'il suit, la tâche du moment ; puis le tableau de bord des revenus.
// Et la page Communauté : suivis (10 places), concurrents (3), invitations, suggestions.
const { echapper } = require('./pages');
const { page, remarque, blocTableau, SCRIPT_TABLEAU, dollars } = require('./pages-parcours');
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

const rond = (x) => `<span>${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>`;

function panneauJour(d, i, tache) {
  const encourage = `<p class="encourage">${echapper(ENCOURAGEMENTS[i % ENCOURAGEMENTS.length])}</p>`;
  const titre = d.aujourdhui ? 'Aujourd\'hui' : jourLisible(d.j);
  let corps;
  if (d.futur) corps = '<p>À venir : prépare ta vidéo.</p>';
  else if (d.aujourdhui && tache) {
    corps = `<p><b style="color:#fff">${echapper(tache.titre)}</b></p><p>${echapper(tache.texte || '')}</p>
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

function pageMonProfil(config, { espace, parcours: p, prenom, avatar, stats, role, jourDepuis, jours, chaine, flamme, derniers7, tache, suivis, nbSuivis, nbConcurrents, invitations, tableau, notifications }) {
  const nom = prenom || p.pseudo || 'Membre';
  const roue = jours.map((d) => `<button type="button" class="roue-jour${d.aujourdhui ? ' aujourdhui' : ''}${d.futur ? ' futur' : ''}" data-jour="${d.j}" data-e="${d.e}" aria-label="${echapper(jourLisible(d.j))}">
      <span class="pts"><i></i></span><small>${JOURS_COURTS[new Date(`${d.j}T12:00:00Z`).getUTCDay()]}</small><b>${Number(d.j.slice(8))}</b></button>`).join('');
  return page('Mon profil', `${STYLE_PROFIL}${STYLE_ROLES}
  <div class="pf">
    <div class="pf-haut">
      <a class="pf-icone" href="/notifications" aria-label="Notifications">${ICONES.cloche}${notifications ? '<span class="point"></span>' : ''}</a>
      <a class="pf-chaine" href="#chaine" aria-label="Chaîne de ${chaine} jours">${FLAMME(flamme)}${chaine}</a>
    </div>
    <div class="pf-identite">
      <div class="pf-avatar">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span>${echapper(nom.charAt(0).toUpperCase())}</span>`}</div>
      <h1>${echapper(nom)}</h1><p>@${echapper(p.pseudo || '')}</p>
    </div>
    <div class="pf-chiffres">
      <div><b>${ICONES.revenus}${dollars(stats.revenusTotal || 0, { centimes: false })}</b><small>Revenus</small></div><span class="sep"></span>
      <div><b>${pastilleRole(role)}</b><small>Rang</small></div><span class="sep"></span>
      <div><b>${ICONES.jours}${jourDepuis}</b><small>Jours</small></div>
    </div>
    <div class="roue-cadre"><div class="roue" role="listbox" aria-label="Jours">${roue}</div><button type="button" class="roue-retour" hidden>Revenir à aujourd'hui</button></div>
    ${jours.map((d, i) => panneauJour(d, i, tache)).join('')}
    <div class="pf-cartes">
      <a class="pf-carte pf-suivis" href="/communaute">
        <div class="pf-ronds">${suivis.slice(0, 3).map(rond).join('') || '<span>+</span>'}</div>
        <h3>Je suis</h3><p class="vert">${nbSuivis} / 10${nbConcurrents ? ` · ${nbConcurrents} concurrent${nbConcurrents > 1 ? 's' : ''}` : ''}</p>
        ${invitations ? `<p>${invitations} invitation${invitations > 1 ? 's' : ''} à défier</p>` : ''}
      </a>
      <a class="pf-carte pf-feu" id="chaine" href="/parcours/etape-4">
        <h3>${flamme ? 'Ne casse pas ta chaîne !' : chaine ? 'Ta chaîne démarre' : 'Allume ta flamme'}</h3>
        <p>${flamme ? `${chaine} jours d'affilée avec un compte rendu.` : `Envoie ton compte rendu ${3} jours d'affilée${chaine ? ` (${chaine} / 3)` : ''}.`}</p>
        <div class="points">${derniers7.map((x) => `<i${x ? ' class="ok"' : ''}></i>`).join('')}</div>
        ${FLAMME(flamme).replace('class="flamme', 'class="grande flamme')}
      </a>
    </div>
    ${tache ? `<a class="pf-tache" href="${echapper(tache.lien || '/parcours')}"><span class="pastille">${ICONES.fleche}</span>
      <span><h3>${echapper(tache.titre)}</h3><p>${echapper(tache.texte || 'Ta tâche la plus importante du moment.')}</p></span></a>` : ''}
    <h2 class="section">Mes revenus</h2>
    ${blocTableau(tableau)}
  </div>`, espace, 'profil', null, `${SCRIPT_TABLEAU}${SCRIPT_ROUE}`);
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
  .cm-section { margin-top:22px; } .cm-section h2 { margin:0 0 4px; font-size:17px; } .cm-section > p { margin:0 0 10px; color:var(--doux); font-size:13px; }
</style>`;
const ligne = (x, actions, sous) => `<div class="cm-ligne"><span class="rond">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
  <div class="qui"><a href="/classement/${encodeURIComponent(x.id)}" style="text-decoration:none"><b>${echapper(x.nom)}</b></a><small>${sous || ''}</small></div>${actions || ''}</div>`;
const bouton = (action, texte, champs = {}, classe = 'secondaire') => `<form method="post" action="${action}">${Object.entries(champs).map(([k, v]) => `<input type="hidden" name="${k}" value="${echapper(v)}">`).join('')}<button class="bouton ${classe}" type="submit">${echapper(texte)}</button></form>`;

function pageCommunaute(config, { espace, suivis, concurrents, recues, envoyees, enVogue, proches, peutConcourir, places, message, erreur }) {
  const flammeTxt = (n) => (n >= 3 ? ` · 🔥 ${n}` : '');
  return page('Communauté', `${STYLE_COMMU}
  <a class="retour" href="/profil"><span aria-hidden="true">‹</span> Mon profil</a>
  <div class="titre-page"><div><p class="etiquette">Communauté</p><h1>Ceux qui te motivent</h1></div><span class="doux petit">${places} / 10 places</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${recues.length ? `<section class="cm-section"><h2>Invitations à concourir</h2><p>Le premier qui atteint l'objectif gagne. Un concurrent prend une de tes 10 places.</p>
    <div class="cm-liste">${recues.map((c) => ligne(c.membre, `${bouton(`/communaute/concurrences/${c.id}`, 'Refuser', { reponse: 'non' })}${bouton(`/communaute/concurrences/${c.id}`, 'Accepter', { reponse: 'oui' }, 'vert')}`,
    `Premier à ${dollars(c.objectif, { centimes: false })}`)).join('')}</div></section>` : ''}
  <section class="cm-section"><h2>Mes concurrents (${concurrents.length} / 3)</h2>
    <p>${peutConcourir ? 'Vous recevez les résultats l\'un de l\'autre. Le premier à l\'objectif gagne.' : 'La concurrence se débloque à l\'étape 4, après ton premier compte rendu.'}</p>
    <div class="cm-liste">${concurrents.map((c) => `${ligne(c.membre, bouton(`/communaute/concurrences/${c.id}/abandon`, 'Abandonner'),
    `Objectif ${dollars(c.objectif, { centimes: false })} · toi ${dollars(c.moi, { centimes: false })} · lui ${dollars(c.lui, { centimes: false })}`)}`).join('') || '<p class="vide-traiter">Aucun concurrent pour le moment.</p>'}
    ${envoyees.map((c) => ligne(c.membre, bouton(`/communaute/concurrences/${c.id}/abandon`, 'Annuler'), 'Invitation envoyée, en attente')).join('')}</div></section>
  ${proches.length ? `<section class="cm-section"><h2>Profils proches du tien</h2><p>Mêmes revenus et mêmes vues que toi ces 10 derniers jours : défie-le.</p>
    <div class="cm-liste">${proches.map((x) => ligne(x.membre, bouton('/communaute/defier', 'Défier', { id: x.membre.id }, 'vert'),
    `${dollars(x.revenus, { centimes: false })} · ${vuesCourtes(x.vues)} vues en 10 jours`)).join('')}</div></section>` : ''}
  <section class="cm-section"><h2>Je suis (${suivis.length})</h2><p>Tu reçois leurs nouveaux résultats : l'argent gagné, sinon les vues.</p>
    <div class="cm-liste">${suivis.map((s) => ligne(s.membre, s.type === 'concurrent' ? '<span class="doux petit">Concurrent</span>' : bouton('/communaute/ne-plus-suivre', 'Ne plus suivre', { id: s.membre.id }),
    `${s.membre.role ? echapper(nomRole(s.membre.role)) : 'Elite'}${flammeTxt(s.membre.chaine)}`)).join('') || '<p class="vide-traiter">Tu ne suis personne pour le moment.</p>'}</div></section>
  <section class="cm-section"><h2>En vogue</h2><p>Les meilleurs résultats de la semaine. Places prises ? Retire quelqu'un qui ne poste plus, puis suis-les.</p>
    <div class="cm-liste">${enVogue.map((x) => ligne(x.membre, places >= 10 ? '' : bouton('/communaute/suivre', 'Suivre', { id: x.membre.id }, 'vert'),
    `${dollars(x.revenus, { centimes: false })} · ${vuesCourtes(x.vues)} vues cette semaine${flammeTxt(x.chaine)}`)).join('') || '<p class="vide-traiter">Pas encore de résultats cette semaine.</p>'}</div></section>`, espace, 'communaute');
}

// ---------- Remarques du coach ----------
function pageRemarques(config, { espace, remarques }) {
  return page('Remarques du coach', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Remarques du coach</h1></div><span class="doux petit">${remarques.length} au total</span></div>
  <div style="display:grid;gap:10px">${remarques.map(remarque).join('') || '<p class="vide-traiter">Pas encore de remarque.</p>'}</div>`, espace, 'remarques');
}

module.exports = { pageMonProfil, pageCommunaute, pageRemarques, FLAMME };
