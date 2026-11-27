'use strict';

const { gras } = require('./admin-notifs');

// Parcours de l'accompagnement Elite : Mon parcours, les étapes 1 à 3, la fiche du membre,
// et côté coach : À traiter et la validation d'un envoi. Voir docs/ACCOMPAGNEMENT-ELITE.md.
const { ICONE, echapper, formatDate, blocVideo } = require('./pages');
const { jourLisible, moisLisible } = require('./suivi');
const { pageEspace } = require('./pages-espace');
const { aliasCompte } = require('./tiktok');
// Le compte TikTok : son @alias, qui ouvre le profil.
const lienTikTok = (l) => (/^https:\/\//.test(l || '') ? `<a href="${echapper(l)}" target="_blank" rel="noopener">${echapper(aliasCompte(l))}</a>` : echapper(l || ''));

const ETAPES = [
  { n: 1, titre: 'Prise en main', court: 'Prise en main' },
  { n: 2, titre: 'Coaching d\'entrée', court: 'Coaching' },
  { n: 3, titre: 'Validation du contenu', court: 'Contenu' },
  { n: 4, titre: 'Publication et suivi', court: 'Publication' },
  { n: 5, titre: 'GOAT', court: 'GOAT' },
];

const STYLE_PARCOURS = `<style>
  .etapes { display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin:4px 0 18px; padding:0; list-style:none; }
  .etapes li { display:grid; gap:6px; justify-items:center; text-align:center; font-size:11px; color:var(--gris); min-width:0; }
  .etapes .rond-etape { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; border:2px solid var(--bord-fort); font-weight:800; font-size:12px; color:var(--gris); background:var(--fond); }
  .etapes li[data-etat="fait"] { color:var(--doux); }
  .etapes li[data-etat="fait"] .rond-etape { border-color:var(--ok); background:var(--ok); color:#000; }
  .etapes li[data-etat="fait"] .rond-etape svg { width:16px; height:16px; stroke-width:3; }
  .etapes li[data-etat="encours"] { color:#fff; font-weight:700; }
  .etapes li[data-etat="encours"] .rond-etape { border-color:#fff; color:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.12); }
  .etapes span.nom { overflow-wrap:anywhere; line-height:1.25; }
  .delai { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:12.5px; font-weight:700; border:1px solid var(--bord-fort); color:#fff; }
  .delai::before { content:""; width:7px; height:7px; border-radius:50%; background:currentColor; }
  .delai[data-niveau="urgent"] { color:#f1d38a; border-color:rgba(241,211,138,.45); }
  .delai[data-niveau="retard"] { color:var(--erreur); border-color:rgba(255,77,77,.5); }
  .a-faire { border-color:#fff; }
  .a-faire h2 { font-size:19px; margin:8px 0 6px; }
  .envoi { display:grid; gap:12px; }
  .envoi form { display:grid; gap:12px; }
  .envoi-tete { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .envoi-tete h2 { margin:0; font-size:16px; }
  .etat { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface-2); color:var(--doux); }
  .etat svg { width:14px; height:14px; stroke-width:3; }
  .etat[data-etat="valide"] { background:rgba(61,220,132,.14); color:var(--ok); }
  .etat[data-etat="attente"] { background:rgba(241,211,138,.12); color:#f1d38a; }
  .etat[data-etat="corriger"] { background:rgba(255,77,77,.12); color:var(--erreur); }
  .champ { display:grid; gap:6px; }
  .champ label { font-weight:600; font-size:14px; }
  .champ small { color:var(--doux); font-size:12px; }
  textarea, select { width:100%; padding:12px 14px; border-radius:14px; border:1px solid var(--bord-fort); background:#000; color:#fff; font:14px/1.5 var(--police); }
  textarea { min-height:110px; resize:vertical; }
  .fichier { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px dashed var(--bord-fort); border-radius:14px; color:var(--doux); font-size:13px; cursor:pointer; }
  .fichier b { color:#fff; }
  .barre { height:8px; border-radius:8px; background:var(--surface-2); overflow:hidden; }
  .barre i { display:block; height:100%; width:0; background:#fff; }
  .erreur-envoi { color:var(--erreur); font-size:13px; margin:0; min-height:0; }
  .erreur-envoi:empty { display:none; }
  .remarque { padding:14px; border-radius:14px; background:var(--surface-2); border:1px solid var(--bord); display:grid; gap:8px; }
  .remarque .qui { font-size:12px; color:var(--doux); }
  .remarque p { margin:0; overflow-wrap:anywhere; }
  .remarque a { color:#fff; }
  .remarque .images { display:flex; flex-wrap:wrap; gap:8px; }
  .remarques-liste { display:grid; gap:8px; margin-top:12px; }
  .remarque.compacte { display:block; padding:12px 14px; }
  .remarque.compacte > summary { list-style:none; cursor:pointer; display:grid; gap:4px; } .remarque.compacte > summary::-webkit-details-marker { display:none; }
  .remarque.compacte .apercu { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:14px; overflow-wrap:anywhere; }
  .remarque.compacte[open] .apercu { display:none; }
  .remarque.compacte[open] > :not(summary) { margin-top:8px; }
  .remarques-liste.repliee > :nth-child(4) { opacity:.5; } .remarques-liste.repliee > :nth-child(5) { opacity:.22; pointer-events:none; }
  .remarques-liste.repliee > :nth-child(n+6) { display:none; }
  .remarque .images img { width:100%; max-width:320px; border-radius:10px; border:1px solid var(--bord); }
  .remarque[data-type="corriger"] { border-color:rgba(255,77,77,.45); }
  .recap { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .recap div { padding:12px; border-radius:14px; background:var(--surface-2); min-width:0; }
  .recap b { display:block; font-size:20px; letter-spacing:-0.02em; overflow-wrap:anywhere; }
  .recap span { color:var(--doux); font-size:12px; }
  .creneaux { display:grid; grid-template-columns:repeat(auto-fill, minmax(92px, 1fr)); gap:8px; }
  .creneaux label { position:relative; display:grid; place-items:center; margin:0; padding:10px 8px; border-radius:12px; border:1px solid var(--bord-fort); cursor:pointer; font-size:13px; text-align:center; }
  .creneaux input { position:absolute; opacity:0; pointer-events:none; }
  .creneaux label:has(input:checked) { background:#fff; color:#000; border-color:#fff; }
  .deux-boutons { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .deux-boutons .bouton { margin-top:0; }
  .bouton.vert { background:var(--ok); border-color:var(--ok); color:#000; }
  .ligne-envoi { display:flex; align-items:center; gap:14px; padding:14px 0; border-top:1px solid var(--bord); }
  .ligne-envoi:first-of-type { border-top:0; padding-top:4px; }
  .ligne-envoi .qui { flex:1; min-width:0; }
  .ligne-envoi .qui b { display:block; }
  .ligne-envoi .qui span { color:var(--doux); font-size:13px; }
  .ligne-envoi .bouton { width:auto; min-height:38px; margin:0; padding:8px 16px; }
  .note-ia { font-size:28px; font-weight:800; letter-spacing:-0.03em; }
  .note-ia small { font-size:14px; color:var(--doux); font-weight:600; }
  .apercus { display:flex; flex-wrap:wrap; gap:8px; }
  .apercus img { width:72px; height:72px; object-fit:cover; border-radius:8px; border:1px solid var(--bord); }
  .ajouts-envoi { display:grid; gap:8px; } .ajouts-envoi summary { list-style:none; cursor:pointer; display:inline-block; padding:8px 14px; border-radius:999px; border:1px solid var(--bord-fort,#333); font-weight:700; font-size:13.5px; }
  .ajouts-envoi summary::-webkit-details-marker { display:none; } .ajouts-envoi details[open] summary { background:#fff; color:#000; } .ajouts-envoi textarea { margin-top:8px; }
  .apercu-img { position:relative; display:inline-block; } .apercu-img.principale img { width:110px; outline:2px solid #c8f23a; outline-offset:1px; }
  .apercu-img button { position:absolute; top:-7px; right:-7px; width:24px; height:24px; border-radius:50%; border:0; background:#ff3b30; color:#fff; font:700 15px/24px var(--police); cursor:pointer; padding:0; }
  details > summary { cursor:pointer; font-weight:600; }
  .message-ok { color:var(--ok); font-weight:600; }
  .calcul-gain { margin:0; padding:10px 12px; border-radius:12px; background:var(--surface-2); color:var(--doux); font-size:14px; }
  .calcul-gain b { color:#fff; }
  .barre-objectifs { height:10px; border-radius:10px; background:var(--surface-2); overflow:hidden; margin:14px 0 10px; }
  .barre-objectifs i { display:block; height:100%; background:var(--ok); }
  .paliers { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; font-size:12px; color:var(--gris); text-align:center; }
  .paliers span { display:inline-flex; align-items:center; justify-content:center; gap:3px; }
  .paliers span[data-atteint="1"] { color:var(--ok); font-weight:700; }
  .paliers svg { width:13px; height:13px; stroke-width:3; }
  .grille-champs { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 140px), 1fr)); gap:10px; align-items:end; }
  .trois { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
  .trois input { margin:0; min-width:0; }
  .captures-cr { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
  .captures-cr figure { margin:0; display:grid; gap:6px; }
  .captures-cr img { width:100%; max-height:460px; object-fit:contain; background:#000; border-radius:12px; border:1px solid var(--bord); }
  .captures-cr figcaption { color:var(--doux); font-size:12.5px; }
  .grille-champs .champ input { margin:0; }
  .video-cr { padding:14px; border-radius:14px; border:1px solid var(--bord); display:grid; gap:10px; }
  .video-cr a { color:#fff; overflow-wrap:anywhere; font-size:13px; }
  table.cr { width:100%; border-collapse:collapse; font-size:13px; }
  table.cr th, table.cr td { text-align:left; padding:8px 6px; border-top:1px solid var(--bord); vertical-align:top; }
  table.cr th { color:var(--doux); font-weight:600; border-top:0; }
  .compteur-sinistres { font-size:28px; font-weight:800; letter-spacing:-0.03em; }
  @media (min-width: 960px) { .etapes li { font-size:12.5px; } .colonnes-2 { display:grid; grid-template-columns:minmax(0, 1fr) 360px; gap:24px; align-items:start; } }
</style>`;

// Heures affichées dans le fuseau du téléphone de la personne (la page part de l'heure GMT).
const SCRIPT_LOCAL = `
(function () {
  var longs = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
  var courts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  document.querySelectorAll('[data-local]').forEach(function (el) {
    var d = new Date(el.getAttribute('data-local'));
    if (isNaN(d.getTime())) return;
    var t;
    if (el.hasAttribute('data-heure')) {
      t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      var ref = new Date(el.getAttribute('data-ref'));
      if (!isNaN(ref.getTime()) && ref.toDateString() !== d.toDateString()) t += ' (nuit)';
    } else if (el.hasAttribute('data-jour')) {
      t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } else {
      t = d.toLocaleString('fr-FR', el.hasAttribute('data-court') ? courts : longs);
    }
    el.textContent = t.charAt(0).toUpperCase() + t.slice(1);
  });
  var o = -new Date().getTimezoneOffset() / 60;
  document.querySelectorAll('[data-fuseau]').forEach(function (el) { el.textContent = 'UTC' + (o >= 0 ? '+' : '') + o; });
})();`;

// Envoi d'une vidéo en deux temps (informations, puis la vidéo avec la barre de progression).
const scriptEnvoi = (maxMo) => `
(function () {
  document.querySelectorAll('form[data-envoi]').forEach(function (f) {
    var input = f.querySelector('input[type=file]'), nom = f.querySelector('[data-nom]');
    if (input && nom) input.addEventListener('change', function () {
      if (input.files[0]) nom.textContent = input.files[0].name + ' · ' + Math.max(1, Math.round(input.files[0].size / 1048576)) + ' Mo';
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fichier = input.files[0], err = f.querySelector('.erreur-envoi'), barre = f.querySelector('.barre'), btn = f.querySelector('button[type=submit]');
      err.textContent = '';
      if (!fichier) { err.textContent = 'Choisis ta vidéo.'; return; }
      if (fichier.size > ${maxMo} * 1048576) { err.textContent = 'Vidéo trop lourde (${maxMo} Mo maximum).'; return; }
      var corps = { emplacement: f.getAttribute('data-envoi') };
      if (f.getAttribute('data-axe')) corps.axe = f.getAttribute('data-axe');
      var note = f.querySelector('[name=note]'), retour = f.querySelector('[name=retour]');
      if (note) corps.note = note.value;
      if (retour) corps.retour = retour.value;
      var rem = f.querySelector('[name=remarque]'), scr = f.querySelector('[name=script]');
      if (rem && rem.value.trim()) corps.remarque = rem.value;
      if (scr && scr.value.trim()) corps.script = scr.value;
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      fetch('/api/parcours/envoi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) throw new Error(x.d.erreur || 'Envoi impossible.');
          return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/parcours/envoi/' + x.d.id + '/video');
            xhr.setRequestHeader('Content-Type', fichier.type || 'video/mp4');
            xhr.upload.onprogress = function (ev) {
              if (!ev.lengthComputable) return;
              var p = Math.round(ev.loaded / ev.total * 100);
              barre.hidden = false; barre.firstElementChild.style.width = p + '%'; btn.textContent = 'Envoi : ' + p + ' %';
            };
            xhr.onload = function () {
              var d = {};
              try { d = JSON.parse(xhr.responseText); } catch (e2) { d = {}; }
              if (xhr.status === 200) resolve(); else reject(new Error(d.erreur || 'Envoi impossible. Réessaie.'));
            };
            xhr.onerror = function () { reject(new Error('Connexion interrompue. Réessaie.')); };
            xhr.send(fichier);
          });
        })
        .then(function () { location.reload(); })
        .catch(function (e3) { err.textContent = e3.message; btn.disabled = false; btn.textContent = 'Réessayer'; });
    });
  });
})();`;

// Images jointes par le coach (remarques, décisions) : envoyées une par une, puis citées par leur nom.
const SCRIPT_IMAGES = `
(function () {
  document.querySelectorAll('[data-images]').forEach(function (zone) {
    var input = zone.querySelector('input[type=file]'), cache = zone.querySelector('input[type=hidden]'), liste = zone.querySelector('.apercus');
    var adresse = zone.getAttribute('data-images') || '/admin/images', une = zone.hasAttribute('data-une'), max = +zone.getAttribute('data-max') || 0;
    var noms = cache.value ? cache.value.split(',').filter(Boolean) : [];
    // Avec data-max : chaque image a un × pour la retirer ; la première est la principale.
    function dessiner() {
      if (!max) return;
      liste.innerHTML = '';
      noms.forEach(function (n, i) {
        var c = document.createElement('span'); c.className = 'apercu-img' + (i === 0 ? ' principale' : '');
        var im = document.createElement('img'); im.src = '/fichiers/images/' + n; im.alt = ''; c.appendChild(im);
        var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Retirer cette image');
        x.onclick = function () { noms.splice(i, 1); cache.value = noms.join(','); dessiner(); };
        c.appendChild(x); liste.appendChild(c);
      });
      var l = zone.querySelector('label.fichier'); if (l) l.hidden = noms.length >= max;
    }
    dessiner();
    input.addEventListener('change', function () {
      Array.prototype.forEach.call(input.files, function (f) {
        if (max && noms.length >= max) return;
        var x = new XMLHttpRequest();
        x.open('POST', adresse);
        x.setRequestHeader('Content-Type', f.type || 'image/jpeg');
        x.onload = function () {
          var d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { d = {}; }
          if (x.status === 200 && d.nom) {
            if (une) { noms = []; liste.innerHTML = ''; }
            if (max && noms.length >= max) return;
            noms.push(d.nom); cache.value = noms.join(',');
            if (max) { dessiner(); return; }
            var i = document.createElement('img'); i.src = '/fichiers/images/' + d.nom; i.alt = ''; liste.appendChild(i);
          } else { alert(d.erreur || 'Image refusée.'); }
        };
        x.send(f);
      });
      input.value = '';
    });
  });
})();`;

// ---------- Petits blocs ----------
function frise(etapeActuelle) {
  return `<ol class="etapes" aria-label="Étapes de l'accompagnement">${ETAPES.map((e) => {
    const etat = e.n < etapeActuelle ? 'fait' : e.n === etapeActuelle ? 'encours' : 'attente';
    return `<li data-etat="${etat}"><span class="rond-etape">${etat === 'fait' ? ICONE.ok : e.n === 5 ? 'G' : e.n}</span><span class="nom">${echapper(e.court)}</span></li>`;
  }).join('')}</ol>`;
}

// « Il te reste 2 j 5 h » : jaune dans le dernier quart du délai, rouge en retard.
function delai(d, maintenant = new Date()) {
  if (!d || !d.fin) return '';
  const reste = new Date(d.fin) - maintenant;
  const h = Math.abs(reste) / 3600000;
  const texte = h >= 48 ? `${Math.floor(h / 24)} j ${Math.floor(h % 24)} h` : h >= 1 ? `${Math.floor(h)} h` : `${Math.max(1, Math.round(h * 60))} min`;
  const niveau = reste < 0 ? 'retard' : d.duree && reste < d.duree / 4 ? 'urgent' : 'normal';
  return `<span class="delai" data-niveau="${niveau}">${reste < 0 ? `En retard de ${texte}` : `Il te reste ${texte}`}</span>`;
}

const ETATS = { vide: 'À envoyer', brouillon: 'À envoyer', attente: 'En attente de validation', corriger: 'À corriger', valide: 'Validé', force: 'Passé par le coach' };
const etatPuce = (cle) => `<span class="etat" data-etat="${cle === 'brouillon' ? 'vide' : cle}">${cle === 'valide' ? ICONE.ok : ''}${ETATS[cle] || cle}</span>`;

// Texte d'une remarque : liens cliquables, retours à la ligne gardés.
// Mise en forme des messages du coach : **gras**, *italique*, __souligné__ (comme sur Discord), liens cliquables.
function miseEnForme(s) {
  return s.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/__([^_\n]+?)__/g, '<u>$1</u>').replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
}
function texteRiche(t) {
  return echapper(t || '').split(/(https?:\/\/[^\s<]+)/g)
    .map((x, i) => (i % 2 ? `<a href="${x}" target="_blank" rel="noopener">${x}</a>` : miseEnForme(x))).join('').replace(/\n/g, '<br>');
}
// Texte sans les marques de mise en forme (aperçus).
const texteSimple = (t) => String(t || '').replace(/\*\*|__|\*/g, '');
// Barre de mise en forme (gras, italique, souligné) au-dessus d'un champ de texte : entoure la sélection.
const barreMiseEnForme = (cible) => `<div class="barre-format" data-pour="${cible}" role="toolbar" aria-label="Mise en forme">
  <button type="button" data-marque="**" title="Gras"><b>G</b></button><button type="button" data-marque="*" title="Italique"><i>I</i></button><button type="button" data-marque="__" title="Souligné"><u>S</u></button></div>`;
