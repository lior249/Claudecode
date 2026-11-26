'use strict';

const { pastilleRole, STYLE_ROLES } = require('./roles');

// Tableau des élèves Elite (Kanban) : une colonne par étape (1 à 4), et GOAT en lecture seule.
// Le coach glisse un élève vers une autre étape (ou touche « Déplacer » sur téléphone) ; vers l'avant, il confirme
// en voyant tout ce qui n'a pas été validé sur la plateforme. Le compte TikTok est demandé à partir de l'étape 3.
// GOAT ne se donne pas à la main : il se gagne avec des résultats suivis sur la plateforme.
const { echapper } = require('./pages');
const { pageEspace } = require('./pages-espace');

const COLONNES = [
  { n: 1, titre: 'Prise en main' },
  { n: 2, titre: 'Coaching d\'entrée' },
  { n: 3, titre: 'Validation du contenu' },
  { n: 4, titre: 'Publication et suivi' },
  { n: 5, titre: 'GOAT' },
];

const STYLE_KANBAN = `<style>
  .kanban { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(185px, 1fr); gap:12px; overflow-x:auto; padding-bottom:12px;
    scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; }
  @media (max-width: 720px) { .kanban { grid-auto-columns:86%; } }
  .colonne { scroll-snap-align:start; background:#0b0b0b; border:1px solid var(--bord); border-radius:18px; padding:12px; min-height:240px; display:flex; flex-direction:column; gap:10px; }
  .colonne.survol { border-color:#fff; background:#151515; }
  .colonne.goat { background:linear-gradient(#17130a, #0b0b0b); border-color:#4a3d14; }
  .colonne > header { display:flex; align-items:baseline; justify-content:space-between; gap:8px; padding:2px 4px 6px; }
  .colonne > header b { font-size:14px; } .colonne > header small { color:var(--doux); font-size:12px; }
  .colonne .num { display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; background:#222; font-size:12px; font-weight:800; margin-right:6px; }
  .colonne.goat .num { background:#f5c542; color:#000; }
  .colonne .vide { color:var(--gris); font-size:13px; text-align:center; padding:18px 6px; border:1px dashed var(--bord); border-radius:12px; }
  .eleve { background:var(--surface); border:1px solid var(--bord); border-radius:14px; padding:12px; display:grid; gap:6px; cursor:grab; touch-action:manipulation; }
  .eleve[draggable="false"] { cursor:default; }
  .eleve.deplace { opacity:.4; }
  .eleve .nom { font-weight:700; color:#fff; text-decoration:none; font-size:15px; overflow-wrap:anywhere; }
  .eleve .sous { color:var(--doux); font-size:12.5px; overflow-wrap:anywhere; }
  .eleve .tache { font-size:12.5px; color:#ddd; }
  .eleve .pastilles { display:flex; flex-wrap:wrap; gap:4px; }
  .eleve .pastilles span { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid var(--bord-fort); color:var(--doux); }
  .eleve .pastilles .rouge { border-color:#ff3b3b; color:#ff8080; } .eleve .pastilles .orange { border-color:#ff8a00; color:#ffb35c; }
  .eleve .pastilles .or { border-color:#f5c542; color:#f5c542; }
  .eleve .deplacer, .eleve .infos { margin-top:2px; }
  .eleve .a-completer { border-color:#ff8a00; color:#ffb35c; }
  .ajout { display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:end; }
  .ajout .champ { margin:0; } .ajout input { margin:0; }
  @media (max-width: 720px) { .ajout { grid-template-columns:1fr; } }
  #dlg-etape { width:min(480px, calc(100% - 24px)); }
  .cibles { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin:6px 0 12px; }
  .cibles label { margin:0; display:grid; place-items:center; gap:2px; padding:8px 4px; border:1px solid var(--bord-fort); border-radius:12px; cursor:pointer; text-align:center; font-size:11.5px; color:var(--doux); }
  .cibles label b { font-size:16px; color:#fff; }
  .cibles input { position:absolute; opacity:0; pointer-events:none; }
  .cibles label:has(input:checked) { background:#fff; color:#000; border-color:#fff; } .cibles label:has(input:checked) b { color:#000; }
  .cibles label:has(input:disabled) { opacity:.35; cursor:default; }
  .manquants { border:1px solid #5a4a1a; background:#1d1708; color:#f1d38a; border-radius:12px; padding:10px 12px; font-size:13.5px; margin-bottom:10px; }
  .manquants p { margin:0 0 6px; } .manquants b { color:#ffe9b0; }
  .manquants ul { margin:2px 0 8px; padding-left:18px; }
  .champs-compte { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; } .champs-compte .large { grid-column:1 / -1; } .champs-compte .champ { margin:0; } .champs-compte input, .champs-compte select { margin:0; }
</style>`;

// Infos à renseigner : le niveau après l'étape 1 ; le compte TikTok, la niche et le pays à partir de l'étape 3.
const manqueInfos = (e) => (e.etape >= 2 && !e.niveau) || (e.etape >= 3 && (!e.compte || !e.niche || !e.pays));
function carte(e) {
  const goat = e.etape >= 5;
  return `<article class="eleve" data-id="${echapper(e.id)}" draggable="${goat ? 'false' : 'true'}">
    <a class="nom" href="/admin/membres/${encodeURIComponent(e.id)}">${echapper(e.nom)}</a>
    <span class="sous">${echapper(e.pseudo || '')}${e.pseudo ? ' · ' : ''}jour ${e.jour} sur 90</span>
    <span class="sous">${e.compte ? `${echapper(e.compte)}${e.niche ? ` · ${echapper(e.niche)}` : ''}` : '<span style="color:#ffb35c">Compte TikTok à renseigner</span>'}</span>
    ${e.tache ? `<span class="tache">${echapper(e.tache)}</span>` : ''}
    <div class="pastilles">${e.sinistre ? `<span class="rouge">Sinistré ${e.sinistres}/3</span>` : ''}${e.retard ? '<span class="rouge">En retard</span>' : ''}
      ${e.aTraiter ? `<span class="orange">${e.aTraiter} à traiter</span>` : ''}${e.forcees.length ? `<span>Passé par toi : ${e.forcees.join(', ')}</span>` : ''}
      ${e.niveau ? `<span>${echapper(e.niveau)}</span>` : ''}${goat ? '<span class="or">GOAT</span>' : ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${goat ? '' : '<button class="petit-bouton deplacer" type="button">Déplacer</button>'}
      <button class="petit-bouton infos${manqueInfos(e) ? ' a-completer' : ''}" type="button">${manqueInfos(e) ? 'Compléter' : 'Infos'}</button></div>
  </article>`;
}