const SCRIPT_MISE_EN_FORME = `(function () {
  document.querySelectorAll('.barre-format').forEach(function (b) {
    var t = document.getElementById(b.getAttribute('data-pour')); if (!t) return;
    b.querySelectorAll('[data-marque]').forEach(function (x) { x.addEventListener('mousedown', function (e) { e.preventDefault(); });
      x.addEventListener('click', function () {
        var m = x.getAttribute('data-marque'), d = t.selectionStart, f = t.selectionEnd, v = t.value, sel = v.slice(d, f) || 'texte';
        t.value = v.slice(0, d) + m + sel + m + v.slice(f); t.focus(); t.setSelectionRange(d + m.length, d + m.length + sel.length);
      }); });
  });
})();`;
const STYLE_FORMAT = `<style>
  .barre-format { display:flex; gap:6px; margin:0 0 -4px; } .barre-format button { width:38px; height:34px; border-radius:10px; border:1px solid var(--bord-fort,#333); background:transparent; color:#fff; font:600 15px var(--police); cursor:pointer; }
  .remarque .titre-msg { display:block; font-weight:800; color:#fff; font-size:15px; margin:2px 0 2px; }
</style>`;
function remarque(r) {
  return `<div class="remarque" data-type="${echapper(r.type || 'remarque')}">
    <span class="qui">Ton coach · ${echapper(formatDate(r.cree_le))}</span>${r.titre ? `<b class="titre-msg">${echapper(r.titre)}</b>` : ''}
    ${r.texte && r.texte !== '(image)' ? `<p>${texteRiche(r.texte)}</p>` : ''}
    ${(r.images || []).length ? `<div class="images">${r.images.map((n) => `<a href="/fichiers/images/${echapper(n)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(n)}" alt="Image jointe par le coach" loading="lazy"></a>`).join('')}</div>` : ''}
  </div>`;
}
function remarqueCompacte(r) {
  const n = (r.images || []).length;
  return `<details class="remarque compacte" data-type="${echapper(r.type || 'remarque')}">
    <summary><span class="qui">Ton coach · ${echapper(formatDate(r.cree_le))}${r.modifie_le ? ' · modifiée' : ''}${n ? ` · ${n} image${n > 1 ? 's' : ''}` : ''}</span>
      ${r.titre ? `<b class="titre-msg">${echapper(r.titre)}</b>` : ''}<span class="apercu">${echapper(r.texte && r.texte !== '(image)' ? texteSimple(r.texte) : 'Image jointe par le coach')}</span></summary>
    ${r.texte && r.texte !== '(image)' ? `<p>${texteRiche(r.texte)}</p>` : ''}
    ${n ? `<div class="images">${r.images.map((x) => `<a href="/fichiers/images/${echapper(x)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(x)}" alt="Image jointe par le coach" loading="lazy"></a>`).join('')}</div>` : ''}
  </details>`;
}
// Les remarques en liste : les 3 premières bien visibles, puis en fondu ; « Tout afficher » montre le reste.
function listeRemarques(remarques, { toutes } = {}) {
  if (!remarques.length) return '<p class="doux" style="margin:0">Pas encore de remarque.</p>';
  return `<div class="remarques-liste${toutes || remarques.length <= 3 ? '' : ' repliee'}">${remarques.map(remarqueCompacte).join('')}</div>
    ${!toutes && remarques.length > 3 ? `<button class="bouton secondaire tout-afficher" type="button" onclick="var l=this.previousElementSibling;l.classList.remove('repliee');this.remove();">Tout afficher (${remarques.length})</button>` : ''}`;
}
const zoneImages = () => `<div data-images="/admin/images">
  <label class="fichier">${ICONE.plus}<span><b>Joindre des images</b><br>Captures, exemples…</span><input type="file" accept="image/*" multiple hidden></label>
  <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>`;
// Une capture envoyée par le membre (compte, revenus).
const zoneCapture = (nom, titre, aide, deja) => `<div data-images="/api/parcours/image" data-une>
  <label class="fichier">${ICONE.plus}<span><b>${echapper(titre)}</b><br>${echapper(aide)}</span><input type="file" accept="image/*" hidden></label>
  <input type="hidden" name="${nom}" value="${echapper(deja || '')}"><div class="apercus" style="margin-top:8px">${deja ? `<img src="/fichiers/images/${echapper(deja)}" alt="">` : ''}</div></div>`;

// Remarque et script de la vidéo : facultatifs, ouverts d'un clic.
const champsFacultatifs = (id) => `<div class="ajouts-envoi">
    <details><summary>+ Ajouter une remarque</summary><textarea name="remarque" maxlength="2000" placeholder="Ce que tu veux que ton coach regarde, une question…" id="remarque-${id}"></textarea></details>
    <details><summary>+ Coller le script de la vidéo</summary><textarea name="script" maxlength="8000" placeholder="Colle ici le script français de ta vidéo : ton coach le relit aussi." id="script-${id}" style="min-height:140px"></textarea></details></div>`;
function formVideo(emplacement, { etape1 = false, libelle, ajouts = false, axe = null } = {}) {
  return `<form data-envoi="${emplacement}"${axe ? ` data-axe="${axe}"` : ''}>
    ${etape1 ? `<div class="champ"><label for="note-${emplacement}">Note donnée par l'IA</label><input id="note-${emplacement}" name="note" type="number" min="0" max="100" inputmode="numeric" placeholder="ex. 84" required><small>Sur 100, telle que l'IA te l'a donnée.</small></div>
    <div class="champ"><label for="retour-${emplacement}">Retour de l'IA</label><textarea id="retour-${emplacement}" name="retour" placeholder="Colle ici tout le retour de l'IA." required></textarea></div>` : ''}
    <label class="fichier">${ICONE.plus}<span><b>${echapper(libelle || 'Choisir la vidéo')}</b><br><span data-nom>MP4, MOV ou WEBM</span></span><input type="file" accept="video/*" hidden></label>
    ${ajouts ? champsFacultatifs(emplacement) : ''}
    <div class="barre" hidden><i></i></div>
    <p class="erreur-envoi" role="alert"></p>
    <button class="bouton" type="submit" style="margin-top:0">Envoyer</button>
  </form>`;
}

// Statistiques et objectifs (comptes rendus validés).
// Les récompenses TikTok sont en dollars : même écriture que TikTok ($1,308.95).
const dollars = (n, { centimes = true } = {}) => `${Number(n || 0) < 0 ? '-' : ''}$${Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: centimes ? 2 : 0, maximumFractionDigits: 2 })}`;
const euros = (n) => dollars(n);
function blocStats(s) {
  if (!s) return '';
  const regularite = s.joursDepuisEtape4 ? `${s.joursPublies} / ${s.joursDepuisEtape4} jours` : '—';
  return `<div class="carte"><h2>Statistiques</h2>
    <div class="recap">
      <div><b>${s.abonnes === null ? '—' : Number(s.abonnes).toLocaleString('fr-FR')}</b><span>abonnés</span></div>
      <div><b>${s.vuesTotal ? Number(s.vuesTotal).toLocaleString('fr-FR') : '—'}</b><span>vues au total</span></div>
      <div><b>${echapper(s.paysPrincipal || '—')}</b><span>pays principal des abonnés</span></div>
      <div><b>${s.videosPubliees}</b><span>vidéos publiées</span></div>
      <div><b>${regularite}</b><span>régularité (jours publiés)</span></div>
      <div><b>${euros(s.revenus28)}</b><span>revenus des 28 derniers jours</span></div>
    </div></div>`;
}
// Valeur d'un objectif dans son unité : « 4 200 vues », « 830 abonnés », « $42 ».
const nombreFr = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
const valeurObjectif = (o, n) => (o.type === 'revenus' ? dollars(n, { centimes: false }) : `${nombreFr(n)} ${o.type === 'vues' ? 'vues' : 'abonnés'}`);
function blocObjectifs(s, { lien, texteLien = 'Voir mon tableau de bord' } = {}) {
  if (!s) return '';
  const suivant = s.objectifs.find((o) => !o.atteint);
  const pct = suivant ? Math.min(100, Math.round((suivant.valeur / suivant.seuil) * 100)) : 100;
  const faits = s.objectifs.filter((o) => o.atteint).length;
  return `<div class="carte"><div class="envoi-tete"><h2>Prochain objectif</h2><span class="doux petit">${faits} / ${s.objectifs.length} atteints</span></div>
    ${suivant ? `<p style="margin:10px 0 0;font-size:18px"><b>${echapper(suivant.libelle)}</b></p>` : '<p style="margin:10px 0 0"><b>Tous les objectifs sont atteints.</b></p>'}
    <div class="barre-objectifs"><i style="width:${pct}%"></i></div>
    ${suivant ? `<p class="doux petit" style="margin:0">${valeurObjectif(suivant, suivant.valeur)} · ${pct} %</p>` : ''}
    ${lien ? `<a class="bouton secondaire" href="${echapper(lien)}">${echapper(texteLien)}</a>` : ''}</div>`;
}

// Compte rendu : le gain du jour calculé en direct pendant que le membre recopie son total.
const SCRIPT_GAIN = `
(function () {
  var champ = document.getElementById('total_mois');
  var sortie = document.querySelector('.calcul-gain');
  if (!champ || !sortie) return;
  function lire(v) {
    var s = String(v || '').trim().replace(/[$\u20ac\s\u00a0\u202f]/g, '');
    if (!s || !/^-?[\d.,]+$/.test(s)) return null;
    var vi = s.lastIndexOf(','), pt = s.lastIndexOf('.');
    if (vi >= 0 && pt >= 0) s = vi > pt ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (vi >= 0) s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (pt >= 0 && !(/\.\d{1,2}$/.test(s) && s.split('.').length === 2)) s = s.replace(/\./g, '');
    var n = Number(s); return isFinite(n) ? n : null;
  }
  function argent(n) { return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var avant = Number(champ.getAttribute('data-precedent')) || 0, jourAvant = champ.getAttribute('data-jour-precedent');
  var initial = sortie.innerHTML;
  function calculer() {
    var n = lire(champ.value);
    if (n === null) { sortie.innerHTML = initial; return; }
    var gain = Math.round((n - avant) * 100) / 100;
    sortie.innerHTML = 'Gain du jour : <b>' + argent(gain) + '</b>' + (jourAvant ? ' (' + argent(n) + ' − ' + argent(avant) + ', ton total du ' + jourAvant + ')' : ' (premier compte rendu du mois)')
      + (gain < 0 ? '. Ton total est plus bas que la dernière fois : vérifie le mois affiché.' : '.');
  }
  champ.addEventListener('input', calculer);
  calculer();
})();`;
const page = (titre, contenu, espace, actif, maxMo, plus = '') => pageEspace(titre, `${STYLE_PARCOURS}${STYLE_FORMAT}${contenu}`, espace, actif, {
  script: `${SCRIPT_LOCAL}${maxMo ? scriptEnvoi(maxMo) : ''}${SCRIPT_IMAGES}${contenu.includes('barre-format') ? SCRIPT_MISE_EN_FORME : ''}${plus}`,
});
const enTete = (n, titre, d) => `<div class="titre-page"><div><p class="etiquette">Étape ${n} sur 4</p><h1>${echapper(titre)}</h1></div>${delai(d)}</div>${frise(n)}`;
const jourDe = (p) => Math.min(90, Math.max(1, Math.floor((Date.now() - new Date(p.entree_le)) / 86400000) + 1));

// ---------- Régularité : la heatmap du mois (comme GitHub ou Duolingo) ----------
// activite : { 'AAAA-MM-JJ': nombre de tâches faites ce jour }. 1 tâche = vert foncé, 2 = plus clair, 3 et plus = le plus vif.
const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function blocHeatmap(activite = {}, aujourdhui = new Date().toISOString().slice(0, 10), { mois = 6, id = 'regularite' } = {}) {
  const [a, m] = aujourdhui.split('-').map(Number);
  const grilles = [];
  for (let k = mois - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(a, m - 1 - k, 1));
    const an = d.getUTCFullYear(); const mo = d.getUTCMonth();
    const nbJours = new Date(Date.UTC(an, mo + 1, 0)).getUTCDate();
    const decalage = (d.getUTCDay() + 6) % 7; // lundi en premier
    let cases = '<i class="hm-vide"></i>'.repeat(decalage);
    let actifs = 0; let taches = 0;
    for (let j = 1; j <= nbJours; j++) {
      const jour = `${an}-${String(mo + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
      const n = Number(activite[jour]) || 0;
      if (n) { actifs++; taches += n; }
      const niveau = jour > aujourdhui ? 'futur' : Math.min(n, 3);
      cases += `<i data-n="${niveau}"${jour === aujourdhui ? ' class="hm-auj"' : ''} title="${j} ${MOIS_NOMS[mo]} : ${n} tâche${n > 1 ? 's' : ''}"><span>${j}</span></i>`;
    }
    grilles.push(`<div class="hm-mois" data-mois="${k}"${k ? ' hidden' : ''}>
      <div class="hm-tete"><button type="button" class="hm-nav" data-aller="${k + 1}"${k === mois - 1 ? ' disabled' : ''} aria-label="Mois précédent">‹</button>
        <b>${MOIS_NOMS[mo].charAt(0).toUpperCase()}${MOIS_NOMS[mo].slice(1)} ${an}</b>
        <button type="button" class="hm-nav" data-aller="${k - 1}"${k === 0 ? ' disabled' : ''} aria-label="Mois suivant">›</button></div>
      <div class="hm-grille"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>${cases}</div>
      <p class="doux petit hm-resume">${actifs} jour${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''} · ${taches} tâche${taches > 1 ? 's' : ''} faite${taches > 1 ? 's' : ''}</p></div>`);
  }
  return `<div class="heatmap" id="${id}">${grilles.join('')}
    <div class="hm-legende"><span>0</span><i data-n="0"></i><i data-n="1"></i><i data-n="2"></i><i data-n="3"></i><span>3+ tâches</span></div></div>`;
}
const STYLE_HEATMAP = `<style>
  .heatmap .hm-tete { display:flex; align-items:center; justify-content:space-between; margin:0 0 10px; }
  .heatmap .hm-nav { width:36px; height:36px; border-radius:50%; border:1px solid var(--bord-fort,#333); background:transparent; color:#fff; font:600 20px/1 var(--police); cursor:pointer; }
  .heatmap .hm-nav:disabled { opacity:.25; cursor:default; }
  .heatmap .hm-grille { display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; }
  .heatmap .hm-grille > b { text-align:center; font-size:11px; color:var(--doux); font-weight:700; }
  .heatmap .hm-grille i { aspect-ratio:1; border-radius:7px; background:#1a1a1a; display:grid; place-items:center; font-style:normal; }
  .heatmap .hm-grille i span { font-size:10.5px; color:rgba(255,255,255,.45); font-weight:600; }
  .heatmap i[data-n="1"] { background:#0e4429; } .heatmap i[data-n="2"] { background:#26a641; } .heatmap i[data-n="3"] { background:#39d353; }
  .heatmap i[data-n="2"] span, .heatmap i[data-n="3"] span { color:rgba(0,0,0,.6); }
  .heatmap i[data-n="futur"] { background:transparent; border:1px dashed #222; }
  .heatmap i.hm-vide { background:transparent; }
  .heatmap i.hm-auj { outline:2px solid #fff; outline-offset:-2px; }
  .heatmap .hm-resume { margin:10px 0 0; }
  .heatmap .hm-legende { display:flex; align-items:center; gap:5px; justify-content:flex-end; margin-top:8px; font-size:11.5px; color:var(--doux); }
  .heatmap .hm-legende i { width:14px; height:14px; border-radius:4px; }
  .heatmap .hm-legende i[data-n="0"] { background:#1a1a1a; }
</style>`;
const SCRIPT_HEATMAP = `(function () {
  document.querySelectorAll('.heatmap').forEach(function (h) {
    h.addEventListener('click', function (e) {
      var b = e.target.closest('[data-aller]'); if (!b || b.disabled) return;
      var k = b.getAttribute('data-aller');
      h.querySelectorAll('.hm-mois').forEach(function (m) { m.hidden = m.getAttribute('data-mois') !== k; });
    });
  });
})();`;

// ---------- Membre : Mon parcours ----------
// Fenêtre de Mon parcours : ce qu'il reste à faire (à chaque ouverture) ; « Bravo » quand une nouvelle étape s'ouvre.
// La fenêtre « Ce qu'il te reste à faire » : la vidéo où le coach présente l'étape, puis les choses à faire.
function fenetreAFaire(r) {
  if (!r || (!r.items.length && !r.video)) return '';
  const etape = ETAPES.find((e) => e.n === r.etape) || { titre: '' };
  return `<style>
    .a-faire-liste { list-style:none; padding:0; margin:12px 0 0; display:grid; gap:8px; }
    .a-faire-liste a { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-radius:14px;
      border:1px solid var(--bord-fort); background:#141414; color:#fff; text-decoration:none; font-weight:600; font-size:14.5px; }
    .a-faire-liste a::after { content:'›'; font-size:22px; color:var(--doux); line-height:1; }
    .a-faire-liste li:first-child a { border-color:#fff; }
    .rebours-fenetre { margin:2px 0 12px; font:800 40px/1 var(--police); letter-spacing:.02em; font-variant-numeric:tabular-nums; color:#dff58f; }
    .rebours-fenetre[data-niveau="urgent"] { color:#ffcf6b; } .rebours-fenetre[data-niveau="retard"] { color:#ff6b6b; }
  </style>
  <dialog class="fenetre" id="a-faire" data-etape="${r.etape}" aria-labelledby="a-faire-titre">
    <button class="fermer" type="button" aria-label="Fermer" data-fermer>×</button>
    <p class="etiquette" style="margin:0 0 6px">${r.etape >= 5 ? 'GOAT' : `Étape ${r.etape} sur 4 · ${echapper(etape.titre)}`}</p>
    <h2 id="a-faire-titre" data-titre-normal>Ce qu'il te reste à faire</h2>
    <h2 data-titre-nouveau hidden>Bravo, étape ${r.etape} ouverte !</h2>
    ${r.fin ? `<p class="rebours-fenetre" data-fin="${echapper(r.fin)}" data-duree="${Number(r.duree) || 0}" aria-label="Temps restant">--:--:--</p>` : ''}
    ${r.video ? `<div class="video-etape" style="margin:10px 0 12px">${blocVideo(r.video, r.etape >= 5 ? 'GOAT : le mot du coach' : `Étape ${r.etape} : le mot du coach`)}</div>` : ''}
    ${r.items.length ? `<p class="doux" style="margin:0">${r.items.length > 1 ? `${r.items.length} choses à faire, la plus importante en premier.` : 'Une chose à faire maintenant.'}</p>` : ''}
    <ul class="a-faire-liste">${r.items.map((i) => `<li><a href="${echapper(i.lien)}">${echapper(i.texte)}</a></li>`).join('')}</ul>
  </dialog>
  <script>(function () {
    var d = document.getElementById('a-faire'); if (!d || !d.showModal) return;
    var e = d.getAttribute('data-etape'), avant = null;
    try { avant = localStorage.getItem('ovx-etape-vue'); localStorage.setItem('ovx-etape-vue', e); } catch (x) {}
    if (avant && avant !== e) { d.querySelector('[data-titre-normal]').hidden = true; d.querySelector('[data-titre-nouveau]').hidden = false; }
    d.querySelectorAll('[data-fermer]').forEach(function (b) { b.onclick = function () { d.close(); }; });
    // Fenêtre fermée : la vidéo s'arrête.
    d.addEventListener('close', function () { d.querySelectorAll('iframe').forEach(function (f) { var s = f.src; f.src = 'about:blank'; f.src = s; }); });
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    // Le décompte en temps réel : 11:59:58, 11:59:57…
    var r = d.querySelector('.rebours-fenetre');
    if (r) {
      var deux = function (n) { return (n < 10 ? '0' : '') + n; };
      var maj = function () {
        var reste = new Date(r.getAttribute('data-fin')) - Date.now(), duree = +r.getAttribute('data-duree') || 0, s = Math.floor(Math.abs(reste) / 1000);
        var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
        r.textContent = (reste < 0 ? '−' : '') + deux(h) + ':' + deux(m) + ':' + deux(s % 60);
        r.setAttribute('data-niveau', reste < 0 ? 'retard' : duree && reste < duree / 4 ? 'urgent' : '');
      };
      maj(); setInterval(maj, 1000);
    }
    setTimeout(function () { d.showModal(); }, 300); // la fenêtre arrive 0,3 s après la page
  })();</script>`;
}
function pageParcours(config, { espace, parcours: p, tache, prochain, derniere, formation, stats, rappel, activite = {}, aujourdhui, chaine = 0, lienWhop = null }) {
  return page('Mon parcours', `
  <div class="titre-page"><div><p class="etiquette">Overmaxx Elite · jour ${jourDe(p)} sur 90</p><h1>Mon parcours</h1></div></div>
  ${frise(p.etape)}
  ${fenetreAFaire(rappel)}
  <div class="colonnes-2">
    <div>
      <div class="carte a-faire">
        <div class="envoi-tete"><p class="etiquette" style="margin:0">À faire maintenant${p.etape <= 4 ? ` · étape ${p.etape}` : ''}</p>${delai(tache.delai)}</div>
        <h2>${echapper(tache.titre)}</h2>
        <p class="doux" style="margin:0">${echapper(tache.texte)}</p>
        <a class="bouton" href="${echapper(tache.lien)}">${echapper(tache.bouton)}</a>
      </div>
      <div class="carte"><div class="envoi-tete"><h2>Ma régularité</h2><span class="doux petit">${chaine >= 3 ? `🔥 ${chaine} jours d'affilée` : 'tâches faites par jour'}</span></div>
        <div style="margin-top:12px">${blocHeatmap(activite, aujourdhui, { id: 'regularite-parcours' })}</div></div>
      ${derniere ? `<div class="carte"><div class="envoi-tete"><h2>Dernière remarque du coach</h2><a class="doux petit" href="/remarques">Toutes les remarques</a></div>
        <div class="remarques-liste" style="margin-top:12px">${remarqueCompacte(derniere)}</div></div>` : ''}
      ${p.etape >= 4 ? blocObjectifs(stats, { lien: '/profil' }) : ''}
    </div>
    <div>
      <div class="carte">
        <h2>Prochain coaching</h2>
        ${prochain ? `<p style="margin:0"><b data-local="${echapper(prochain.toISOString())}">${echapper(formatDate(prochain.toISOString()))}</b></p><p class="doux petit" style="margin:4px 0 0">À ton heure (<span data-fuseau>GMT</span>).</p>`
    : '<p class="doux" style="margin:0">Aucun coaching prévu pour l\'instant.</p>'}
        ${p.etape >= 3 ? '<a class="bouton secondaire" href="/coaching">Mes coachings</a>' : ''}
      </div>
      <div class="carte">
        <div class="envoi-tete"><h2>Formation sur Whop</h2>${lienWhop ? `<a class="doux petit" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Ouvrir ›</a>` : ''}</div>
        ${formation ? `<div class="recap"><div><b>${formation.faites} / ${formation.total || '?'}</b><span>leçons terminées</span></div>
          <div><b>${formation.derniere ? echapper(formatDate(formation.derniere)) : '—'}</b><span>dernière activité</span></div></div>
          <p class="doux petit" style="margin:10px 0 0">Mis à jour tout seul depuis Whop : rien à cocher.</p>`
    : '<p class="doux" style="margin:0">Ta progression apparaîtra ici dès que ton accès Whop sera validé.</p>'}
        ${lienWhop ? `<a class="bouton secondaire" href="${echapper(lienWhop)}" target="_blank" rel="noopener">Continuer la formation sur Whop</a>
          <p class="doux petit" style="margin:6px 0 0">S'ouvre dans l'application Whop si elle est installée, sinon dans le navigateur.</p>` : ''}
      </div>
    </div>
  </div>${STYLE_HEATMAP}`, espace, 'parcours', null, SCRIPT_HEATMAP);
}

// ---------- Membre : étape 1 ----------
function pageEtape1(config, { espace, parcours: p, tache, soumissions, remarquesDe, formation, maxMo }) {
  const fini = p.etape > 1;
  const bloc = (niveau) => {
    const s = soumissions.find((x) => x.emplacement === niveau);
    const etat = s ? s.etat : 'vide';
    const rem = s ? remarquesDe(s.id)[0] : null;
    const corps = ['vide', 'brouillon'].includes(etat) && !fini ? formVideo(niveau, { etape1: true, libelle: `Choisir la vidéo ${niveau}` })
      : `<div class="recap"><div><b>${s && s.note !== null ? echapper(s.note) : '—'} / 100</b><span>note de l'IA</span></div>
          <div><b>${s && s.envoye_le ? echapper(formatDate(s.envoye_le)) : '—'}</b><span>envoyé</span></div></div>
        ${rem ? remarque(rem) : ''}
        ${etat === 'attente' && !fini ? `<details><summary>Envoyer une autre version</summary><div style="margin-top:12px">${formVideo(niveau, { etape1: true })}</div></details>` : ''}`;
    return `<div class="carte envoi"><div class="envoi-tete"><h2>Exercice ${niveau}</h2>${etatPuce(etat)}</div>${corps}</div>`;
  };
  return page('Étape 1 · Prise en main', `
  ${enTete(1, 'Prise en main', fini ? null : tache && tache.delai)}
  ${fini ? '<div class="carte"><p class="message-ok" style="margin:0">Étape validée. Tu peux revoir tes exercices et les remarques de ton coach.</p></div>' : ''}
  ${blocVideo(config.offres.elite.wistiaEtape1 || '', 'Étape 1 : ce que tu dois faire')}
  <div class="carte">
    <h2>Ce que tu dois faire (3 jours)</h2>
    <ol class="frise">
      <li data-etat="${formation && formation.faites ? 'fait' : 'encours'}"><span class="point"></span><div class="titre">Regarde la première partie des modules</div>
        <div class="desc">${formation ? `${formation.faites} leçon(s) terminée(s) sur Whop, mis à jour tout seul.` : 'Ta progression Whop apparaîtra ici.'}</div></li>
      <li data-etat="${fini ? 'fait' : 'encours'}"><span class="point"></span><div class="titre">Fais les exercices L1 et L2</div>
        <div class="desc">Fais noter chaque vidéo par l'IA avec le prompt du module, et garde sa note et son retour.</div></li>
      <li data-etat="${fini ? 'fait' : 'attente'}"><span class="point"></span><div class="titre">Envoie tes deux exercices ici</div><div class="desc">Ton coach les regarde et valide ton étape.</div></li>
    </ol>
  </div>
  <div class="grille-cartes">${bloc('L1')}${bloc('L2')}</div>`, espace, 'parcours', maxMo);
}

// ---------- Membre : étape 2 ----------
// Créneaux rangés par jour ; sur chaque bouton, l'heure du membre (« nuit » si elle tombe après minuit chez lui).
function choixCreneaux(libres) {
  if (!libres.length) return '<p class="doux" style="margin:0">Aucun créneau libre dans les prochains jours. Ton coach va t\'en proposer un.</p>';
  const jours = [];
  for (const c of libres) {
    if (!jours.length || jours[jours.length - 1].date !== c.date) jours.push({ date: c.date, creneaux: [] });
    jours[jours.length - 1].creneaux.push(c);
  }
  let premier = true;
  return `<form method="post" action="/parcours/etape-2/reserver" style="display:grid;gap:14px">
    ${jours.map((j) => `<div><p class="etiquette" style="margin:0 0 8px" data-local="${echapper(j.date)}T12:00:00.000Z" data-jour>${echapper(j.date)}</p>
      <div class="creneaux">${j.creneaux.map((c) => {
    const coche = premier; premier = false;
    return `<label><input type="radio" name="creneau" value="${echapper(c.date)}|${echapper(c.heure)}"${coche ? ' checked' : ''}>
        <b data-local="${echapper(c.debut.toISOString())}" data-heure data-ref="${echapper(j.date)}T12:00:00.000Z">${echapper(c.heure)} GMT</b></label>`;
  }).join('')}</div></div>`).join('')}
    <button class="bouton" type="submit" style="margin-top:0">Réserver ce coaching</button></form>`;
}
function pageEtape2(config, { espace, parcours: p, tache, entree, libres, message }) {
  const fini = p.etape > 2;
  const debut = entree ? new Date(`${entree.date}T${entree.heure}:00.000Z`) : null;
  const contenu = fini ? '<div class="carte"><p class="message-ok" style="margin:0">Étape validée : ton coaching d\'entrée est fait.</p></div>'
    : entree ? `
    <div class="carte">
      <div class="envoi-tete"><h2>Ton coaching d'entrée</h2>${etatPuce('valide')}</div>
      <p style="margin:0"><b data-local="${echapper(debut.toISOString())}">${echapper(entree.date)} à ${echapper(entree.heure)} GMT</b></p>
      <p class="doux petit" style="margin:4px 0 0">À ton heure (<span data-fuseau>GMT</span>). 30 minutes avec ton coach.</p>
      ${debut > new Date() ? `<details style="margin-top:12px"><summary>Reporter (jusqu'à 30 minutes avant)</summary><div style="margin-top:12px">${choixCreneaux(libres)}</div></details>` : ''}
    </div>
    <div class="carte"><h2>Prépare ton coaching</h2><ul class="liste">
      <li>${ICONE.ok}<span>Tes deux exercices de l'étape 1, et les remarques de ton coach.</span></li>
      <li>${ICONE.ok}<span>Ton pays cible.</span></li>
      <li>${ICONE.ok}<span>Tes disponibilités de la semaine, pour réserver tes coachings ensemble.</span></li>
    </ul><p class="doux petit" style="margin:10px 0 0">Pendant ce coaching : ta niche, ta stratégie et tes coachings de la semaine. Ton compte TikTok, tu le crées à l'étape 4, quand tu commences à publier.</p></div>`
      : `<div class="carte">
      <h2>Choisis ton coaching d'entrée</h2>
      <p class="doux">Un seul coaching, de 30 minutes. Heures affichées à ton heure (<span data-fuseau>GMT</span>).</p>
      ${choixCreneaux(libres)}
    </div>`;
  return page('Étape 2 · Coaching d\'entrée', `
  ${enTete(2, 'Coaching d\'entrée', fini || entree ? null : tache && tache.delai)}
  ${message ? `<p class="${message.erreur ? 'erreur-form' : 'message-ok'}">${echapper(message.texte)}</p>` : ''}
  ${blocVideo(config.offres.elite.wistiaEtape2 || '', 'Étape 2 : ton coaching d\'entrée')}
  ${contenu}`, espace, 'parcours');
}

// ---------- Membre : étape 3 ----------
// Formulaires « une question par page » (étapes 3 et 4) : chaque [data-page] s'affiche à son tour.
// Un bouton [data-aller="n"] montre la page n ; [data-retour] revient à la précédente.
const STYLE_ETAPES = `<style>
  .assistant { display:grid; gap:12px; } .assistant [data-page] { display:grid; gap:12px; animation:apparaitre .25s ease; }
  .assistant [data-page][hidden] { display:none; } .assistant h3 { margin:0; font-size:19px; letter-spacing:-.01em; }
  .assistant .choix2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .assistant .choix2 .bouton { margin:0; }
  .assistant .points-pages { display:flex; gap:6px; } .assistant .points-pages i { width:22px; height:4px; border-radius:4px; background:#2a2a2a; } .assistant .points-pages i.fait { background:#c8f23a; }
  .assistant .avert { border:1px solid #6b4316; background:#1d1408; color:#ffd8a8; border-radius:12px; padding:10px 12px; font-size:14px; }
  .assistant .lien-formation { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:14px; border:1px solid #2a2a2a; color:#fff; text-decoration:none; font-weight:700; }
  .assistant .retour-page { background:none; border:0; color:var(--doux); font:600 13px var(--police); cursor:pointer; justify-self:start; padding:0; }
  @keyframes apparaitre { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
</style>`;
const SCRIPT_ETAPES = `(function () {
  document.querySelectorAll('.assistant').forEach(function (a) {
    var pages = a.querySelectorAll('[data-page]'), pile = [];
    function montrer(n) {
      pages.forEach(function (p) { p.hidden = p.getAttribute('data-page') !== String(n); });
      var points = a.querySelectorAll('.points-pages i'), k = +n;
      points.forEach(function (x, i) { x.className = i < k ? 'fait' : ''; });
      var champ = a.querySelector('[data-page="' + n + '"] input:not([type=hidden]), [data-page="' + n + '"] textarea'); if (champ) champ.focus();
    }
    a.addEventListener('click', function (e) {
      var b = e.target.closest('[data-aller], [data-retour]'); if (!b) return;
      e.preventDefault();
      if (b.hasAttribute('data-retour')) { montrer(pile.pop() || 1); return; }
      var courante = a.querySelector('[data-page]:not([hidden])');
      // Avant d'avancer : les champs obligatoires de la page.
      var manque = courante && [].filter.call(courante.querySelectorAll('[required]'), function (c) { return !c.value.trim(); })[0];
      if (manque && !b.hasAttribute('data-sans-verif')) { manque.focus(); manque.reportValidity && manque.reportValidity(); return; }
      if (courante) pile.push(courante.getAttribute('data-page'));
      // Un choix qui remplit un champ caché (ex. data-valeur="categorie=vues").
      var v = b.getAttribute('data-valeur');
      if (v) { var i = v.indexOf('='), c = a.querySelector('[name="' + v.slice(0, i) + '"]'); if (c) c.value = v.slice(i + 1); }
      montrer(b.getAttribute('data-aller'));
    });
    montrer(a.getAttribute('data-depart') || 1);
  });
})();`;
const lienFormation = (url, texte) => (url ? `<a class="lien-formation" href="${echapper(url)}" target="_blank" rel="noopener">▶ <span>${echapper(texte)}</span><span style="margin-left:auto;color:var(--doux)">↗</span></a>` : '');

// Étape 3 : « Ma niche » (une question par page). Envoyée : à valider par le coach ; validée : verrouillée.
function blocStrategie({ strategie: st = {}, formation = {}, message }) {
  if (st.valide) {
    return `<div class="carte" id="strategie"><div class="envoi-tete"><h2>Ma niche</h2><span class="etat" data-etat="valide">${ICONE.ok}Validée</span></div>
      <p style="margin:8px 0 0;font-size:18px;font-weight:800">${echapper((st.niche || {}).titre || '—')}</p>
      <p class="doux petit" style="margin:6px 0 0">Validée par ton coach : c'est avec cette niche qu'il t'accompagne. Elle ne se change plus.</p></div>`;
  }
  if (st.envoye) {
    return `<div class="carte" id="strategie"><div class="envoi-tete"><h2>Ma niche</h2><span class="etat" data-etat="attente">Envoyée · à valider</span></div>
      <p style="margin:8px 0 0;font-size:18px;font-weight:800">${echapper((st.niche || {}).titre || '—')}</p>
      ${message ? `<p class="message-ok" style="margin:8px 0 0">${echapper(message)}</p>` : ''}
      <p class="doux" style="margin:8px 0 0">En attendant, commence tes vidéos tests : ce sont elles qui permettront à ton coach de valider ta niche.</p>
      <p class="avert" style="margin:10px 0 0;border:1px solid #6b4316;background:#1d1408;color:#ffd8a8;border-radius:12px;padding:10px 12px;font-size:14px"><b>Attention :</b> ta niche peut être refusée par ton coach. Ne crée <b>qu'une seule vidéo</b> en attendant sa réponse, pour ne pas avoir à tout refaire.</p></div>`;
  }
  return `${STYLE_ETAPES}<form class="carte assistant" id="strategie" method="post" action="/parcours/etape-3/strategie" data-depart="1">
    <div class="envoi-tete"><h2>Ma niche</h2><div class="points-pages"><i></i><i></i><i></i></div></div>
    ${st.refus ? `<p class="erreur-form" style="margin:0">Ton coach a refusé ta niche : ${echapper(st.refus)}</p>` : ''}
    ${message ? `<p class="erreur-form" style="margin:0">${echapper(message)}</p>` : ''}
    <div data-page="1"><h3>As-tu déjà choisi ta niche ?</h3>
      <div class="choix2"><button class="bouton secondaire" type="button" data-aller="n">Non, pas encore</button><button class="bouton" type="button" data-aller="2">Oui</button></div></div>
    <div data-page="n" hidden><h3>Choisis ta niche selon ton niveau</h3>
      <p class="doux" style="margin:0">Regarde cette leçon de la formation : elle t'explique comment choisir une niche adaptée à ton profil. Reviens ici quand c'est fait.</p>
      ${lienFormation(formation.niche, 'Comment choisir une niche en fonction de ton niveau')}
      <button class="bouton" type="button" data-aller="2" style="margin:0">C'est fait, j'ai choisi ma niche</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="2" hidden><h3>Quel est le nom de ta niche ?</h3>
      <input name="niche" maxlength="100" required placeholder="ex. Faits historiques, Tricot, Lego ASMR…">
      <button class="bouton" type="button" data-aller="3" style="margin:0">Suivant</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="3" hidden><h3>Envoie une capture d'un compte exemple</h3>
      <p class="doux" style="margin:0">Un concurrent ou un compte exemple de cette niche : ton coach la valide avec.</p>
      ${zoneCapture('capture', 'Ajouter la capture', 'Capture du profil d\'un compte de cette niche')}
      <p class="avert"><b>Attention :</b> ta niche peut être refusée par ton coach. En attendant sa réponse, ne crée <b>qu'une seule vidéo</b> test, pour ne pas avoir à tout refaire.</p>
      <button class="bouton" type="submit" style="margin:0">Envoyer à mon coach</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
  </form>`;
}
function pageEtape3(config, { espace, parcours: p, tache, soumissions, remarquesDe, coachings, maxMo, strategie = null }) {
  const fini = p.etape > 3;
  const valides = soumissions.filter((s) => s.etat === 'valide').length;
  const bloc = (n) => {
    const emplacement = `V${n}`;
    const s = soumissions.find((x) => x.emplacement === emplacement);
    const etat = s ? s.etat : 'vide';
    const rem = s ? remarquesDe(s.id)[0] : null;
    let corps;
    if (['vide', 'brouillon'].includes(etat)) corps = fini ? '' : formVideo(emplacement, { libelle: `Choisir la vidéo ${n}`, ajouts: true });
    else if (etat === 'corriger') {
      corps = `${rem ? remarque(rem) : ''}${s.corriger_avant ? `<div>${delai({ fin: s.corriger_avant, duree: 24 * 3600000 })}</div>` : ''}
        ${formVideo(emplacement, { libelle: 'Choisir la nouvelle version', ajouts: true })}<p class="doux petit" style="margin:0">Elle remplace l'ancienne.</p>`;
    } else {
      corps = `<p class="doux petit" style="margin:0">Envoyée le ${echapper(formatDate(s.envoye_le))}</p>${rem ? remarque(rem) : ''}
        ${etat === 'attente' && !fini ? `<details><summary>Envoyer une autre version</summary><div style="margin-top:12px">${formVideo(emplacement, { ajouts: true })}</div></details>` : ''}`;
    }
    return `<div class="carte envoi"><div class="envoi-tete"><h2>Vidéo ${n}</h2>${etatPuce(etat)}</div>${corps}</div>`;
  };
  return page('Étape 3 · Validation du contenu', `
  ${enTete(3, 'Validation du contenu', fini ? null : tache && tache.delai)}
  ${blocVideo(config.offres.elite.wistiaEtape3 || '', 'Étape 3 : tes 3 vidéos')}
  ${strategie ? blocStrategie(strategie) : ''}
  <div class="carte">
    <div class="envoi-tete"><h2>Tes 3 vidéos, avant de publier</h2><span class="etat" data-etat="${valides === 3 ? 'valide' : 'attente'}">${valides} / 3 validées</span></div>
    <p class="doux" style="margin:8px 0 0">${fini ? 'Tes 3 vidéos sont validées : tu es autorisé à publier.' : 'Ne publie rien pour l\'instant. Quand tes 3 vidéos auront la coche verte, tu seras autorisé à publier.'}</p>
  </div>
  <div class="grille-cartes">${bloc(1)}${bloc(2)}${bloc(3)}</div>
  <div class="carte">
    <div class="envoi-tete"><h2>Mes coachings de la semaine</h2>${coachings.reserves >= coachings.min ? `<span class="etat" data-etat="valide">${ICONE.ok}Réservés</span>` : '<span class="etat" data-etat="corriger">À réserver</span>'}</div>
    <p class="doux" style="margin:8px 0 0">${coachings.reserves} réservé(s) · minimum ${coachings.min}, maximum ${coachings.max} par semaine.</p>
    <a class="bouton secondaire" href="/coaching">Mes coachings</a>
  </div>`, espace, 'parcours', maxMo, SCRIPT_ETAPES);
}

// Niche, méthode 10K et pays visé, choisis dans les listes (ressources publiées, 8 pays).
// Un profil L1 ne voit pas les niches L2 (commentaire) ; un profil L2 les voit toutes.
function choixNichePays(choix, p) {
  return `<div class="champ"><label for="niche">Niche</label><input id="niche" name="niche" maxlength="100" value="${echapper(p.niche || '')}" placeholder="ex. Faits historiques"></div>
    <div class="champ"><label for="methode">Méthode 10K</label><input id="methode" name="methode" maxlength="100" value="${echapper(p.methode_texte || '')}" placeholder="ex. Versus"></div>
    <div class="champ"><label for="pays">Pays visé</label><input id="pays" name="pays" maxlength="60" value="${echapper(p.pays_cible || '')}" placeholder="ex. France"></div>`;
}

// ---------- La fiche (membre ou coach) ----------
// Réalisations : chaque vidéo envoyée, visible par l'élève et le coach, avec son état, sa remarque, son script et l'avis du coach.
function blocRealisations(liste, { vueCoach }) {
  if (!liste.length) return '';
  const ETATS = { attente: 'En attente', valide: 'Validée', corriger: 'À corriger', force: 'Passée' };
  const nom = (x) => (x.etape === 4 ? `Vidéo à relire · ${formatDate(x.envoye_le)}` : `Vidéo ${x.emplacement.slice(1)} · étape 3`);
  return `<div class="carte" id="realisations"><div class="envoi-tete"><h2>Réalisations</h2><span class="doux petit">${liste.length} vidéo(s)</span></div>
    <div style="display:grid;gap:14px;margin-top:12px">${liste.map((x) => `<div class="realisation">
      <div class="envoi-tete"><b>${echapper(nom(x))}</b><span class="etat" data-etat="${x.etat === 'valide' ? 'valide' : x.etat === 'corriger' ? 'corriger' : 'attente'}">${echapper(x.etape === 4 && x.etat === 'valide' ? 'Prête à publier' : x.etape === 4 && x.etat === 'corriger' ? 'À retravailler' : ETATS[x.etat] || x.etat)}</span></div>
      ${x.fichier ? `<video controls preload="metadata" playsinline src="${vueCoach ? '/admin' : '/parcours'}/envois/${x.id}/video" style="width:100%;max-height:60vh;border-radius:14px;background:#000;margin-top:8px"></video>`
    : '<p class="doux petit" style="margin:6px 0 0">Vidéo effacée du serveur (place libérée).</p>'}
      ${x.remarque_eleve ? `<p style="margin:8px 0 0"><span class="doux petit">Remarque de l'élève :</span><br>${echapper(x.remarque_eleve)}</p>` : ''}
      ${x.script ? `<details style="margin-top:6px"><summary>Script de la vidéo</summary><p style="white-space:pre-line;margin:6px 0 0">${echapper(x.script)}</p></details>` : ''}
      ${x.remarque ? `<div style="margin-top:8px">${remarque(x.remarque)}</div>` : ''}
      ${vueCoach ? `<a class="bouton${x.etat === 'attente' ? '' : ' secondaire'}" href="/admin/envois/${x.id}" style="margin-top:10px">${x.etat === 'attente' ? 'Donner ma décision' : 'Ouvrir'}</a>`
    : x.etat !== 'valide' ? `<a class="bouton secondaire" href="/parcours/etape-${x.etape === 4 ? '4#avis' : '3'}" style="margin-top:10px">${x.etat === 'corriger' ? 'Envoyer une nouvelle version' : 'Voir'}</a>` : ''}
    </div>`).join('<hr style="border:0;border-top:1px solid var(--bord);margin:0">')}</div></div>`;
}
// Positionnement (niche, méthode 10K, pays) et compte TikTok : un état en couleur (rouge : pas envoyé ; jaune : envoyé,
// à valider ; vert : acté). Le formulaire ne s'ouvre qu'avec « Modifier » (coach). Validé : verrouillé pour l'élève.
const pastilleEtat = (envoye, valide) => (valide ? '<span class="etat" data-etat="valide">Acté</span>'
  : envoye ? '<span class="etat" data-etat="attente">Envoyé · à valider</span>' : '<span class="etat" data-etat="corriger">Pas encore envoyé</span>');
function blocPositionnement({ p, vueCoach, base, choix, strategie: st }) {
  st = st || {};
  const nomMethode = st.methode || null;
  const pos = `<div class="carte" id="positionnement"><div class="envoi-tete"><h2>Positionnement</h2>${pastilleEtat(st.envoye, st.valide)}</div>
    <dl class="details" style="margin-top:8px">
      <div><dt>Niche</dt><dd>${st.niche ? echapper(st.niche.titre) : '—'}</dd></div>
      <div><dt>Méthode 10K</dt><dd>${nomMethode ? echapper(nomMethode) : '—'}</dd></div>
      <div><dt>Pays visé</dt><dd>${echapper(st.pays || '—')}</dd></div></dl>
    ${st.capture ? `<a href="/fichiers/images/${echapper(st.capture)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(st.capture)}" alt="Compte exemple de la niche" style="max-width:100%;max-height:260px;border-radius:12px;margin-top:10px"></a>` : ''}
    ${st.refus ? `<p class="doux petit" style="margin:8px 0 0">Dernier refus : ${echapper(st.refus)}</p>` : ''}
    ${vueCoach ? `${st.envoye && !st.valide ? `<form method="post" action="${base}/positionnement/valider" style="margin:10px 0 0"><button class="bouton vert" type="submit" style="margin:0">Valider la niche</button></form>
      <details style="margin-top:8px"><summary class="doux petit" style="cursor:pointer">Refuser la niche</summary>
        <form method="post" action="${base}/niche/refuser" style="display:grid;gap:8px;margin-top:8px"><textarea name="motif" required placeholder="Pourquoi ? Il en proposera une autre."></textarea>
          <button class="bouton secondaire" type="submit" style="margin:0">Refuser</button></form></details>` : ''}
      <details style="margin-top:10px"><summary class="doux petit" style="cursor:pointer">Modifier</summary>
        <form method="post" action="${base}/compte" style="display:grid;gap:10px;margin-top:10px">${choixNichePays(choix, p)}
          <button class="bouton secondaire" type="submit" style="margin:0">Enregistrer (validé d'office)</button></form></details>`
    : st.valide ? '<p class="doux petit" style="margin:8px 0 0">Validé par ton coach : c\'est avec lui qu\'il t\'accompagne.</p>' : ''}
    ${vueCoach && p.etape === 2 ? `<form method="post" action="${base}/compte" style="margin:10px 0 0"><button class="bouton" type="submit" name="ouvrir" value="3" style="margin:0">Ouvrir l'étape 3</button></form>` : ''}</div>`;
  if (p.etape < 4) return pos;
  const valide = Boolean(p.compte_valide_le);
  const compte = `<div class="carte" id="compte"><div class="envoi-tete"><h2>Compte TikTok</h2>${pastilleEtat(Boolean(p.compte_tiktok), valide)}</div>
    <p style="margin:8px 0 0">${p.compte_tiktok ? lienTikTok(p.compte_tiktok) : '<span class="doux">pas encore envoyé</span>'}</p>
    ${p.compte_methode || p.compte_abonnes_depart !== null && p.compte_abonnes_depart !== undefined ? `<p class="doux petit" style="margin:6px 0 0">${{ oui: 'Créé avec la méthode de la formation', verifie: 'Méthode vérifiée par l\'élève', nouveau: 'Nouveau compte, créé avec la méthode' }[p.compte_methode] || ''}${p.compte_abonnes_depart !== null && p.compte_abonnes_depart !== undefined ? ` · ${Number(p.compte_abonnes_depart).toLocaleString('fr-FR')} abonnés au départ` : ''}</p>` : ''}
    ${p.compte_demande_le ? `<div class="manquants" style="margin:10px 0 0;border:1px solid #5a4a1a;background:#1d1708;color:#f1d38a;border-radius:12px;padding:10px 12px"><b>Demande de changement de compte</b><p style="margin:4px 0 0">${echapper(p.compte_demande)}</p></div>` : ''}
    ${p.compte_change_autorise ? '<p class="doux petit" style="margin:8px 0 0">Changement autorisé : en attente du nouveau lien.</p>' : ''}
    ${vueCoach ? `${p.compte_tiktok && !valide ? `<form method="post" action="${base}/compte/valider" style="margin:10px 0 0"><button class="bouton vert" type="submit" style="margin:0">Valider le compte</button></form>` : ''}
      ${p.compte_demande_le ? `<form method="post" action="${base}/compte/changement" class="deux-boutons" style="margin-top:10px"><button class="bouton secondaire" type="submit" name="decision" value="refuser">Garder ce compte</button><button class="bouton" type="submit" name="decision" value="autoriser">Autoriser le changement</button></form>` : ''}
      <details style="margin-top:10px"><summary class="doux petit" style="cursor:pointer">Modifier</summary>
        <form method="post" action="${base}/compte" style="display:grid;gap:10px;margin-top:10px"><div class="champ"><label for="compte-lien">Lien du compte TikTok</label><input id="compte-lien" name="compte" value="${echapper(p.compte_tiktok || '')}" placeholder="https://www.tiktok.com/@compte"></div>
          <button class="bouton secondaire" type="submit" style="margin:0">Enregistrer</button></form></details>` : ''}</div>`;
  const img = (n) => (n ? `<a href="/fichiers/images/${echapper(n)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(n)}" alt="" style="max-width:100%;max-height:220px;border-radius:12px;margin-top:8px"></a>` : '');
  const ETATS_M = { a_faire: ['corriger', 'À faire (10K atteints)'], envoyee_acceptee: ['attente', 'Acceptée · à vérifier'], envoyee_refusee: ['attente', 'Refusée · à vérifier'], acceptee: ['valide', 'Monétisé'], refusee: ['corriger', 'Refusée · contestation'] };
  const m = p.monetisation_etat ? ETATS_M[p.monetisation_etat] : null;
  const preuve = (type, titre) => (p[`${type}_etat`] ? `<div style="margin-top:12px"><div class="envoi-tete"><b>${titre}</b><span class="etat" data-etat="${p[`${type}_etat`] === 'validee' ? 'valide' : 'attente'}">${p[`${type}_etat`] === 'validee' ? 'Validée' : 'À valider'}</span></div>
    ${img(p[`${type}_capture`])}${vueCoach && p[`${type}_etat`] === 'envoyee' ? `<form method="post" action="${base}/preuve/${type}/valider" style="margin:8px 0 0"><button class="bouton vert" type="submit" style="margin:0">Valider</button></form>` : ''}</div>` : '');
  const monet = p.etape >= 4 && (m || p.abonnes_actuels !== null && p.abonnes_actuels !== undefined || p.audience_etat || p.rpm_etat) ? `<div class="carte" id="monetisation"><div class="envoi-tete"><h2>Croissance et monétisation</h2>${m ? `<span class="etat" data-etat="${m[0]}">${m[1]}</span>` : ''}</div>
    ${p.abonnes_actuels !== null && p.abonnes_actuels !== undefined ? `<p style="margin:8px 0 0"><b>${Number(p.abonnes_actuels).toLocaleString('fr-FR')}</b> abonnés</p>` : ''}
    ${p.monetisation_capture ? img(p.monetisation_capture) : ''}
    ${vueCoach && String(p.monetisation_etat || '').startsWith('envoyee_') ? `<form method="post" action="${base}/monetisation" class="deux-boutons" style="margin-top:10px">
      <button class="bouton secondaire" type="submit" name="decision" value="refusee">Refusée : je l'aide à contester</button><button class="bouton vert" type="submit" name="decision" value="acceptee">Acceptée : débloquer les revenus</button></form>` : ''}
    ${preuve('audience', 'Preuve d\'audience')}${preuve('rpm', 'Preuve de RPM')}</div>` : '';
  return pos + compte + monet;
}
function pageFiche(config, { espace, vueCoach, parcours: p, remarques, toutes, message, stats, recompenses = [], sinistre, historique = [], joursAbsence = 0, choix = null, realisations = [], strategie = null }) {
  // Ce qui attend une décision du coach (sinistre, rôle à confirmer) passe en haut de la colonne.
  const aConfirmer = recompenses.some((r) => !r.confirme_le);
  const base = vueCoach ? `/admin/membres/${encodeURIComponent(p.discord_id)}` : '/fiche';
  const dates = [['Prise en main', p.etape1_le], ['Coaching d\'entrée', p.etape2_le], ['Validation du contenu', p.etape3_le]]
    .map(([t, le], i) => [t, le ? formatDate(le) : p.etape === i + 1 ? 'en cours' : '—']);
  return page(vueCoach ? `Fiche de ${p.pseudo || p.discord_id}` : 'Ma fiche', `
  ${vueCoach ? '<a class="retour" href="/admin/membres"><span aria-hidden="true">‹</span> Tous les membres</a>' : ''}
  <div class="titre-page"><div><p class="etiquette">${vueCoach ? 'Fiche Elite' : 'Overmaxx Elite'}</p><h1>${echapper(vueCoach ? p.nom || p.pseudo || p.discord_id : 'Ma fiche')}</h1></div></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}
  ${frise(p.etape)}
  <div class="colonnes-2">
    <div>
      ${vueCoach ? `<details class="pl-ecrire" id="remarque"><summary class="bouton" style="list-style:none;text-align:center;margin:0 0 14px">✉️ Envoyer un message</summary>
        <form class="carte" method="post" action="${base}/remarque" style="display:grid;gap:10px">
        <input name="titre" maxlength="120" required placeholder="Titre (en gras)" aria-label="Titre">
        ${barreMiseEnForme('texte-fiche')}<textarea id="texte-fiche" name="texte" required placeholder="Ton message. Sélectionne un mot puis G, I ou S pour le mettre en forme."></textarea>
        ${zoneImages()}
        <button class="bouton" type="submit" style="margin-top:0">Envoyer à ${echapper(p.pseudo || 'cet élève')}</button>
        <p class="doux petit" style="margin:0">Il le voit dans ses Remarques du coach, et Bob le prévient. Accusés de lecture dans Planifier → Envoyer un message.</p></form></details>
        <script>if (location.hash === '#remarque') document.getElementById('remarque').open = true;</script>` : ''}
      ${blocRealisations(realisations, { vueCoach })}
      <div class="carte" id="remarques">
        <div class="envoi-tete"><h2>Remarques du coach</h2><span class="doux petit">${remarques.length} au total</span></div>
        ${listeRemarques(remarques, { toutes })}
      </div>
      ${p.etape >= 4 && stats ? (vueCoach ? `${blocObjectifs(stats, { lien: `${base}/profil`, texteLien: 'Voir son tableau de bord' })}${blocStats(stats)}`
        : blocObjectifs(stats, { lien: '/revenus' })) : '<div class="carte"><h2>Statistiques</h2><p class="doux" style="margin:0">Elles s\'afficheront à partir de l\'étape 4, avec les comptes rendus.</p></div>'}
    </div>
    <div>
      ${sinistre ? blocSinistres({ vueCoach, base, p, sinistre, historique, joursAbsence }) : ''}
      ${vueCoach && aConfirmer ? blocRecompenses(base, recompenses) : ''}
      <div class="carte"><h2>Identité</h2><dl class="details">
        <div><dt>Discord</dt><dd>${echapper(p.pseudo || p.discord_id)}</dd></div>
        <div><dt>Entrée</dt><dd>${echapper(formatDate(p.entree_le))}</dd></div>
        <div><dt>Fin des 90 jours</dt><dd>${echapper(formatDate(p.fin_le))}</dd></div>
        <div><dt>Profil type</dt><dd>${echapper(p.niveau || '—')}</dd></div>
      </dl></div>
      ${blocPositionnement({ p, vueCoach, base, choix, strategie })}
      <div class="carte"><h2>Parcours</h2><dl class="details">${dates.map(([t, le]) => `<div><dt>${echapper(t)}</dt><dd>${echapper(le)}</dd></div>`).join('')}</dl>
        ${p.etapes_forcees ? `<p class="doux petit" style="margin:10px 0 0">Passée(s) par ${vueCoach ? 'toi' : 'ton coach'} : étape(s) ${echapper(JSON.parse(p.etapes_forcees).join(', '))}.</p>` : ''}
        ${vueCoach && p.etape < 5 ? `<a class="bouton secondaire" href="/admin/eleves?eleve=${encodeURIComponent(p.discord_id)}">Changer d'étape</a>` : ''}</div>
      ${vueCoach && !aConfirmer ? blocRecompenses(base, recompenses) : ''}
      ${sinistre ? '' : blocSinistres({ vueCoach, base, p, sinistre, historique, joursAbsence })}
    </div>
  </div>`, espace, vueCoach ? 'membres' : 'fiche');
}

const { nomRole, nomCourt, pastilleRole, STYLE_ROLES, ROLES } = require('./roles');
const NOMS_ROLES = { goat: nomCourt('goat'), 1500: nomCourt('1500'), 5000: nomCourt('5000'), 10000: nomCourt('10000') };
function blocRecompenses(base, recompenses) {
  if (!recompenses.length) return '';
  return `${STYLE_ROLES}<div class="carte"><h2>Rôles</h2>${recompenses.map((r) => `<div class="ligne-envoi"><div class="qui"><b>${pastilleRole(r.role) || echapper(r.role)}</b>
    <span>${r.confirme_le ? `donné le ${echapper(formatDate(r.confirme_le))}` : `seuil atteint le ${echapper(formatDate(r.atteint_le))}`}</span></div>
    ${r.confirme_le ? `<span class="etat" data-etat="valide">${ICONE.ok}Donné</span>` : `<form method="post" action="${base}/recompense"><input type="hidden" name="role" value="${echapper(r.role)}"><button class="bouton vert" type="submit" style="width:auto;min-height:38px;margin:0;padding:8px 16px">Confirmer</button></form>`}</div>`).join('')}</div>`;
}
function blocSinistres({ vueCoach, base, p, sinistre, historique, joursAbsence }) {
  const n = p.sinistres || 0;
  const s = sinistre;
  const fiche = s && s.fiche_le ? `<div class="remarque"><span class="qui">Fiche de sinistre · ${echapper(formatDate(s.fiche_le))}</span>
      <p><b>Pourquoi :</b> ${texteRiche(s.fiche_pourquoi)}</p><p><b>Ses engagements :</b> ${texteRiche(s.fiche_engagements)}</p></div>` : '';
  const actions = !vueCoach ? '' : s
    ? `${s.etat === 'fiche' ? `<form method="post" action="${base}/sinistre" style="display:grid;gap:10px;margin-top:12px">
        <textarea name="texte" placeholder="Ce qu'il doit préciser (obligatoire pour demander des précisions)."></textarea>
        <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="action" value="precisions">Demander des précisions</button>
        <button class="bouton vert" type="submit" name="action" value="rehabiliter">Réhabiliter</button></div></form>`
      : `<p class="doux petit" style="margin:10px 0 0">${s.etat === 'precisions' ? 'Tu lui as demandé des précisions : il doit compléter sa fiche.' : 'Il n\'a pas encore rempli sa fiche de sinistre.'}</p>
        <form method="post" action="${base}/sinistre"><button class="bouton secondaire" type="submit" name="action" value="rehabiliter">Réhabiliter quand même</button></form>`}`
    : `<form method="post" action="${base}/sinistre"><button class="bouton secondaire" type="submit" name="action" value="declarer">Déclarer un sinistre</button></form>`;
  const force = vueCoach && (n || historique.length) ? `<form method="post" action="${base}/sinistre" style="margin-top:8px">
      <button class="bouton secondaire" type="submit" name="action" value="retirer" style="border-color:var(--erreur);color:var(--erreur)">Force majeure : retirer les sinistres</button>
      <p class="doux petit" style="margin:6px 0 0">Compteur remis à 0, lives individuels rendus, ${joursAbsence} jour(s) d'absence rendus sur ses 90 jours.</p></form>` : '';
  if (!vueCoach && !n && !s) return '';
  return `<div class="carte"><div class="envoi-tete"><h2>Sinistres</h2>${s ? '<span class="etat" data-etat="corriger">Sinistré</span>' : ''}</div>
    <p style="margin:8px 0 0"><span class="compteur-sinistres">${n} / 3</span>${p.sinistre_total ? ' <span class="etat" data-etat="corriger">Sinistré total : plus de lives individuels</span>' : ''}</p>
    <p class="doux petit" style="margin:4px 0 10px">${joursAbsence} jour(s) d'absence au total.</p>
    ${fiche}${actions}${force}</div>`;
}