// Vue liste : une ligne par élève, triable par plusieurs critères à la fois (dans l'ordre où on les choisit), croissant ou décroissant.
const CRITERES = [['entree', 'Arrivée'], ['rang', 'Rang'], ['revenus', 'Revenus'], ['videos', 'Posts'], ['regularite', 'Régularité'], ['etape', 'Étape']];
function vueListe(eleves) {
  const lignes = eleves.map((e) => `<a class="ls-ligne" href="/admin/membres/${encodeURIComponent(e.id)}" data-entree="${echapper(e.entree)}" data-rang="${e.rang}" data-revenus="${e.revenus}"
      data-videos="${e.videos}" data-regularite="${e.chaine * 1000 + e.joursCr}" data-etape="${e.etape}" data-nom="${echapper(e.nom)}">
    <span class="ls-nom"><b>${echapper(e.nom)}</b><small>${e.pseudo ? `@${echapper(e.pseudo)} · ` : ''}arrivé le ${echapper(e.entree.split('-').reverse().join('/'))}</small></span>
    <span class="ls-col">${pastilleRole(e.role)}</span>
    <span class="ls-col"><b>$${Math.round(e.revenus).toLocaleString('en-US')}</b><small>revenus</small></span>
    <span class="ls-col"><b>${e.videos}</b><small>posts</small></span>
    <span class="ls-col"><b>${e.chaine >= 3 ? `🔥 ${e.chaine}` : e.chaine}</b><small>${e.joursCr} j suivis</small></span>
    <span class="ls-col"><b>${e.etape >= 5 ? 'GOAT' : `Étape ${e.etape}`}</b>${e.sinistre ? '<small class="rouge">sinistré</small>' : ''}</span></a>`).join('');
  return `${STYLE_ROLES}<div class="ls-tris" role="group" aria-label="Trier">${CRITERES.map(([c, l]) => `<button type="button" data-tri="${c}">${l}<i></i></button>`).join('')}
    <button type="button" class="ls-raz">Effacer</button></div>
  <p class="doux petit" style="margin:0 0 10px">Touche un critère : ↓ décroissant, encore : ↑ croissant, encore : enlevé. Plusieurs à la fois : le premier choisi compte d'abord.</p>
  <div class="ls-liste">${lignes || '<p class="vide-traiter">Aucun élève.</p>'}</div>
  <script>(function () {
    var liste = document.querySelector('.ls-liste'), choix = [];
    function trier() {
      var l = Array.prototype.slice.call(liste.querySelectorAll('.ls-ligne'));
      l.sort(function (a, b) {
        for (var i = 0; i < choix.length; i++) {
          var c = choix[i].c, x = a.getAttribute('data-' + c), y = b.getAttribute('data-' + c);
          var d = c === 'entree' ? x.localeCompare(y) : (+x) - (+y);
          if (d) return choix[i].sens === 'desc' ? -d : d;
        }
        return a.getAttribute('data-nom').localeCompare(b.getAttribute('data-nom'), 'fr');
      });
      l.forEach(function (x) { liste.appendChild(x); });
      document.querySelectorAll('[data-tri]').forEach(function (b) {
        var k = -1; choix.forEach(function (t, i) { if (t.c === b.getAttribute('data-tri')) k = i; });
        b.setAttribute('aria-pressed', k >= 0 ? 'true' : 'false');
        b.querySelector('i').textContent = k >= 0 ? (choix[k].sens === 'desc' ? ' ↓' : ' ↑') + (choix.length > 1 ? ' ' + (k + 1) : '') : '';
      });
    }
    document.querySelectorAll('[data-tri]').forEach(function (b) { b.addEventListener('click', function () {
      var c = b.getAttribute('data-tri'), t = choix.filter(function (x) { return x.c === c; })[0];
      if (!t) choix.push({ c: c, sens: 'desc' }); else if (t.sens === 'desc') t.sens = 'asc'; else choix = choix.filter(function (x) { return x !== t; });
      trier();
    }); });
    document.querySelector('.ls-raz').addEventListener('click', function () { choix = []; trier(); });
  })();</script>`;
}
const STYLE_LISTE = `<style>
  .vues { display:inline-grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:999px; background:var(--surface-2,#151515); margin:0 0 14px; }
  .vues a { padding:8px 18px; border-radius:999px; color:var(--doux); font-weight:700; font-size:14px; text-decoration:none; text-align:center; }
  .vues a[aria-current] { background:#fff; color:#000; }
  .ls-tris { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
  .ls-tris button { padding:8px 13px; border-radius:999px; border:1px solid var(--bord-fort); background:transparent; color:#fff; font:600 13px var(--police); cursor:pointer; }
  .ls-tris button[aria-pressed="true"] { background:#fff; color:#000; border-color:#fff; } .ls-tris i { font-style:normal; }
  .ls-tris .ls-raz { color:var(--doux); border-style:dashed; }
  .ls-liste { display:grid; gap:6px; }
  .ls-ligne { display:grid; grid-template-columns:minmax(0, 2fr) repeat(5, minmax(0, 1fr)); gap:10px; align-items:center; padding:12px 14px; border-radius:14px; background:var(--surface); border:1px solid var(--bord); color:#fff; text-decoration:none; }
  .ls-nom { display:flex; flex-direction:column; min-width:0; } .ls-nom b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .ls-nom small { color:var(--doux); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ls-col { display:flex; flex-direction:column; align-items:flex-start; font-size:13.5px; } .ls-col small { color:var(--doux); font-size:11.5px; } .ls-col .rouge { color:#ff8f8f; }
  @media (max-width: 720px) { .ls-ligne { grid-template-columns:1fr 1fr 1fr; } .ls-nom { grid-column:1 / -1; } }
</style>`;
function pageEleves(config, { espace, eleves, sansDiscord = [], message, erreur, vue = 'kanban' }) {
  const parColonne = (n) => eleves.filter((e) => (n === 5 ? e.etape >= 5 : e.etape === n));
  const donnees = {};
  for (const e of eleves) donnees[e.id] = { nom: e.nom, etape: e.etape, compte: e.compte || '', niche: e.niche || '', pays: e.pays || '', niveau: e.niveau || '', entree: e.entree || '', manquants: e.manquants };
  const script = `
(function () {
  var D = ${JSON.stringify({ eleves: donnees, colonnes: COLONNES }).replace(/</g, '\\u003c')};
  var dlg = document.getElementById('dlg-etape'), choisi = null;
  function q(s) { return dlg.querySelector(s); }
  function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  function titre(n) { return D.colonnes.filter(function (c) { return c.n === n; })[0].titre; }
  function detail() {
    var e = D.eleves[choisi], cible = +(q('input[name=cible]:checked') || {}).value || 0;
    var zone = q('#detail'), html = '';
    q('#confirmer').disabled = !cible || cible === e.etape;
    if (!cible || cible === e.etape) { zone.innerHTML = '<p class="doux" style="margin:0">Choisis l\\'étape où le placer.</p>'; return; }
    if (cible > e.etape) {
      var blocs = [];
      for (var k = e.etape; k < cible; k++) {
        var m = (e.manquants && e.manquants[k]) || [];
        if (m.length) blocs.push('<b>Étape ' + k + ' · ' + esc(titre(k)) + '</b><ul>' + m.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>');
      }
      html += blocs.length
        ? '<div class="manquants"><p>Ces étapes n\\'ont pas été validées sur la plateforme :</p>' + blocs.join('') + '<p style="margin:0">Es-tu sûr de le faire passer à l\\'étape ' + cible + ' malgré tout ?</p></div>'
        : '<p class="doux" style="margin:0 0 10px">Tout a été validé jusqu\\'ici.</p>';
      if (cible >= 3 && !e.compte) html += '<div class="champs-compte"><div class="champ large"><label for="f-compte">Lien de son compte TikTok (obligatoire)</label><input id="f-compte" name="compte" placeholder="https://www.tiktok.com/@compte" required></div>'
        + '<div class="champ"><label for="f-niche">Niche</label><input id="f-niche" name="niche"></div><div class="champ"><label for="f-pays">Pays cible</label><input id="f-pays" name="pays"></div></div>';
      if (e.etape <= 1 && !e.niveau) html += '<div class="champs-compte"><div class="champ large"><label for="f-niveau">Son profil type</label><select id="f-niveau" name="niveau"><option value="L2">L2</option><option value="L1">L1</option></select></div></div>';
      html += '<p class="doux petit" style="margin:0">Bob le prévient : « Étape ' + cible + ' ouverte ».</p>';
    } else {
      html = '<p style="margin:0">Le remettre à l\\'étape ' + cible + ' (' + esc(titre(cible)) + ') ?</p>';
    }
    zone.innerHTML = html;
  }
  function ouvrir(id, cible) {
    var e = D.eleves[id]; if (!e) return;
    choisi = id;
    q('#dlg-nom').textContent = e.nom;
    q('#erreur').textContent = '';
    dlg.querySelectorAll('input[name=cible]').forEach(function (r) { r.checked = +r.value === cible; r.disabled = +r.value === e.etape; });
    detail();
    dlg.showModal();
  }
  dlg.querySelectorAll('input[name=cible]').forEach(function (r) { r.onchange = detail; });
  q('#annuler').onclick = function () { dlg.close(); };
  q('#confirmer').onclick = function () {
    var b = this, corps = { etape: +(q('input[name=cible]:checked') || {}).value };
    ['compte', 'niche', 'pays', 'niveau'].forEach(function (k) { var f = q('[name=' + k + ']'); if (f) corps[k] = f.value; });
    if (corps.etape >= 3 && !D.eleves[choisi].compte && !(corps.compte || '').trim()) { q('#erreur').textContent = 'Renseigne son compte TikTok.'; return; }
    b.disabled = true;
    fetch('/admin/eleves/' + encodeURIComponent(choisi) + '/etape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.erreur) { q('#erreur').textContent = d.erreur; b.disabled = false; return; } location.href = '/admin/eleves?fait=' + d.etape + '#colonne-' + d.etape; })
      .catch(function () { q('#erreur').textContent = 'Connexion impossible. Réessaie.'; b.disabled = false; });
  };
  // Glisser-déposer (ordinateur) et bouton Déplacer (téléphone).
  var tire = null;
  document.querySelectorAll('.eleve[draggable=true]').forEach(function (c) {
    c.addEventListener('dragstart', function (ev) { tire = c.getAttribute('data-id'); c.classList.add('deplace'); ev.dataTransfer.setData('text/plain', tire); ev.dataTransfer.effectAllowed = 'move'; });
    c.addEventListener('dragend', function () { c.classList.remove('deplace'); });
    c.querySelector('.deplacer').onclick = function () { ouvrir(c.getAttribute('data-id'), 0); };
  });
  document.querySelectorAll('.colonne[data-etape]').forEach(function (col) {
    var n = +col.getAttribute('data-etape');
    col.addEventListener('dragover', function (ev) { if (tire && n <= 4) { ev.preventDefault(); col.classList.add('survol'); } });
    col.addEventListener('dragleave', function () { col.classList.remove('survol'); });
    col.addEventListener('drop', function (ev) {
      ev.preventDefault(); col.classList.remove('survol');
      var id = tire || ev.dataTransfer.getData('text/plain'); tire = null;
      if (id && D.eleves[id] && D.eleves[id].etape !== n) ouvrir(id, n);
    });
  });
  // Compléter ses informations (compte TikTok, niche, pays, niveau, date d'entrée), en une fois.
  var di = document.getElementById('dlg-infos'), infosDe = null;
  document.querySelectorAll('.eleve .infos').forEach(function (b) {
    b.onclick = function () {
      infosDe = b.closest('.eleve').getAttribute('data-id');
      var e = D.eleves[infosDe]; if (!e) return;
      di.querySelector('#i-nom').textContent = e.nom;
      ['compte', 'niche', 'pays', 'niveau', 'entree'].forEach(function (k) { di.querySelector('[name=' + k + ']').value = e[k] || ''; });
      di.querySelector('#i-erreur').textContent = '';
      di.showModal();
    };
  });
  di.querySelector('#i-annuler').onclick = function () { di.close(); };
  di.querySelector('#i-enregistrer').onclick = function () {
    var b = this, corps = {};
    ['compte', 'niche', 'pays', 'niveau', 'entree'].forEach(function (k) { corps[k] = di.querySelector('[name=' + k + ']').value; });
    b.disabled = true;
    fetch('/admin/eleves/' + encodeURIComponent(infosDe) + '/infos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.erreur) { di.querySelector('#i-erreur').textContent = d.erreur; b.disabled = false; return; } location.href = '/admin/eleves?fait=infos'; })
      .catch(function () { di.querySelector('#i-erreur').textContent = 'Connexion impossible. Réessaie.'; b.disabled = false; });
  };

  // Arrivée depuis une fiche : « Changer d'étape ».
  var depuis = new URLSearchParams(location.search).get('eleve');
  if (depuis && D.eleves[depuis]) ouvrir(depuis, 0);
})();`;
  const colonnes = COLONNES.map((c) => {
    const liste = parColonne(c.n);
    return `<section class="colonne${c.n === 5 ? ' goat' : ''}" data-etape="${c.n}" id="colonne-${c.n}" aria-label="${echapper(c.titre)}">
      <header><b><span class="num">${c.n === 5 ? 'G' : c.n}</span>${echapper(c.titre)}</b><small>${liste.length}</small></header>
      ${liste.map(carte).join('') || `<p class="vide">${c.n === 5 ? 'Se gagne avec les résultats suivis sur la plateforme.' : 'Glisse un élève ici.'}</p>`}
    </section>`;
  }).join('');
  return pageEspace('Élèves Elite', `${STYLE_KANBAN}
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Élèves Elite</h1></div><span class="doux petit">${eleves.length} élève(s)</span></div>
  ${message ? `<p class="message-ok" style="color:var(--ok);font-weight:600">${echapper(message)}</p>` : ''}
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${STYLE_LISTE}<nav class="vues" aria-label="Vue"><a href="/admin/eleves"${vue === 'kanban' ? ' aria-current="page"' : ''}>Kanban</a><a href="/admin/eleves?vue=liste"${vue === 'liste' ? ' aria-current="page"' : ''}>Liste</a></nav>
  ${vue === 'liste' ? vueListe(eleves) : `<p class="doux" style="margin:0 0 12px">Glisse un élève vers une autre étape (ou touche <b>Déplacer</b>). Tu peux le faire passer de l'étape 1 à l'étape 4 ;
    GOAT se gagne seulement avec les résultats suivis sur la plateforme.</p>
  <div class="kanban">${colonnes}</div>`}
  <form class="carte ajout" method="post" action="/admin/eleves/ajouter" style="margin-top:16px">
    <div class="champ"><label for="a-pseudo">Ajouter un élève déjà accompagné (pseudo Discord)</label><input id="a-pseudo" name="pseudo" placeholder="ex. awa_27" required autocapitalize="none" autocorrect="off" spellcheck="false"></div>
    <div class="champ"><label for="a-entree">Entrée dans l'accompagnement</label><input id="a-entree" name="entree" type="date"></div>
    <button class="bouton" type="submit" style="margin:0">Ajouter</button>
  </form>
  ${sansDiscord.length ? `<div class="carte"><h2>Elite sans compte Discord relié</h2><p class="doux petit" style="margin:0 0 8px">Ils doivent se connecter au site avec leur compte Discord pour apparaître ici.</p>
    ${sansDiscord.map((m) => `<div class="seance"><div><b>${echapper(m.nom)}</b> · <span class="doux petit">${echapper(m.email)}</span></div></div>`).join('')}</div>` : ''}
  <dialog id="dlg-infos" class="fenetre">
    <h2 style="margin:0 0 10px">Infos de <span id="i-nom"></span></h2>
    <div class="champs-compte">
      <div class="champ large"><label for="i-compte">Lien du compte TikTok</label><input id="i-compte" name="compte" placeholder="https://www.tiktok.com/@compte"></div>
      <div class="champ"><label for="i-niche">Niche</label><input id="i-niche" name="niche"></div>
      <div class="champ"><label for="i-pays">Pays cible</label><input id="i-pays" name="pays"></div>
      <div class="champ"><label for="i-niveau">Profil type</label><select id="i-niveau" name="niveau"><option value="">—</option><option value="L1">L1</option><option value="L2">L2</option></select></div>
      <div class="champ"><label for="i-entree">Entrée</label><input id="i-entree" name="entree" type="date"></div>
    </div>
    <p class="doux petit" style="margin:0">La date d'entrée fait partir ses 90 jours.</p>
    <p id="i-erreur" class="erreur-form" style="margin:8px 0 0"></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button id="i-annuler" class="bouton secondaire" type="button" style="margin:0">Annuler</button>
      <button id="i-enregistrer" class="bouton" type="button" style="margin:0">Enregistrer</button></div>
  </dialog>
  <dialog id="dlg-etape">
    <h2 style="margin:0 0 4px">Déplacer <span id="dlg-nom"></span></h2>
    <div class="cibles">${COLONNES.filter((c) => c.n <= 4).map((c) => `<label><input type="radio" name="cible" value="${c.n}"><b>${c.n}</b>${echapper(c.titre)}</label>`).join('')}</div>
    <div id="detail"></div>
    <p id="erreur" class="erreur-form" style="margin:8px 0 0"></p>
    <div class="deux-boutons" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button id="annuler" class="bouton secondaire" type="button" style="margin:0">Annuler</button>
      <button id="confirmer" class="bouton" type="button" style="margin:0">Oui, le faire passer</button></div>
  </dialog>`, espace, 'eleves', { script });
}

module.exports = { pageEleves, COLONNES };