// ---------- Coach : À traiter ----------
// Une section par catégorie, dans l'ordre où le coach les traite : les membres de l'étape 1 à l'étape 4,
// puis les demandes d'intégration (vidéos des candidats retenus, puis nouvelles candidatures), puis les retards.
const STYLE_TRAITER = `<style>
  .puces-traiter { display:flex; gap:8px; overflow-x:auto; padding:2px 0 14px; margin-bottom:6px; border-bottom:1px solid var(--bord); scrollbar-width:none; }
  .puces-traiter a { flex:none; display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border:1px solid var(--bord-fort); border-radius:999px; color:#fff; text-decoration:none; font-size:13px; font-weight:600; }
  .puces-traiter a[data-vide] { color:var(--gris); border-color:var(--bord); }
  .puces-traiter b { display:inline-grid; place-items:center; min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:#ff8a00; color:#000; font-size:11px; }
  .puces-traiter a[data-vide] b { background:var(--surface-2); color:var(--gris); }
  .section-traiter { padding-top:26px; scroll-margin-top:16px; }
  .section-traiter > .tete { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:4px; }
  .section-traiter h2 { font-size:18px; margin:0; letter-spacing:-0.02em; }
  .section-traiter > p { color:var(--doux); font-size:13px; margin:0 0 14px; }
  .section-traiter h3.sous { font-size:13px; color:var(--doux); text-transform:uppercase; letter-spacing:.12em; margin:18px 0 10px; }
  .cartes-traiter { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap:14px; }
  .carte-traiter { display:flex; flex-direction:column; gap:6px; padding:16px; border-radius:18px; background:var(--surface); border:1px solid var(--bord); min-width:0; }
  .carte-traiter .qui { font-size:16px; font-weight:700; overflow-wrap:anywhere; }
  .carte-traiter .pseudo { color:var(--doux); font-size:13px; }
  .carte-traiter .quoi { font-size:14px; margin-top:4px; }
  .carte-traiter .quand { color:var(--doux); font-size:12.5px; }
  .carte-traiter .bouton { margin-top:auto; min-height:42px; }
  .carte-traiter .espace-bouton { flex:1; min-height:8px; }
  .vide-traiter { color:var(--gris); font-size:13px; margin:0; padding:14px 16px; border:1px dashed var(--bord); border-radius:14px; }
  .puces-traiter a[aria-pressed="true"] { background:#fff; color:#000; border-color:#fff; } .puces-traiter a[aria-pressed="true"] b { background:#000; color:#fff; }
  .tr-file { display:grid; gap:8px; max-width:820px; }
  @media (min-width: 1200px) { .tr-file { max-width:none; grid-template-columns:repeat(2, minmax(0, 1fr)); align-items:start; } .tr-file .tr-sep { grid-column:1 / -1; } }
  .tr-carte { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:16px; background:var(--surface); border:1px solid var(--bord); }
  .tr-carte[hidden] { display:none; }
  .tr-corps { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; } .tr-corps b { font-size:15px; overflow-wrap:anywhere; } .tr-corps p { margin:2px 0 0; font-size:14px; }
  .tr-bas { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:6px; }
  .tr-tag { font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; border:1px solid var(--bord-fort); color:#ddd; }
  .tr-carte.a-traiter { background:rgba(255,138,0,.13); border-color:rgba(255,138,0,.55); }
  .tr-carte.fait { background:#000; border-color:#1d1d1d; opacity:.85; }
  .tr-sep { font-size:14px; color:var(--doux); margin:18px 0 6px; text-transform:uppercase; letter-spacing:.06em; }
  .tr-tag[data-cat="etape-1"] { color:#9ec5ff; border-color:#284a7a; } .tr-tag[data-cat="etape-2"] { color:#c8f23a; border-color:#4a5a15; }
  .tr-tag[data-cat="etape-3"] { color:#ffb26b; border-color:#6b4316; } .tr-tag[data-cat="etape-4"] { color:#7ee0b0; border-color:#1f5a3d; } .tr-tag[data-cat="videos"] { color:#ff9ad5; border-color:#6b1f4a; }
  .tr-tag[data-cat="roles"] { color:#f5c518; border-color:#6b5414; } .tr-tag[data-cat="sinistres"] { color:#ff8f8f; border-color:#7a1d1d; } .tr-tag[data-cat="messages"] { color:#c8f23a; border-color:#4a5a15; } .tr-tag[data-cat="notifications"] { color:#bbb; border-color:#3a3a3a; } .tr-tag[data-cat="ressources"] { color:#9ec5ff; border-color:#284a7a; } .tr-tag[data-cat="avis"] { color:#ffb26b; border-color:#6b4316; } .tr-tag[data-cat="positionnement"] { color:#c8f23a; border-color:#4a5a15; } .tr-tag[data-cat="coachings"] { color:#9ec5ff; border-color:#284a7a; }
  .tr-tag[data-cat="candidatures"] { color:#d4b3ff; border-color:#4b2b7a; } .tr-tag[data-cat="acces"] { color:#fff; } .tr-tag[data-cat="retards"] { color:#ffcf6b; border-color:#6b4a0e; }
  .tr-ouvrir { flex:none; width:auto !important; margin:0 !important; min-height:40px; padding:8px 16px; }
  .tr-carte .choix-acces { flex:none; } .tr-carte .choix-acces .bouton { min-height:40px; padding:8px 14px; }
  @media (max-width: 520px) { .tr-carte { flex-direction:column; align-items:stretch; } .tr-ouvrir { width:100% !important; } }
  .choix-acces { display:flex; gap:8px; margin:0; }
  .choix-acces .bouton { flex:1; margin:0; min-height:42px; padding-left:10px; padding-right:10px; }
</style>`;

// À traiter : une seule file, toutes les catégories mélangées (le plus ancien d'abord), avec une étiquette sous chaque carte.
// Les filtres en haut, rangés par nombre (ceux qui restent le plus d'abord) : un clic n'affiche que cette catégorie.
function pageATraiter(config, { espace, a, candidatures = [], comptesRendus = [], resultats = [], fichesSinistre = [], roles = [], acces = [], accesRefuses = [], nomsOffres = {}, messagesRecus = [], notifications = [], ressources = [], dejaTraites = [], aValider = { positionnements: [], comptes: [], demandes: [] }, coachingsAValider = [] }) {
  const nom = (p) => (p && (p.nom || p.pseudo)) || '?';
  const items = [];
  const ajouter = (cat, x) => items.push({ cat, ...x });
  for (const s of a.envois) {
    ajouter(s.etape === 1 ? 'etape-1' : s.etape === 4 ? 'avis' : 'etape-3', { qui: nom(s.parcours), ficheId: s.parcours && s.parcours.discord_id, pseudo: s.parcours && s.parcours.pseudo, quand: s.envoye_le,
      quoi: s.etape === 1 ? `Exercice ${s.emplacement} · note de l'IA ${s.note} / 100` : s.etape === 4 ? `Vidéo à relire avant publication${s.script ? ' · script joint' : ''}${s.remarque_eleve ? ` · « ${s.remarque_eleve.slice(0, 80)} »` : ''}`
        : `Vidéo ${s.emplacement.slice(1)} à valider${s.script ? ' · script joint' : ''}`, lien: `/admin/envois/${s.id}` });
  }
  for (const x of a.etape2) {
    ajouter('etape-2', { qui: nom(x.parcours), ficheId: x.parcours && x.parcours.discord_id, pseudo: x.parcours.pseudo, quand: `${x.entree.date}T${x.entree.heure}:00.000Z`,
      quoi: `Coaching d'entrée fait (${x.entree.date} à ${x.entree.heure} GMT) : ouvre son étape 3`, lien: `/admin/membres/${encodeURIComponent(x.parcours.discord_id)}` });
  }
  for (const cr of comptesRendus) ajouter('etape-4', { qui: nom(cr.parcours), ficheId: cr.parcours && cr.parcours.discord_id, pseudo: cr.parcours && cr.parcours.pseudo, quand: cr.envoye_le, quoi: `Update du compte du ${jourLisible(cr.jour)}`, lien: `/admin/comptes-rendus/${cr.id}` });
  for (const v of resultats) {
    ajouter('videos', { qui: nom(v.parcours), ficheId: v.parcours && v.parcours.discord_id, pseudo: v.parcours && v.parcours.pseudo, quand: v.res_envoye_le, lien: `/admin/resultats/${v.id}`,
      quoi: `Résultats de la vidéo du ${jourLisible(v.jour)} : ${Number(v.res_vues || 0).toLocaleString('fr-FR')} vues · $${Number(v.res_revenus || 0).toFixed(2)}${v.ok_vues !== null && v.ok_vues !== undefined ? ' (mise à jour)' : ''}` });
  }
  for (const r of roles) ajouter('roles', { qui: nom(r.parcours), ficheId: r.parcours && r.parcours.discord_id, pseudo: r.parcours && r.parcours.pseudo, quand: r.atteint_le, quoi: `Rôle ${nomRole(r.role)} à confirmer (${(ROLES[r.role] || {}).seuil || ''})`, lien: `/admin/membres/${encodeURIComponent(r.discord_id)}` });
  for (const x of fichesSinistre) ajouter('sinistres', { qui: nom(x.parcours), ficheId: x.parcours && x.parcours.discord_id, pseudo: x.parcours && x.parcours.pseudo, quand: x.fiche_le, quoi: `Fiche de sinistre (${x.numero} / 3)`, lien: `/admin/membres/${encodeURIComponent(x.discord_id)}` });
  for (const c of candidatures) {
    ajouter('candidatures', { qui: c.nom, pseudo: c.pseudo, quand: c.maj_le, quoi: c.statut === 'video' ? 'Vidéo de présentation reçue' : 'Formulaire de candidature à examiner', lien: `/admin/candidatures/${c.id}`, bouton: 'Inspecter' });
  }
  const fiche = (p, ancre) => `/admin/membres/${encodeURIComponent(p.discord_id)}#${ancre}`;
  for (const p of aValider.positionnements) ajouter('positionnement', { qui: nom(p), ficheId: p.discord_id, pseudo: p.pseudo, quand: p.positionnement_le, quoi: `Positionnement à valider : ${p.niche || '—'} · ${p.pays_cible || '—'}`, lien: fiche(p, 'positionnement'), bouton: 'Voir' });
  for (const p of aValider.comptes) ajouter('positionnement', { qui: nom(p), ficheId: p.discord_id, pseudo: p.pseudo, quand: p.compte_envoye_le, quoi: `Compte TikTok à valider : ${p.compte_tiktok}`, lien: fiche(p, 'compte'), bouton: 'Voir' });
  for (const p of aValider.monetisations || []) ajouter('positionnement', { qui: nom(p), ficheId: p.discord_id, pseudo: p.pseudo, quand: p.monetisation_le, quoi: `Preuve de monétisation : candidature ${p.monetisation_etat === 'envoyee_acceptee' ? 'acceptée' : 'refusée'}`, lien: fiche(p, 'monetisation'), bouton: 'Vérifier' });
  for (const x of aValider.preuves || []) ajouter('positionnement', { qui: nom(x.p), ficheId: x.p.discord_id, pseudo: x.p.pseudo, quand: x.p[`${x.type}_le`], quoi: x.type === 'rpm' ? 'Preuve de RPM à vérifier' : 'Preuve d\'audience à vérifier', lien: fiche(x.p, 'monetisation'), bouton: 'Vérifier' });
  for (const p of aValider.demandes) ajouter('positionnement', { qui: nom(p), ficheId: p.discord_id, pseudo: p.pseudo, quand: p.compte_demande_le, quoi: `Demande de changement de compte : ${p.compte_demande}`, lien: fiche(p, 'compte'), bouton: 'Décider' });
  const RAISONS = { fait_avance: 'fait en avance', non_necessaire: 'annulé car non nécessaire', live_groupe: 'remplacé par un live de groupe', autre: 'autre raison' };
  for (const v of coachingsAValider) {
    const quand = `${v.date.split('-').reverse().join('/')} à ${v.heure} GMT`;
    const form = (boutons) => `<form method="post" action="/admin/validations/${v.id}" class="choix-acces">${boutons.map(([d, t, c]) => `<button class="bouton ${c}" type="submit" name="decision" value="${d}">${t}</button>`).join('')}</form>`;
    if (v.statut === 'attente') ajouter('coachings', { qui: v.nom, ficheId: v.discord_id, quand: `${v.date}T${v.heure}:00.000Z`, quoi: `Coaching du ${quand} : a-t-il bien eu lieu ?${v.eleve_ok_le ? ' (l\'élève l\'a validé)' : ''}`, actions: form([['valider', 'Valider ce coaching', 'vert']]) });
    else if (v.statut === 'conteste') ajouter('coachings', { qui: v.nom, ficheId: v.discord_id, quand: v.decide_le || v.cree_le, quoi: `Conteste le coaching du ${quand} : « ${v.reponse} »`, actions: form([['classer', 'Classer', 'secondaire'], ['reserve', 'Donner un coaching en réserve', 'vert']]) });
    else ajouter('coachings', { qui: v.nom, ficheId: v.discord_id, quand: v.decide_le || v.cree_le, quoi: `Refuse la validation en avance (${RAISONS[v.raison] || ''}) du coaching du ${quand} : « ${v.reponse} »`, actions: form([['classer', 'Garder la séance', 'secondaire']]) });
  }
  for (const r of ressources) {
    ajouter('ressources', { qui: r.nom || 'Un élève', ficheId: r.auteur, quand: r.cree_le, lien: `/ressources/${r.id}`, bouton: 'Relire',
      quoi: `Propose ${{ niche: 'la niche', methode: 'la méthode', tutoriel: 'le tutoriel' }[r.type]} « ${r.titre} »`,
      quoiHtml: `Propose ${{ niche: 'la niche', methode: 'la méthode', tutoriel: 'le tutoriel' }[r.type]} <b>${echapper(r.titre)}</b>` });
  }
  for (const m of messagesRecus) {
    ajouter('messages', { qui: m.nom, ficheId: m.discord_id, pseudo: m.parcours && m.parcours.pseudo, quand: m.cree_le, lien: `/admin/messages-recus/${m.id}`, bouton: m.lu_le ? 'Répondre' : 'Lire',
      quoi: `${m.sujet ? `${m.sujet} : ` : ''}${m.texte.length > 140 ? `${m.texte.slice(0, 140)}…` : m.texte}` });
  }
  const decision = (x, libelles) => `<form method="post" action="/admin/acces/${encodeURIComponent(x.programme)}/${encodeURIComponent(x.discord_id)}" class="choix-acces">
      ${libelles.map(([valeur, texte, classe]) => `<button class="bouton ${classe}" type="submit" name="decision" value="${valeur}">${echapper(texte)}</button>`).join('')}</form>`;
  for (const x of acces) {
    ajouter('acces', { qui: x.pseudo || x.discord_id, pseudo: `Rôle ${nomsOffres[x.programme] || x.programme}${x.donne_par ? ` · donné par ${x.donne_par}` : ''}`, quand: x.demande_le,
      quoi: x.ancien ? 'A déjà accès au site (avant la validation) : il le garde en attendant ta réponse.' : 'Rôle donné à la main, sans paiement sur le site : lui ouvrir le site ?',
      actions: decision(x, [['non', x.ancien ? 'Retirer' : 'Non', 'secondaire'], ['oui', x.ancien ? 'Garder' : 'Oui', 'vert']]) });
  }
  // Pour information : en retard (Bob les relance déjà), après le reste.
  const retards = a.retards.map((x) => ({ cat: 'retards', qui: nom(x.parcours), ficheId: x.parcours && x.parcours.discord_id, pseudo: x.parcours.pseudo, quand: x.tache.delai && x.tache.delai.fin,
    quoi: `Étape ${x.parcours.etape} : ${x.tache.titre}`, lien: `/admin/membres/${encodeURIComponent(x.parcours.discord_id)}`, bouton: 'Voir sa fiche' }));
  // Notifications non lues (pour information) : la plus récente d'abord ; l'ouvrir la marque lue.
  const notifs = notifications.map((n) => ({ cat: 'notifications', qui: 'Notification', quand: n.cree_le,
    quoi: n.texte, quoiHtml: gras(echapper(n.texte.length > 160 ? `${n.texte.slice(0, 160)}…` : n.texte)), lien: `/admin/notifications/${n.id}/ouvrir`, bouton: n.lien ? 'Ouvrir' : 'Marquer comme lue' }));
  items.sort((x, y) => String(x.quand || '').localeCompare(String(y.quand || '')));
  // À traiter (fond orange) d'abord ; puis, pour mémoire, ce qui est déjà traité ou lu (fond noir, comme une notification lue).
  for (const x of [...items, ...notifs]) x.aTraiter = true;
  const faits = dejaTraites.map((n) => ({ ...n, fait: true }));
  const tous = [...items, ...notifs, ...retards, ...faits];
  const CATS = [['etape-1', 'Étape 1'], ['etape-2', 'Étape 2'], ['etape-3', 'Étape 3'], ['avis', 'Vidéos à relire'], ['videos', 'Résultats vidéo'], ['etape-4', 'Updates du compte'], ['roles', 'Rôles'], ['sinistres', 'Sinistrés'],
    ['candidatures', 'Candidatures'], ['acces', 'Accès au site'], ['messages', 'Messages'], ['coachings', 'Coachings à valider'], ['positionnement', 'Niche, compte et preuves'], ['ressources', 'Ressources'], ['retards', 'En retard'], ['notifications', 'Notifications']];
  const nb = (c) => tous.filter((x) => x.cat === c).length;
  const filtres = CATS.map(([c, l], i) => ({ c, l, n: nb(c), i })).sort((x, y) => (y.n > 0) - (x.n > 0) || y.n - x.n || x.i - y.i);
  const libelle = Object.fromEntries(CATS);
  const carte = (x) => `<div class="tr-carte${x.aTraiter ? ' a-traiter' : ''}${x.fait ? ' fait' : ''}" data-cat="${x.cat}">
    <div class="tr-corps">${x.ficheId ? `<a href="/admin/membres/${encodeURIComponent(x.ficheId)}" style="color:#fff"><b>${echapper(x.qui)}</b></a>` : `<b>${echapper(x.qui)}</b>`}${x.pseudo ? `<span class="doux petit">${echapper(x.pseudo)}</span>` : ''}<p>${x.quoiHtml || echapper(x.quoi)}</p>
      <span class="tr-bas"><span class="tr-tag" data-cat="${x.cat}">${echapper(libelle[x.cat])}</span>${x.quand ? `<span class="doux petit">${echapper(formatDate(x.quand))}</span>` : ''}</span></div>
    ${x.actions || (x.lien ? `<a class="bouton${x.bouton || x.fait ? ' secondaire' : ''} tr-ouvrir" href="${echapper(x.lien)}">${echapper(x.bouton || 'Ouvrir')}</a>` : '')}</div>`;
  return page('À traiter', `${STYLE_TRAITER}
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>À traiter</h1></div><span class="doux petit">${items.length} en attente de ta décision</span></div>
  <nav class="puces-traiter" aria-label="Filtres"><a href="#" data-filtre="" aria-pressed="true">Tout<b>${items.length}</b></a>${filtres.map((x) => `<a href="#" data-filtre="${x.c}"${x.n ? '' : ' data-vide'}>${echapper(x.l)}<b>${x.n}</b></a>`).join('')}</nav>
  ${items.length + notifs.length ? '' : '<p class="vide-traiter">Rien à traiter. Bravo !</p>'}
  <div class="tr-file">${tous.map((x, i) => `${x.fait && !(tous[i - 1] || {}).fait ? '<h2 class="tr-sep" data-cat="__">Déjà traité</h2>' : ''}${carte(x)}`).join('')}</div>
  ${accesRefuses.length ? `<details class="carte" style="margin-top:18px"><summary>Accès au site refusés (${accesRefuses.length})</summary><div style="display:grid;gap:8px;margin-top:10px">
    ${accesRefuses.map((x) => `<div class="tr-carte"><div class="tr-corps"><b>${echapper(x.pseudo || x.discord_id)}</b><span class="doux petit">Rôle ${echapper(nomsOffres[x.programme] || x.programme)} · refusé le ${echapper(formatDate(x.decide_le))}</span></div>
      ${decision(x, [['oui', 'Donner l\'accès', 'secondaire']])}</div>`).join('')}</div></details>` : ''}
  <script>(function () {
    var puces = document.querySelectorAll('[data-filtre]'), cartes = document.querySelectorAll('.tr-file .tr-carte');
    puces.forEach(function (p) { p.addEventListener('click', function (e) {
      e.preventDefault(); var f = p.getAttribute('data-filtre');
      puces.forEach(function (x) { x.setAttribute('aria-pressed', x === p ? 'true' : 'false'); });
      cartes.forEach(function (c) { c.hidden = Boolean(f) && c.getAttribute('data-cat') !== f; });
      document.querySelectorAll('.tr-sep').forEach(function (h) { h.hidden = Boolean(f); });
    }); });
    var demande = new URLSearchParams(location.search).get('filtre');
    if (demande) { var p = document.querySelector('[data-filtre="' + demande.replace(/[^a-z0-9-]/g, '') + '"]'); if (p) p.click(); }
  })();</script>`, espace, 'traiter');
}

// ---------- Coach : valider un envoi ----------
function pageEnvoi(config, { espace, s, parcours: p, remarques, niveauPropose, message }) {
  const etape1 = s.etape === 1;
  const avis = s.etape === 4;
  const titre = etape1 ? `Exercice ${s.emplacement}` : avis ? 'Vidéo à relire avant publication' : `Vidéo ${s.emplacement.slice(1)}`;
  const decision = s.etat !== 'attente'
    ? `<div class="carte"><h2>Déjà traité</h2><p class="doux" style="margin:0">${s.etat === 'valide' ? 'Validé' : 'Modifications demandées'} le ${echapper(formatDate(s.decide_le))}.</p></div>`
    : `<form class="carte" method="post" action="/admin/envois/${s.id}/decision" style="display:grid;gap:12px">
        <h2 style="margin:0">Ta décision</h2>
        ${etape1 ? `<div class="champ"><label for="niveau">Profil type</label><select id="niveau" name="niveau">
            <option value="L2"${niveauPropose === 'L2' ? ' selected' : ''}>L2</option><option value="L1"${niveauPropose === 'L1' ? ' selected' : ''}>L1</option></select>
          <small>Proposé : ${echapper(niveauPropose)} (L2 si ses deux notes sont à 80 ou plus).</small></div>` : ''}
        <div class="champ"><label for="texte">${etape1 ? 'Tes remarques (facultatif)' : 'Ton retour complet'}</label>
          <textarea id="texte" name="texte" placeholder="${etape1 ? 'Ce qu\'il peut améliorer.' : 'Ce qui va, ce qui ne va pas, et quoi changer.'}"></textarea></div>
        ${zoneImages()}
        ${etape1 ? '<button class="bouton vert" type="submit" name="decision" value="valider" style="margin-top:0">Valider</button><p class="doux petit" style="margin:0">À l\'étape 1, les exercices ne se refont pas : tu ajoutes tes remarques et tu valides.</p>'
    : avis ? '<div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">À retravailler</button><button class="bouton vert" type="submit" name="decision" value="valider">Prête à publier</button></div><p class="doux petit" style="margin:0">Un avis, sans délai : il publie quand il veut. Bob le prévient.</p>'
    : '<div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">Demander des modifications</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div><p class="doux petit" style="margin:0">Modifications : il a 24 h pour renvoyer, Bob le prévient. Validé : plus rien ne se modifie.</p>'}
      </form>`;
  return page(`${titre} de ${p.pseudo || ''}`, `
  <a class="retour" href="/admin/a-traiter"><span aria-hidden="true">‹</span> À traiter</a>
  <div class="titre-page"><div><p class="etiquette"><a href="/admin/membres/${encodeURIComponent(p.discord_id)}" style="color:inherit">${echapper(p.nom || p.pseudo || '')}</a> · étape ${s.etape}</p><h1>${echapper(titre)}</h1></div>${etatPuce(s.etat)}</div>
  ${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}
  <div class="colonnes-2">
    <div>
      ${s.fichier ? `<video controls preload="metadata" playsinline src="/admin/envois/${s.id}/video" style="width:100%;max-height:70vh;border-radius:14px;background:#000"></video>`
    : '<div class="carte"><p class="doux" style="margin:0">La vidéo a été supprimée du serveur (étape validée).</p></div>'}
      ${etape1 ? `<div class="carte"><div class="envoi-tete"><h2>Note de l'IA</h2><span class="note-ia">${echapper(s.note)}<small> / 100</small></span></div>
        <details style="margin-top:10px"><summary>Retour de l'IA (copié par ${echapper(p.pseudo || 'le membre')})</summary><p class="doux" style="white-space:pre-line">${echapper(s.retour_ia || '')}</p></details></div>` : ''}
      ${s.remarque_eleve ? `<div class="carte"><h2>Sa remarque</h2><p style="margin:0;white-space:pre-line">${echapper(s.remarque_eleve)}</p></div>` : ''}
      ${s.script ? `<div class="carte"><h2>Script de la vidéo</h2><p style="margin:0;white-space:pre-line;line-height:1.55">${echapper(s.script)}</p></div>` : ''}
      ${remarques.length ? `<div class="carte"><h2>Tes remarques sur cet envoi</h2><div style="display:grid;gap:10px">${remarques.map(remarque).join('')}</div></div>` : ''}
    </div>
    <div>
      ${decision}
      <div class="carte"><h2><a href="/admin/membres/${encodeURIComponent(p.discord_id)}" style="color:inherit">${echapper(p.pseudo || p.discord_id)}</a></h2><p class="doux petit" style="margin:0">Étape ${p.etape}${p.niche ? ` · ${echapper(p.niche)}` : ''}${p.compte_tiktok ? ` · ${lienTikTok(p.compte_tiktok)}` : ''}</p>
        <a class="bouton secondaire" href="/admin/membres/${encodeURIComponent(p.discord_id)}">Voir sa fiche</a></div>
    </div>
  </div>`, espace, 'traiter');
}

// ---------- Membre : étape 4 (publication et suivi) ----------
const SCRIPT_FUSEAU = `
(function () {
  var f = ''; try { f = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { f = ''; }
  document.querySelectorAll('input[name=fuseau]').forEach(function (i) { if (!i.value) i.value = f; });
})();`;
function formHeures(p, { titre = 'Choisis tes 3 heures', routine = '' } = {}) {
  const h = (nom, val, label, conseil) => `<div class="champ"><label for="${nom}">${label}</label><input id="${nom}" name="${nom}" type="time" value="${echapper(val || '')}" required><small>${conseil}</small></div>`;
  return `<form method="post" action="/parcours/etape-4/heures" style="display:grid;gap:14px">
    ${titre ? `<h2 style="margin:0">${echapper(titre)}</h2>` : ''}
    <p class="doux" style="margin:0">Des heures fixes, chaque jour. Bob te les rappelle, à ton heure (<span data-fuseau>GMT</span>).</p>
    ${routine ? `<a href="${echapper(routine)}" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;border:1px solid #2a2a2a;color:#fff;text-decoration:none;font-weight:700">▶ <span>Améliorer ta routine de travail</span><span style="margin-left:auto;color:var(--doux)">↗</span></a>` : ''}
    ${h('creation', p.heure_creation, 'Création de ta vidéo', 'Le moment où tu es le plus libre et le plus en forme. Il n\'y a pas de bon moment : le meilleur est celui que tu décides d\'y consacrer.')}
    ${h('publication', p.heure_publication, 'Publication', 'Je te conseille 1 h après la création : le montage prend 1 h maximum.')}
    ${h('compte_rendu', p.heure_compte_rendu, 'Compte rendu', '24 h après la publication : tu envoies les résultats de la veille.')}
    <input type="hidden" name="fuseau" value="">
    <button class="bouton" type="submit" style="margin-top:0">Enregistrer mes heures</button></form>`;
}
// ---------- Étape 4 : publier (le lien), les résultats de chaque vidéo, l'update du compte ----------
// Étape 4 : 10 000 abonnés → rejoindre la monétisation (une question par page), puis la preuve (capture) validée par le coach.
function blocMonetisation(p, formation = {}) {
  const e = p.monetisation_etat;
  if (!e || e === 'acceptee') return '';
  if (String(e).startsWith('envoyee_')) {
    return `<div class="carte" id="monetisation"><div class="envoi-tete"><h2>Monétisation</h2><span class="etat" data-etat="attente">En cours d'examen</span></div>
      <p class="doux" style="margin:8px 0 0">Ton coach regarde ta capture (${e === 'envoyee_acceptee' ? 'candidature acceptée' : 'candidature refusée'}). Tu recevras une notification.</p></div>`;
  }
  return `${STYLE_ETAPES}<form class="carte assistant" id="monetisation" method="post" action="/parcours/etape-4/monetisation" data-depart="1">
    <div class="envoi-tete"><h2>${e === 'refusee' ? 'Monétisation : on recommence ensemble' : '🎉 10 000 abonnés !'}</h2><div class="points-pages"><i></i><i></i><i></i></div></div>
    <input type="hidden" name="vue" value="oui"><input type="hidden" name="resultat" value="">
    ${e === 'refusee' ? '<p class="doux" style="margin:0">Ton coach t\'aide à contester. Quand TikTok t\'a répondu, envoie la nouvelle capture.</p>' : ''}
    <div data-page="1"><h3>As-tu vu la procédure de la formation pour rejoindre la monétisation ?</h3>
      <div class="choix2"><button class="bouton secondaire" type="button" data-aller="v" onclick="this.form.vue.value='non'">Non</button><button class="bouton" type="button" data-aller="2">Oui</button></div></div>
    <div data-page="v" hidden><h3>Regarde la procédure avant de postuler</h3>
      ${lienFormation(formation.monetisation, 'Rejoindre la monétisation correctement')}
      <button class="bouton" type="button" data-aller="2" style="margin:0">C'est fait</button><button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="2" hidden><h3>Postule, puis envoie la réponse de TikTok</h3>
      <p class="doux" style="margin:0">Une fois ta candidature <b>acceptée</b>, envoie une capture. Si elle est <b>refusée</b>, envoie aussi une capture : on t'aide à contester.</p>
      <p class="avert"><b>N'envoie aucun message de contestation toi-même.</b> C'est très important : ne prends aucune décision sans te faire encadrer.</p>
      <button class="bouton" type="button" data-aller="3" style="margin:0">J'ai la réponse de TikTok</button><button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="3" hidden><h3>Ta candidature a été…</h3>
      <div class="choix2"><button class="bouton vert" type="button" data-aller="4" onclick="this.form.resultat.value='acceptee'">Acceptée</button><button class="bouton secondaire" type="button" data-aller="4" onclick="this.form.resultat.value='refusee'">Refusée</button></div>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="4" hidden><h3>Envoie la capture de la réponse</h3>
      ${zoneCapture('capture', 'Ajouter la capture', 'La réponse de TikTok à ta candidature')}
      <button class="bouton" type="submit" style="margin:0">Envoyer à mon coach</button><button class="retour-page" type="button" data-retour>‹ Retour</button></div>
  </form>`;
}
// Preuves demandées une fois : audience (après 5 résultats), RPM (5 résultats après la monétisation).
function blocPreuves(p, dues = {}) {
  const carte = (type, titre, intro, aide) => {
    const etat = p[`${type}_etat`];
    if (etat === 'validee' || (!etat && !dues[type])) return '';
    if (etat === 'envoyee') return `<div class="carte"><div class="envoi-tete"><h2>${titre}</h2><span class="etat" data-etat="attente">Envoyée · à valider</span></div></div>`;
    return `<form class="carte" id="preuve-${type}" method="post" action="/parcours/etape-4/preuve/${type}" style="display:grid;gap:10px">
      <div class="envoi-tete"><h2>${titre}</h2><span class="etat" data-etat="corriger">À envoyer</span></div>
      <p style="margin:0">${intro}</p>${zoneCapture('capture', 'Ajouter la capture', aide)}
      <button class="bouton" type="submit" style="margin:0">Envoyer à mon coach</button></form>`;
  };
  return carte('audience', 'Prouver mon audience', 'Bravo, 5 vidéos de suite ! Je veux m\'assurer que ton contenu touche bien l\'audience visée : envoie une capture de la <b>provenance dominante de tes vues</b>. Pas besoin d\'écrire quoi que ce soit.', 'Statistiques de ton compte › audience (pays)')
    + carte('rpm', 'Prouver mon RPM', 'Bravo pour tes résultats dans la monétisation ! Envoie une capture de <b>tes derniers résultats</b> pour vérifier que ton RPM est bon.', 'Tes derniers revenus sur TikTok');
}

// Étape 4 : faire relire une vidéo avant de la publier (facultatif, 3 en attente au plus).
// Progresser (étape 4) : 3 axes conseillés, dans l'ordre (Hook, puis Engagement, puis Watchtime). Pour chacun : la leçon
// (« J'ai regardé »), puis une vidéo à faire relire sur cet axe. Facultatif : le coach posera ces questions quand l'élève demande de l'aide.
const AXES = [
  ['hook', 'Améliorer ton hook', 'L\'accroche : ce qui donne envie de regarder.', 'Hook'],
  ['engagement', 'Améliorer l\'engagement', 'Faire réagir : commenter, partager, interagir.', 'Engagement'],
  ['watchtime', 'Améliorer le watchtime', 'Le rythme : garder les gens le plus longtemps possible.', 'Watchtime'],
];
function blocAvis(avis = [], remarquesDe = () => [], { formation = {}, tutosVus = [] } = {}) {
  const envoyees = avis.filter((s) => s.etat !== 'brouillon');
  const enAttente = envoyees.filter((s) => s.etat === 'attente').length;
  const ETATS = { attente: ['attente', 'En attente du coach'], valide: ['valide', 'Prête à publier'], corriger: ['corriger', 'À retravailler'] };
  const ligne = (sv) => {
    const rem = remarquesDe(sv.id)[0];
    const [e, l] = ETATS[sv.etat] || ['attente', sv.etat];
    return `<div class="ligne-envoi" style="display:block;margin-top:8px"><div class="envoi-tete"><b>Envoyée le ${echapper(formatDate(sv.envoye_le))}</b><span class="etat" data-etat="${e}">${l}</span></div>${rem ? remarque(rem) : ''}</div>`;
  };
  const axes = AXES.map(([cle, titre, texte, court], i) => {
    const vu = tutosVus.includes(cle);
    const sienne = envoyees.filter((sv) => sv.axe === cle);
    return `<div class="carte" style="margin:0"><div class="envoi-tete"><h3 style="margin:0">${i + 1}. ${titre}</h3>${vu ? `<span class="etat" data-etat="valide">${ICONE.ok}Vu</span>` : ''}</div>
      <p class="doux petit" style="margin:4px 0 8px">${texte}</p>
      ${formation[cle] ? `<a href="${echapper(formation[cle])}" target="_blank" rel="noopener" data-tuto="${cle}" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid #2a2a2a;color:#fff;text-decoration:none;font-weight:700">▶ <span>Regarder la leçon</span><span style="margin-left:auto;color:var(--doux)">↗</span></a>` : ''}
      ${vu ? '' : `<form method="post" action="/parcours/etape-4/tuto" style="margin:8px 0 0"><input type="hidden" name="axe" value="${cle}"><button class="bouton secondaire" type="submit" style="margin:0">J'ai regardé cette leçon</button></form>`}
      ${enAttente < 3 ? `<details style="margin-top:8px"><summary class="doux petit" style="cursor:pointer">Envoyer une vidéo « ${court} » à relire</summary><div style="margin-top:10px">${formVideo('avis', { libelle: 'Choisir la vidéo', ajouts: true, axe: cle })}</div></details>` : ''}
      ${sienne.slice(0, 2).map(ligne).join('')}</div>`;
  }).join('');
  const libres = envoyees.filter((sv) => !sv.axe);
  return `<div class="carte" id="avis">
    <div class="envoi-tete"><h2>Progresser</h2><span class="doux petit">${enAttente} / 3 vidéos en attente</span></div>
    <p class="doux" style="margin:8px 0 12px">Regarde ces 3 leçons <b>avant</b> de faire tes prochaines vidéos, dans l'ordre. Puis fais une vidéo sur chaque point et envoie-la à ton coach : il te posera ces questions quand tu lui demanderas de l'aide.</p>
    <div style="display:grid;gap:10px">${axes}</div>
    <a class="bouton secondaire" href="/aide" style="margin:12px 0 0">Bloqué ? Demander de l'aide</a>
    <details style="margin-top:12px"><summary class="doux petit" style="cursor:pointer">Faire relire une autre vidéo avant de la publier</summary><div style="margin-top:10px">${enAttente < 3 ? formVideo('avis', { libelle: 'Choisir la vidéo', ajouts: true }) : '<p class="doux petit" style="margin:0">3 vidéos attendent déjà l\'avis de ton coach.</p>'}</div></details>
    ${libres.slice(0, 3).map(ligne).join('')}
  </div>`;
}
function pageEtape4(config, { espace, parcours: p, tache, aujourdhui, publications, videos = [], aFaire = [], updateDuJour, stats, message, avis = [], remarquesDe, maxMo, formation = null, preuves = {} }) {
  const etatVideo = (v) => (v.res_etat ? etatPuce(v.res_etat) : v.pret ? '<span class="etat" data-etat="corriger">Résultats à donner</span>' : '<span class="etat" data-etat="attente">Résultats dans 24 h</span>');
  // Le compte TikTok d'abord : un formulaire, une question par page (déjà un compte ? créé avec la méthode ? abonnés ? lien).
  const f = formation || {};
  const formCompte = `${STYLE_ETAPES}<form class="carte assistant" id="compte" method="post" action="/parcours/etape-4/compte" data-depart="1">
    <div class="envoi-tete"><h2>Mon compte TikTok</h2><div class="points-pages"><i></i><i></i><i></i></div></div>
    <input type="hidden" name="a_compte" value=""><input type="hidden" name="methode" value="">
    <div data-page="1"><h3>As-tu déjà un compte TikTok ?</h3>
      <div class="choix2"><button class="bouton secondaire" type="button" data-aller="n1" onclick="this.form.a_compte.value='non';this.form.methode.value='nouveau'">Non</button>
        <button class="bouton" type="button" data-aller="o1" onclick="this.form.a_compte.value='oui'">Oui</button></div></div>
    <div data-page="n1" hidden><h3>Crée ton compte correctement</h3>
      <p class="doux" style="margin:0">Suis exactement la méthode de la formation : un compte bien créé, c'est un bon RPM plus tard.</p>
      ${lienFormation(f.compte, 'Créer ton compte TikTok correctement')}
      <button class="bouton" type="button" data-aller="lien" style="margin:0">C'est fait, mon compte est créé</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="o1" hidden><h3>L'as-tu créé avec la méthode de la formation ?</h3>
      <div class="choix2"><button class="bouton secondaire" type="button" data-aller="o-non">Non, ou je ne l'ai pas vue</button>
        <button class="bouton" type="button" data-aller="o2" onclick="this.form.methode.value='oui'">Oui</button></div>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="o-non" hidden><h3>Vérifie ta méthode</h3>
      <p class="doux" style="margin:0">Regarde la leçon et vérifie que tu as fait exactement pareil.</p>
      ${lienFormation(f.compte, 'Créer ton compte TikTok correctement')}
      <p class="avert"><b>Créé avec un VPN ou un proxy ?</b> Reprends la procédure depuis le début, sinon tu auras des problèmes de RPM.</p>
      <button class="bouton" type="button" data-aller="o2" style="margin:0" onclick="this.form.methode.value='verifie'">Mon compte respecte bien la méthode</button>
      <button class="bouton secondaire" type="button" data-aller="lien" style="margin:0" onclick="this.form.methode.value='nouveau';this.form.abonnes.value='0'">J'ai recréé un compte avec la méthode</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="o2" hidden><h3>Combien d'abonnés a-t-il actuellement ?</h3>
      <input name="abonnes" type="number" min="0" inputmode="numeric" placeholder="ex. 1250">
      <button class="bouton" type="button" data-aller="lien" style="margin:0">Suivant</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="lien" hidden><h3>Partage le lien de ton compte</h3>
      ${f.partagerCompte ? blocVideo(f.partagerCompte, 'Comment partager le lien de ton compte') : '<p class="doux" style="margin:0">Sur TikTok : ton profil › ☰ ou Partager le profil › <b>Copier le lien</b>.</p>'}
      <input name="compte" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" required placeholder="https://www.tiktok.com/@ton.compte">
      <button class="bouton" type="submit" style="margin:0">Envoyer à mon coach</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
  </form>`;
  const etatCompte = p.compte_tiktok && !p.compte_valide_le ? `<div class="carte"><div class="envoi-tete"><h2>Mon compte TikTok</h2><span class="etat" data-etat="attente">En cours d'examen</span></div>
    <p style="margin:8px 0 0">${lienTikTok(p.compte_tiktok)}</p><p class="doux petit" style="margin:6px 0 0">Ta soumission est en cours d'examen. Tu recevras une notification quand ton coach l'aura approuvée.</p></div>` : '';
  const corps = !p.compte_tiktok ? formCompte : !p.heure_creation ? `${etatCompte}<div class="carte">${formHeures(p, { routine: f.routine })}</div>` : `${etatCompte}
  <div class="carte">
    <div class="envoi-tete"><h2>Aujourd'hui</h2>${publications.length ? `<span class="etat" data-etat="valide">${ICONE.ok}${publications.length} vidéo(s) déclarée(s)</span>` : '<span class="etat" data-etat="attente">À déclarer</span>'}</div>
    <p class="doux" style="margin:8px 0 12px">Au moins une vidéo par jour. Après avoir publié, colle son lien : c'est tout.</p>
    <form method="post" action="/parcours/etape-4/publication" style="display:grid;gap:12px">
      <div class="champ"><label for="liens">${publications.length ? 'Une autre vidéo publiée aujourd\'hui ?' : 'Lien de ta vidéo TikTok'}</label>
        <textarea id="liens" name="liens" placeholder="https://www.tiktok.com/@ton.compte/video/…" style="min-height:70px"></textarea><small>Un lien par ligne si tu en as publié plusieurs.</small></div>
      <button class="bouton" type="submit" style="margin-top:0">Déclarer</button>
    </form>
  </div>
  <div class="carte">
    <div class="envoi-tete"><h2>Update du compte</h2>${updateDuJour ? etatPuce(updateDuJour.etat) : aFaire.length ? '<span class="etat" data-etat="corriger">À faire</span>' : `<span class="doux petit">à ${echapper(p.heure_compte_rendu)}</span>`}</div>
    <p class="doux" style="margin:8px 0 0">Chaque jour à ton heure de résultats : la capture de tes résultats des <b>28 derniers jours</b>, tes vues et tes revenus sur 28 jours.</p>
    ${aFaire.map((x) => `<div class="ligne-envoi"><div class="qui"><b>${x.cr && x.cr.etat === 'corriger' ? `Corriger l'update du ${echapper(jourLisible(x.jour))}` : 'Update du jour'}</b></div>
      <a class="bouton" href="/parcours/compte-rendu/${echapper(x.jour)}">Faire</a></div>`).join('')}
    ${!aFaire.length && aujourdhui && !updateDuJour ? `<a class="bouton secondaire" href="/parcours/compte-rendu/${echapper(aujourdhui)}">Faire l'update maintenant</a>` : ''}
  </div>
  <div class="carte">
    <div class="envoi-tete"><h2>Mes vidéos</h2><span class="doux petit">résultats 24 h après, mise à jour possible ensuite</span></div>
    ${videos.length ? videos.map((v) => `<div class="ligne-envoi"><div class="qui"><b>${echapper(jourLisible(v.jour))}</b>
      <span><a href="${echapper(v.lien)}" target="_blank" rel="noopener">Voir la vidéo</a>${v.res_vues !== null && v.res_vues !== undefined ? ` · ${Number(v.res_vues).toLocaleString('fr-FR')} vues · ${dollars(v.res_revenus || 0)}` : ''}</span>${etatVideo(v)}</div>
      ${v.pret ? `<a class="bouton${!v.res_etat || v.res_etat === 'corriger' ? '' : ' secondaire'}" href="/parcours/videos/${v.id}">${!v.res_etat ? 'Résultats' : v.res_etat === 'corriger' ? 'Corriger' : 'Mettre à jour'}</a>` : ''}</div>`).join('')
    : '<p class="doux" style="margin:8px 0 0">Pas encore de vidéo déclarée.</p>'}
  </div>
  <div class="carte"><div class="envoi-tete"><h2>Mes heures</h2><span class="doux petit">à ton heure</span></div>
    <div class="recap" style="grid-template-columns:repeat(3,1fr)"><div><b>${echapper(p.heure_creation)}</b><span>création</span></div><div><b>${echapper(p.heure_publication)}</b><span>publication</span></div><div><b>${echapper(p.heure_compte_rendu)}</b><span>résultats</span></div></div>
    <details style="margin-top:12px"><summary>Modifier mes heures</summary><div style="margin-top:12px">${formHeures(p, { titre: '', routine: (formation || {}).routine })}</div></details></div>
  ${blocObjectifs(stats, { lien: '/revenus' })}`;
  return page('Étape 4 · Publication et suivi', `
  <div class="titre-page"><div><p class="etiquette">Étape 4 sur 4${aujourdhui ? ` · ${echapper(jourLisible(aujourdhui))}` : ''}</p><h1>Publication et suivi</h1></div>${delai(tache && tache.delai)}</div>
  ${frise(Math.min(p.etape, 5))}
  ${message ? `<p class="${message.erreur ? 'erreur-form' : 'message-ok'}">${echapper(message.texte)}</p>` : ''}
  ${blocMonetisation(p, formation || {})}${blocPreuves(p, preuves)}
  ${corps}
  ${blocAvis(avis, remarquesDe, { formation: formation || {}, tutosVus: (() => { try { return JSON.parse(p.tutos_vus || '[]'); } catch { return []; } })() })}`, espace, 'parcours', maxMo, SCRIPT_FUSEAU + SCRIPT_ETAPES);
}

// ---------- Membre : l'update du compte (28 derniers jours) ----------
function pageCompteRendu(config, { espace, parcours: p, jour, cr, remarques = [], erreur }) {
  const v = (k) => (cr && cr[k] !== null && cr[k] !== undefined ? cr[k] : '');
  const monetise = p.monetisation_etat === 'acceptee';
  return page('Update du compte', `
  <a class="retour" href="/parcours/etape-4"><span aria-hidden="true">‹</span> Étape 4</a>
  <div class="titre-page"><div><p class="etiquette">Update du compte</p><h1>${echapper(jourLisible(jour))}</h1></div>${cr && cr.etat ? etatPuce(cr.etat) : ''}</div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${cr && cr.etat === 'corriger' && remarques[0] ? remarque({ ...remarques[0], type: 'corriger' }) : ''}
  <form method="post" action="/parcours/compte-rendu/${echapper(jour)}" class="carte" style="display:grid;gap:14px;margin-top:14px">
    <p class="doux" style="margin:0">Sur TikTok : tes statistiques des <b>28 derniers jours</b> (la capture montrée dans la vidéo de l'étape 4).</p>
    ${zoneCapture('capture', cr && cr.capture_revenus ? 'Remplacer la capture' : 'Capture des 28 derniers jours', monetise ? 'Vues et revenus des 28 derniers jours, bien lisibles.' : 'Tes statistiques des 28 derniers jours, bien lisibles.', cr ? cr.capture_revenus : '')}
    <div class="grille-champs">
      <div class="champ"><label for="abonnes">Abonnés actuels</label><input id="abonnes" name="abonnes" type="number" min="0" inputmode="numeric" value="${echapper(v('abonnes') || (p.abonnes_actuels ?? ''))}" required></div>
      <div class="champ"><label for="vues_28j">Vues (28 jours)</label><input id="vues_28j" name="vues_28j" type="number" min="0" inputmode="numeric" value="${echapper(v('vues_28j'))}" required></div>
      ${monetise ? `<div class="champ"><label for="revenus_28j">Revenus (28 jours, $)</label><input id="revenus_28j" name="revenus_28j" type="text" inputmode="decimal" placeholder="$0.00" value="${echapper(v('revenus_28j'))}" required></div>`
    : '<div class="champ" style="opacity:.45"><label>Revenus (28 jours, $)</label><input disabled placeholder="Après la monétisation (10K abonnés)"></div>'}
    </div>
    <p class="doux petit" style="margin:-6px 0 0">Le total depuis ton entrée dans l'accompagnement se calcule tout seul à partir de ces chiffres.</p>
    <div class="champ"><label for="question">Une question pour ton coach ? (facultatif)</label><textarea id="question" name="question" maxlength="1000">${echapper(v('question'))}</textarea></div>
    <button class="bouton" type="submit" style="margin-top:0">Envoyer l'update</button>
  </form>`, espace, 'parcours');
}

// ---------- Membre : les résultats d'une vidéo ----------
function pageResultatVideo(config, { espace, parcours: p, video: v, remarques = [], erreur }) {
  const val = (k) => (v[k] !== null && v[k] !== undefined ? v[k] : '');
  const monetise = Boolean(p && p.monetisation_etat === 'acceptee');
  const deja = (v.captures || []).length;
  return page('Résultats de la vidéo', `
  <a class="retour" href="/parcours/etape-4"><span aria-hidden="true">‹</span> Étape 4</a>
  <div class="titre-page"><div><p class="etiquette">Vidéo du ${echapper(jourLisible(v.jour))}</p><h1>Résultats de la vidéo</h1></div>${v.res_etat ? etatPuce(v.res_etat) : ''}</div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${v.res_etat === 'corriger' && remarques[0] ? remarque({ ...remarques[0], type: 'corriger' }) : ''}
  <p style="margin:0 0 12px"><a href="${echapper(v.lien)}" target="_blank" rel="noopener">Voir la vidéo sur TikTok</a></p>
  ${!v.pret ? '<div class="carte"><p style="margin:0">Les résultats se donnent 24 h après la publication. Bob te le rappellera.</p></div>' : `
  <form method="post" action="/parcours/videos/${v.id}" class="carte" style="display:grid;gap:14px">
    ${deja ? `<div><p class="doux petit" style="margin:0 0 8px">Captures déjà envoyées (${deja}) :</p><div class="captures-cr">${v.captures.map((c) => `<figure><a href="/fichiers/images/${echapper(c)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(c)}" alt="Capture des résultats"></a></figure>`).join('')}</div></div>` : ''}
    ${zoneCapture('capture', deja ? 'Ajouter une capture (la vidéo a fait plus de vues)' : 'Capture des résultats de la vidéo', 'Les statistiques de la vidéo sur TikTok.', '')}
    <div class="grille-champs">
      <div class="champ"><label for="vues">Vues de la vidéo (au total)</label><input id="vues" name="vues" type="number" min="0" inputmode="numeric" value="${echapper(val('res_vues'))}" required></div>
      <div class="champ"><label for="abonnes">Abonnés gagnés avec la vidéo</label><input id="abonnes" name="abonnes" type="number" min="0" inputmode="numeric" value="${echapper(val('res_abonnes'))}" required></div>
    </div>
    ${monetise ? `<div class="champ"><label>TikTok a-t-il mis à jour tes revenus pour cette vidéo ?</label>
      <div class="deux-boutons"><label class="bouton secondaire" style="margin:0"><input type="radio" name="maj" value="oui" checked style="width:auto;margin:0 8px 0 0">Oui</label>
        <label class="bouton secondaire" style="margin:0"><input type="radio" name="maj" value="non" style="width:auto;margin:0 8px 0 0">Pas encore</label></div></div>
    <div class="grille-champs" data-si-maj="oui">
      <div class="champ"><label for="revenus">Revenus de la vidéo ($)</label><input id="revenus" name="revenus" type="text" inputmode="decimal" placeholder="$0.00" value="${echapper(val('res_revenus'))}"></div>
      <div class="champ"><label for="rpm">RPM de la vidéo ($)</label><input id="rpm" name="rpm" type="text" inputmode="decimal" placeholder="$0.00" value="${echapper(val('res_rpm'))}"></div>
    </div>
    <div class="champ" data-si-maj="non" hidden><label for="rappel">Reviens plus tard : quand veux-tu un rappel ?</label><input id="rappel" type="datetime-local">
      <input type="hidden" name="rappel_iso" value=""><small>Tu devras quand même faire l'update de cette vidéo : Bob te le rappelle à cette heure.</small></div>
    <script>(function () { var f = document.currentScript.closest('form');
      function maj() { var non = f.querySelector('[name=maj][value=non]').checked; f.querySelectorAll('[data-si-maj]').forEach(function (e) { e.hidden = e.getAttribute('data-si-maj') !== (non ? 'non' : 'oui'); }); }
      f.querySelectorAll('[name=maj]').forEach(function (r) { r.onchange = maj; });
      var r = f.querySelector('#rappel'), d = new Date(Date.now() + 3 * 3600000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); r.value = d.toISOString().slice(0, 16);
      f.addEventListener('submit', function () { if (f.querySelector('[name=maj][value=non]').checked) f.rappel_iso.value = new Date(r.value).toISOString(); });
    })();</script>` : ''}
    <button class="bouton" type="submit" style="margin-top:0">${v.res_etat ? 'Mettre à jour les résultats' : 'Envoyer les résultats'}</button>
    <p class="doux petit" style="margin:0">La date de publication ne change pas. Ton coach valide chaque mise à jour.</p>
  </form>`}`, espace, 'parcours');
}

// ---------- Coach : valider les résultats d'une vidéo ----------
function pageResultatCoach(config, { espace, video: v, parcours: p, message }) {
  const nb = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
  const decision = v.res_etat !== 'attente'
    ? `<div class="carte"><h2>Déjà traité</h2><p class="doux" style="margin:0">${v.res_etat === 'valide' ? 'Validé' : 'Modifications demandées'} le ${echapper(formatDate(v.res_decide_le))}.</p></div>`
    : `<form class="carte" method="post" action="/admin/resultats/${v.id}/decision" style="display:grid;gap:12px">
        <h2 style="margin:0">Ta décision</h2>
        <div class="champ"><label for="texte">Ton retour</label><textarea id="texte" name="texte" placeholder="Obligatoire pour demander des modifications."></textarea></div>
        ${zoneImages()}
        <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">Demander des modifications</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div>
        <p class="doux petit" style="margin:0">Validé : ses revenus et ses vues comptent (objectifs, rôles, classement), et ceux qui le suivent sont prévenus.</p></form>`;
  return page(`Résultats de ${p ? p.pseudo || '' : ''}`, `
  <a class="retour" href="/admin/a-traiter"><span aria-hidden="true">‹</span> À traiter</a>
  <div class="titre-page"><div><p class="etiquette">${echapper(p ? p.nom || p.pseudo || '' : '')} · étape 4</p><h1>Vidéo du ${echapper(jourLisible(v.jour))}</h1></div>${etatPuce(v.res_etat)}</div>
  ${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}
  <div class="colonnes-2">
    <div>
      <div class="carte"><h2>Résultats envoyés</h2><div class="recap"><div><b>${nb(v.res_vues)}</b><span>vues</span></div><div><b>${dollars(v.res_revenus || 0)}</b><span>revenus</span></div></div>
        ${v.ok_vues !== null && v.ok_vues !== undefined ? `<p class="doux petit" style="margin:10px 0 0">Déjà validé avant : ${nb(v.ok_vues)} vues · ${dollars(v.ok_revenus || 0)}.</p>` : ''}
        <p style="margin:10px 0 0"><a href="${echapper(v.lien)}" target="_blank" rel="noopener">Voir la vidéo sur TikTok</a></p></div>
      <div class="carte"><h2>Captures (${(v.captures || []).length})</h2><div class="captures-cr">${(v.captures || []).map((c, i) => `<figure><a href="/fichiers/images/${echapper(c)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(c)}" alt="Capture ${i + 1}"></a><figcaption>Capture ${i + 1}</figcaption></figure>`).join('')}</div></div>
    </div>
    <div>${decision}
      ${p ? `<div class="carte"><h2><a href="/admin/membres/${encodeURIComponent(p.discord_id)}" style="color:inherit">${echapper(p.pseudo || p.discord_id)}</a></h2><p class="doux petit" style="margin:0">${p.compte_tiktok ? lienTikTok(p.compte_tiktok) : ''}</p>
        <a class="bouton secondaire" href="/admin/membres/${encodeURIComponent(p.discord_id)}">Voir sa fiche</a></div>` : ''}</div>
  </div>`, espace, 'traiter');
}

// ---------- Membre : la fiche de sinistre ----------
function pageSinistre(config, { espace, parcours: p, sinistre: s, joursAbsence, remarques = [], erreur }) {
  const fiche = s && s.etat === 'fiche'
    ? `<div class="carte"><div class="envoi-tete"><h2>Ta fiche est envoyée</h2>${etatPuce('attente')}</div><p class="doux" style="margin:8px 0 0">Ton coach la lit. Bob te prévient dès qu'il t'a réhabilité.</p></div>`
    : `<form class="carte" method="post" action="/sinistre" style="display:grid;gap:12px">
      <h2 style="margin:0">Ta fiche de sinistre</h2>
      ${s && s.etat === 'precisions' ? `<p class="erreur-form" style="margin:0">Ton coach te demande des précisions : complète ta fiche.</p>${remarques[0] ? remarque(remarques[0]) : ''}` : ''}
      <div class="champ"><label for="pourquoi">Pourquoi étais-tu absent ?</label><textarea id="pourquoi" name="pourquoi" required>${echapper((s && s.fiche_pourquoi) || '')}</textarea></div>
      <div class="champ"><label for="engagements">Quels sont tes engagements maintenant ?</label><textarea id="engagements" name="engagements" required>${echapper((s && s.fiche_engagements) || '')}</textarea></div>
      <button class="bouton" type="submit" style="margin-top:0">Envoyer ma fiche</button></form>`;
  return page('Sinistré', `
  <div class="titre-page"><div><p class="etiquette">Overmaxx Elite</p><h1>Tu es sinistré</h1></div><span class="etat" data-etat="corriger">${p.sinistres} / 3</span></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte"><p style="margin:0">Tu as disparu du processus pendant plus de 7 jours, sans prévenir. Tant que ton coach ne t'a pas réhabilité,
    tu n'as plus accès au serveur (sauf #sinistrés) ni aux coachings.</p>
    <p class="doux petit" style="margin:10px 0 0">${joursAbsence} jour(s) d'absence au total. Au 3e sinistre, plus de lives individuels.${p.sinistres < 3 ? ' Chaque semaine de plus sans revenir compte comme un sinistre de plus.' : ''}</p></div>
  ${fiche}`, espace, 'parcours');
}

// ---------- Coach : valider un compte rendu ----------
function pageCompteRenduCoach(config, { espace, cr, parcours: p, message }) {
  const nb = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
  const decision = cr.etat !== 'attente'
    ? `<div class="carte"><h2>Déjà traité</h2><p class="doux" style="margin:0">${cr.etat === 'valide' ? 'Validé' : 'Modifications demandées'} le ${echapper(formatDate(cr.decide_le))}.</p></div>`
    : `<form class="carte" method="post" action="/admin/comptes-rendus/${cr.id}/decision" style="display:grid;gap:12px">
        <h2 style="margin:0">Ta décision</h2>
        <div class="champ"><label for="texte">Ton retour</label><textarea id="texte" name="texte" placeholder="Obligatoire pour demander des modifications."></textarea></div>
        ${zoneImages()}
        <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">Demander des modifications</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div>
        <p class="doux petit" style="margin:0">Validé : ses revenus sur 28 jours comptent pour GOAT, ses vues pour son profil.</p></form>`;
  return page(`Update du compte de ${p.pseudo || ''}`, `
  <a class="retour" href="/admin/a-traiter"><span aria-hidden="true">‹</span> À traiter</a>
  <div class="titre-page"><div><p class="etiquette">${echapper(p.nom || p.pseudo || '')} · étape 4</p><h1>Update du compte · ${echapper(jourLisible(cr.jour))}</h1></div>${etatPuce(cr.etat)}</div>
  ${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}
  <div class="colonnes-2">
    <div>
      <div class="carte"><h2>28 derniers jours</h2>${cr.revenus_28j === null || cr.revenus_28j === undefined ? '<p class="doux" style="margin:0">Ancien compte rendu (avant les updates du compte).</p>' : `<div class="recap">
        <div><b>${nb(cr.vues_28j)}</b><span>vues</span></div><div><b>${dollars(cr.revenus_28j)}</b><span>revenus</span></div></div>`}</div>
      ${cr.question ? `<div class="carte"><h2>Sa question</h2><p style="margin:0">${texteRiche(cr.question)}</p></div>` : ''}
      ${cr.capture_revenus ? `<div class="carte"><h2>Capture</h2><div class="captures-cr"><figure><a href="/fichiers/images/${echapper(cr.capture_revenus)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(cr.capture_revenus)}" alt="Capture des 28 derniers jours"></a></figure></div></div>` : ''}
    </div>
    <div>
      ${decision}
      <div class="carte"><h2><a href="/admin/membres/${encodeURIComponent(p.discord_id)}" style="color:inherit">${echapper(p.pseudo || p.discord_id)}</a></h2><p class="doux petit" style="margin:0">${p.compte_tiktok ? lienTikTok(p.compte_tiktok) : ''}${p.niche ? ` · ${echapper(p.niche)}` : ''}</p>
        <a class="bouton secondaire" href="/admin/membres/${encodeURIComponent(p.discord_id)}">Voir sa fiche</a></div>
    </div>
  </div>`, espace, 'traiter');
}


// ---------- Tableau de bord des récompenses (même présentation que celui de TikTok, thème sombre) ----------
// Gains jour par jour calculés à partir du total recopié dans chaque compte rendu ; bleu = validé par le coach,
// cyan = en attente de validation. Toucher une barre affiche le détail du jour (ou du mois en vue Par an).
const STYLE_TABLEAU = `<style>
  .tb { padding:18px; border-radius:18px; background:#161618; border:1px solid var(--bord); margin-bottom:14px; }
  .tb [hidden] { display:none !important; }
  .tb-filtres { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; }
  .tb-filtre { flex:none; border:0; border-radius:999px; padding:9px 14px; background:#2c2c2e; color:#fff; font:600 14px var(--police); cursor:pointer; }
  .tb-filtre[aria-pressed="true"] { background:#fff; color:#000; }
  .tb-perso { display:flex; gap:8px; align-items:center; margin-top:12px; color:var(--doux); font-size:13px; }
  .tb-perso input { margin:0; flex:1; min-width:0; min-height:40px; padding:8px 10px; }
  .tb-tete { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:18px; }
  .tb-tete h2 { margin:0; font-size:16.5px; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tb-nav { display:flex; align-items:center; gap:2px; font-weight:700; font-size:15px; white-space:nowrap; }
  .tb-nav button { background:none; border:0; color:#fff; font:600 20px var(--police); width:30px; height:30px; cursor:pointer; border-radius:8px; }
  .tb-nav button[disabled] { color:var(--gris); cursor:default; }
  .tb-montant { display:flex; align-items:baseline; flex-wrap:wrap; gap:2px 12px; margin-top:6px; }
  .tb-total { font-size:40px; font-weight:800; letter-spacing:-0.02em; line-height:1.15; }
  .tb-total small { font-size:22px; margin-right:2px; }
  .tb-delta { color:var(--doux); font-size:15px; }
  .tb-delta b { color:#4ea1ff; font-weight:600; }
  .tb-delta[data-baisse="1"] b { color:var(--erreur); }
  .tb-dates { color:var(--doux); font-size:14px; margin:2px 0 14px; }
  .tb-legende { border:1px solid var(--bord-fort); border-radius:12px; padding:10px 14px; display:grid; gap:6px; font-size:14.5px; }
  .tb-legende div { display:flex; align-items:center; gap:8px; }
  .tb-legende span { margin-left:auto; color:var(--doux); }
  i.tb-v, i.tb-a { display:inline-block; width:10px; height:10px; border-radius:2px; flex:none; }
  .tb-v { background:#1d6cf2; } .tb-a { background:#25d0e6; }
  .tb-graphe { position:relative; display:grid; grid-template-columns:34px 1fr; column-gap:6px; margin-top:22px; }
  .tb-axe { position:relative; height:180px; color:var(--doux); font-size:12px; }
  .tb-axe span { position:absolute; right:0; transform:translateY(-50%); }
  .tb-zone { position:relative; height:180px; }
  .tb-ligne { position:absolute; left:0; right:0; border-top:1px dotted #3a3a3c; }
  .tb-barres { position:absolute; inset:0; display:flex; }
  .tb-col { flex:1; min-width:0; height:100%; padding:0; border:0; background:none; cursor:pointer; display:flex; justify-content:center; border-radius:4px 4px 0 0; }
  .tb-col[aria-pressed="true"] { background:rgba(255,255,255,.13); }
  .tb-pile { width:58%; max-width:16px; height:100%; display:flex; flex-direction:column-reverse; }
  .tb-pile i { display:block; width:100%; border-radius:2px 2px 0 0; }
  .tb-x { grid-column:2; display:flex; margin-top:6px; color:var(--doux); font-size:12px; }
  .tb-x span { flex:1; min-width:0; text-align:center; white-space:nowrap; overflow:visible; }
  .tb-bulle { position:absolute; top:4px; z-index:2; width:min(200px, 100%); background:#1c1c1e; border:1px solid var(--bord-fort); border-radius:12px;
    padding:10px 12px; box-shadow:0 10px 28px rgba(0,0,0,.55); font-size:13.5px; pointer-events:none; }
  .tb-bulle-tete { display:flex; justify-content:space-between; gap:12px; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid var(--bord-fort); font-weight:700; }
  .tb-bulle .ligne-b { display:flex; align-items:center; gap:8px; color:var(--doux); margin-top:4px; }
  .tb-bulle .ligne-b span { margin-left:auto; color:#fff; }
  .tb-bulle p { margin:8px 0 0; color:var(--gris); font-size:12.5px; }
</style>`;
const SCRIPT_TABLEAU = `
(function () {
  var MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  function argent(n) { return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function date(j, o) { var x = { timeZone: 'UTC' }; for (var k in o) x[k] = o[k]; return new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', x); }
  function cle(a, m, d) { return a + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function decaler(j, n) { return new Date(Date.parse(j + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function graduation(v) { return v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 1 : 0 }); }
  document.querySelectorAll('[data-revenus]').forEach(function (racine) {
    var d; try { d = JSON.parse(racine.getAttribute('data-revenus')); } catch (err) { return; }
    var jours = d.jours || [];
    var parJour = {}; jours.forEach(function (x) { parJour[x.j] = x; });
    var auj = d.aujourdhui;
    var dernier = jours.length ? jours[jours.length - 1].j : auj;
    var e = { vue: 'mois', a: +dernier.slice(0, 4), m: +dernier.slice(5, 7), du: decaler(dernier, -27), au: dernier, choisi: -1 };
    function q(s) { return racine.querySelector(s); }
    function jour(j, n) {
      var x = parJour[j];
      return { libelle: String(n), titre: date(j, { day: 'numeric', month: 'short' }), j: j, aDonnees: !!x,
        valide: x && x.e === 'valide' ? x.g : 0, attente: x && x.e !== 'valide' ? x.g : 0 };
    }
    function colonnes() {
      var c = [], i;
      if (e.vue === 'mois') {
        var n = new Date(Date.UTC(e.a, e.m, 0)).getUTCDate();
        for (i = 1; i <= n; i++) c.push(jour(cle(e.a, e.m, i), i));
      } else if (e.vue === 'an') {
        for (i = 1; i <= 12; i++) {
          var col = { libelle: MOIS[i - 1], titre: date(cle(e.a, i, 1), { month: 'short', year: 'numeric' }), valide: 0, attente: 0, aDonnees: false, j: null };
          for (var k = 0; k < jours.length; k++) {
            var x = jours[k];
            if (+x.j.slice(0, 4) === e.a && +x.j.slice(5, 7) === i) { col[x.e === 'valide' ? 'valide' : 'attente'] += x.g; col.aDonnees = true; col.j = x.j; }
          }
          c.push(col);
        }
      } else {
        for (var j = e.du, g = 0; j <= e.au && g < 93; j = decaler(j, 1), g++) c.push(jour(j, +j.slice(8, 10)));
      }
      return c;
    }
    function rendre() {
      racine.querySelectorAll('.tb-filtre').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-vue') === e.vue ? 'true' : 'false'); });
      q('.tb-perso').hidden = e.vue !== 'perso';
      q('.tb-nav').hidden = e.vue === 'perso';
      q('.tb-periode').textContent = e.vue === 'mois' ? date(cle(e.a, e.m, 1), { month: 'short', year: 'numeric' }) : String(e.a);
      var suivant = e.vue === 'mois' ? cle(e.a, e.m, 1) >= auj.slice(0, 8) + '01' : e.a >= +auj.slice(0, 4);
      q('.tb-suivant').disabled = suivant;
      var cols = colonnes();
      var valide = 0, attente = 0, avec = [];
      cols.forEach(function (c, i) { valide += c.valide; attente += c.attente; if (c.aDonnees) avec.push(i); });
      var total = valide + attente;
      q('.tb-total').innerHTML = '<small>' + (total < 0 ? '-$' : '$') + '</small>' + Math.abs(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      var der = avec.length ? cols[avec[avec.length - 1]] : null;
      var delta = q('.tb-delta');
      delta.hidden = !der || e.vue === 'an';
      if (der && e.vue !== 'an') {
        var gd = der.valide + der.attente;
        delta.setAttribute('data-baisse', gd < 0 ? '1' : '0');
        delta.innerHTML = '<b>' + (gd < 0 ? '▼ ' : '▲ ') + argent(Math.abs(gd)) + '</b> (' + der.titre + ')';
      }
      var longue = { day: 'numeric', month: 'short', year: 'numeric' };
      var debut = e.vue === 'mois' ? cle(e.a, e.m, 1) : e.vue === 'an' ? cle(e.a, 1, 1) : e.du;
      q('.tb-dates').textContent = e.vue === 'perso' ? date(e.du, longue) + ' - ' + date(e.au, longue)
        : der ? date(debut, longue) + ' - ' + date(der.j, longue) : 'Aucun compte rendu sur cette période';
      q('.tb-valide').textContent = argent(valide);
      q('.tb-attente').textContent = argent(attente);
      var max = 0;
      cols.forEach(function (c) { max = Math.max(max, Math.max(0, c.valide) + Math.max(0, c.attente)); });
      var haut = max > 0 ? max : 3;
      q('.tb-axe').innerHTML = [haut, haut * 2 / 3, haut / 3, 0].map(function (v, i) { return '<span style="top:' + (i * 100 / 3) + '%">' + graduation(v) + '</span>'; }).join('');
      var pas = cols.length <= 12 ? 1 : cols.length <= 31 ? 3 : Math.ceil(cols.length / 10);
      if (e.choisi >= cols.length) e.choisi = -1;
      q('.tb-barres').innerHTML = cols.map(function (c, i) {
        var v = Math.max(0, c.valide), a = Math.max(0, c.attente);
        return '<button type="button" class="tb-col" data-i="' + i + '" aria-pressed="' + (e.choisi === i) + '" aria-label="' + c.titre + ' : ' + argent(c.valide + c.attente) + '">'
          + '<span class="tb-pile"><i class="tb-v" style="height:' + (v / haut * 100) + '%"></i><i class="tb-a" style="height:' + (a / haut * 100) + '%"></i></span></button>';
      }).join('');
      q('.tb-x').innerHTML = cols.map(function (c, i) { return '<span>' + (i % pas === 0 ? c.libelle : '') + '</span>'; }).join('');
      var b = q('.tb-bulle'), c = cols[e.choisi];
      if (!c) { b.hidden = true; return; }
      b.hidden = false;
      b.innerHTML = '<div class="tb-bulle-tete"><span>' + c.titre + '</span><span>' + argent(c.valide + c.attente) + '</span></div>'
        + '<div class="ligne-b"><i class="tb-v"></i>Validé<span>' + argent(c.valide) + '</span></div>'
        + '<div class="ligne-b"><i class="tb-a"></i>En attente<span>' + argent(c.attente) + '</span></div>'
        + (c.aDonnees ? '' : '<p>Pas de compte rendu ' + (e.vue === 'an' ? 'ce mois-là.' : 'ce jour-là.') + '</p>');
      var zone = q('.tb-graphe').getBoundingClientRect(), col = q('.tb-col[data-i="' + e.choisi + '"]').getBoundingClientRect();
      var centre = col.left + col.width / 2 - zone.left;
      b.style.left = Math.max(0, Math.min(zone.width - b.offsetWidth, centre - b.offsetWidth / 2)) + 'px';
    }
    function dernierChoisi() { e.choisi = -1; }
    racine.addEventListener('click', function (ev) {
      var t = ev.target.closest('button');
      if (!t || !racine.contains(t)) return;
      if (t.classList.contains('tb-col')) { var i = +t.getAttribute('data-i'); e.choisi = e.choisi === i ? -1 : i; }
      else if (t.classList.contains('tb-filtre')) { e.vue = t.getAttribute('data-vue'); dernierChoisi(); }
      else if (t.hasAttribute('data-pas')) {
        var s = +t.getAttribute('data-pas');
        if (e.vue === 'mois') { e.m += s; if (e.m < 1) { e.m = 12; e.a--; } if (e.m > 12) { e.m = 1; e.a++; } } else e.a += s;
        dernierChoisi();
      } else return;
      rendre();
    });
    racine.querySelectorAll('.tb-perso input').forEach(function (champ) {
      champ.value = champ.name === 'du' ? e.du : e.au;
      champ.addEventListener('change', function () {
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(champ.value)) return;
        e[champ.name] = champ.value;
        if (e.du > e.au) { var t = e.du; e.du = e.au; e.au = t; }
        if (decaler(e.du, 92) < e.au) e.du = decaler(e.au, -92);
        dernierChoisi(); rendre();
      });
    });
    dernierChoisi();
    rendre();
    window.addEventListener('resize', function () { if (e.choisi >= 0) rendre(); });
  });
})();`;
function blocTableau(tableau, { titre = 'Récompenses estimées' } = {}) {
  const donnees = JSON.stringify({ aujourdhui: tableau.aujourdhui, jours: tableau.jours });
  return `${STYLE_TABLEAU}<section class="tb" data-revenus="${echapper(donnees)}" aria-label="Tableau de bord des récompenses">
    <div class="tb-filtres" role="group" aria-label="Période">
      <button type="button" class="tb-filtre" data-vue="mois" aria-pressed="true">Par mois</button>
      <button type="button" class="tb-filtre" data-vue="an">Par an</button>
      <button type="button" class="tb-filtre" data-vue="perso">Personnalisé ⌄</button>
    </div>
    <div class="tb-perso" hidden><input type="date" name="du" aria-label="Du"><span>au</span><input type="date" name="au" aria-label="Au"></div>
    <div class="tb-tete"><h2>${echapper(titre)}</h2>
      <div class="tb-nav"><button type="button" data-pas="-1" aria-label="Précédent">‹</button><span class="tb-periode"></span><button type="button" class="tb-suivant" data-pas="1" aria-label="Suivant">›</button></div></div>
    <div class="tb-montant"><span class="tb-total"><small>$</small>0.00</span><span class="tb-delta" hidden></span></div>
    <div class="tb-dates"></div>
    <div class="tb-legende"><div><i class="tb-v"></i>Validé par le coach<span class="tb-valide">$0.00</span></div>
      <div><i class="tb-a"></i>En attente de validation<span class="tb-attente">$0.00</span></div></div>
    <div class="tb-graphe"><div class="tb-axe"></div>
      <div class="tb-zone">${[0, 1, 2, 3].map((i) => `<div class="tb-ligne" style="top:${(i * 100) / 3}%"></div>`).join('')}<div class="tb-barres"></div></div>
      <div class="tb-x"></div><div class="tb-bulle" hidden></div></div>
    <noscript><p class="doux petit">Active JavaScript pour voir le graphique.</p></noscript>
  </section>`;
}

// ---------- Mon profil : le tableau de bord en haut, puis les objectifs et les statistiques ----------
// (page prévue pour le futur classement : rien de privé dessus, pas de remarques du coach).
function pageProfil(config, { espace, parcours: p, tableau, stats, recompenses = [], vueCoach, vuePublique, avatar, relation, chaine = 0, strategie = null }) {
  const trophees = recompenses.filter((r) => r.confirme_le);
  const nom = p.pseudo || p.nom || 'Membre';
  return page(vueCoach || vuePublique ? `Profil de ${nom}` : 'Mon profil', `<style>
    .profil-tete { display:flex; align-items:center; gap:14px; margin:6px 0 18px; }
    .profil-tete .avatar { width:64px; height:64px; border-radius:50%; display:grid; place-items:center; background:#2c2c2e; font-size:26px; font-weight:800; flex:none; }
    .profil-tete h1 { margin:0; font-size:24px; overflow-wrap:anywhere; }
    .profil-tete p { margin:2px 0 0; color:var(--doux); font-size:14px; overflow-wrap:anywhere; }
    .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .badges span { font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; border:1px solid var(--bord-fort); }
    .badges .trophee { border-color:#f5c542; color:#f5c542; }
  </style>${STYLE_ROLES}
  ${vueCoach ? `<a class="retour" href="/admin/membres/${encodeURIComponent(p.discord_id)}"><span aria-hidden="true">‹</span> Sa fiche</a>` : ''}
  ${vuePublique ? '<a class="retour" href="/classement"><span aria-hidden="true">‹</span> Classement</a>' : ''}
  <div class="profil-tete"><div class="avatar" aria-hidden="true">${avatar ? `<img src="${echapper(avatar)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : echapper(nom.charAt(0).toUpperCase())}</div>
    <div><h1>${echapper(nom)}</h1><p>${p.compte_tiktok ? lienTikTok(p.compte_tiktok) : 'Overmaxx Elite'}</p>
      <div class="badges"><span>${p.etape >= 5 ? 'GOAT' : `Étape ${p.etape}`}</span><span>Jour ${jourDe(p)} sur 90</span>
        ${trophees.map((r) => pastilleRole(r.role)).join('')}${pastilleRole('elite')}${chaine >= 3 ? `<span style="border-color:#ff9a3c;color:#ff9a3c">🔥 ${chaine} jours d'affilée</span>` : ''}</div></div></div>
  ${vueCoach && strategie ? `<div class="carte" style="max-width:640px"><div class="envoi-tete"><h2>Sa stratégie</h2><span class="doux petit">🔒 visible par toi seul</span></div>
    <dl class="details" style="margin-top:8px">
      <div><dt>Niche</dt><dd>${strategie.niche ? `${echapper(strategie.niche.titre)}${strategie.valide ? '' : ' <span class="doux">(à valider)</span>'}` : '<span class="doux">pas encore envoyée</span>'}</dd></div>
      <div><dt>Méthode 10K</dt><dd>${strategie.methode ? echapper(strategie.methode) : '<span class="doux">—</span>'}</dd></div>
      <div><dt>Pays visé</dt><dd>${strategie.pays ? echapper(strategie.pays) : '<span class="doux">pas encore choisi</span>'}</dd></div></dl></div>` : ''}
  ${vueCoach || (espace && espace.estAdmin) ? `<a class="bouton" href="/admin/membres/${encodeURIComponent(p.discord_id)}#remarque" style="width:auto;display:inline-block;margin:-4px 0 18px;padding-left:22px;padding-right:22px">✉️ Envoyer un message</a>` : ''}
  ${relation ? `${relation.message ? `<p class="message-ok">${echapper(relation.message)}</p>` : ''}${relation.erreur ? `<p class="erreur-form">${echapper(relation.erreur)}</p>` : ''}
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 18px">
    ${relation.concurrent ? `<form method="post" action="/communaute/concurrences/${relation.concurrenceId}/abandon" style="margin:0"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton secondaire" type="submit" style="width:auto;margin:0;padding-left:22px;padding-right:22px">Ton concurrent · abandonner</button></form>`
    : `<form method="post" action="/communaute/${relation.suit ? 'ne-plus-suivre' : 'suivre'}" style="margin:0"><input type="hidden" name="id" value="${echapper(p.discord_id)}"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton${relation.suit ? ' secondaire' : ''}" type="submit" style="width:auto;margin:0;padding-left:22px;padding-right:22px">${relation.suit ? 'Ne plus suivre' : 'Suivre'}</button></form>`}
    ${relation.peutDefier && !relation.concurrent ? `<form method="post" action="/communaute/defier" style="margin:0"><input type="hidden" name="id" value="${echapper(p.discord_id)}"><input type="hidden" name="retour" value="/classement/${echapper(p.discord_id)}">
      <button class="bouton secondaire" type="submit" style="width:auto;margin:0;padding-left:22px;padding-right:22px">Défier</button></form>` : ''}
  </div>` : ''}
  <div class="colonnes-2">
    <div>${blocTableau(tableau)}</div>
    <div>${blocObjectifs(stats)}${blocStats(stats)}</div>
  </div>`, espace, vueCoach ? 'membres' : vuePublique ? 'classement' : 'profil', null, SCRIPT_TABLEAU);
}

module.exports = { blocStats, STYLE_ETAPES, SCRIPT_ETAPES, valeurObjectif, blocHeatmap, STYLE_HEATMAP, SCRIPT_HEATMAP, barreMiseEnForme, texteSimple, zoneImages, pageResultatVideo, pageResultatCoach, listeRemarques, texteRicheAnnonce: (t) => texteRiche(t), fenetreAFaire, page, remarque, SCRIPT_TABLEAU, dollars, ETAPES, pageProfil, blocTableau, pageParcours, pageEtape1, pageEtape2, pageEtape3, pageEtape4, pageCompteRendu, pageSinistre, pageCompteRenduCoach, pageFiche, pageATraiter, pageEnvoi, delai, frise, texteRiche };
