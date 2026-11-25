'use strict';

// Parcours de l'accompagnement Elite : Mon parcours, les étapes 1 à 3, la fiche du membre,
// et côté coach : À traiter et la validation d'un envoi. Voir docs/ACCOMPAGNEMENT-ELITE.md.
const { ICONE, echapper, formatDate, blocVideo } = require('./pages');
const { jourLisible, moisLisible } = require('./suivi');
const { pageEspace } = require('./pages-espace');

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
      var note = f.querySelector('[name=note]'), retour = f.querySelector('[name=retour]');
      if (note) corps.note = note.value;
      if (retour) corps.retour = retour.value;
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
    var input = zone.querySelector('input[type=file]'), cache = zone.querySelector('input[type=hidden]'), liste = zone.querySelector('.apercus'), noms = [];
    var adresse = zone.getAttribute('data-images') || '/admin/images', une = zone.hasAttribute('data-une');
    input.addEventListener('change', function () {
      Array.prototype.forEach.call(input.files, function (f) {
        var x = new XMLHttpRequest();
        x.open('POST', adresse);
        x.setRequestHeader('Content-Type', f.type || 'image/jpeg');
        x.onload = function () {
          var d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { d = {}; }
          if (x.status === 200 && d.nom) {
            if (une) { noms = []; liste.innerHTML = ''; }
            noms.push(d.nom); cache.value = noms.join(',');
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
function texteRiche(t) {
  return echapper(t || '').replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>');
}
function remarque(r) {
  return `<div class="remarque" data-type="${echapper(r.type || 'remarque')}">
    <span class="qui">Ton coach · ${echapper(formatDate(r.cree_le))}</span>
    ${r.texte && r.texte !== '(image)' ? `<p>${texteRiche(r.texte)}</p>` : ''}
    ${(r.images || []).length ? `<div class="images">${r.images.map((n) => `<a href="/fichiers/images/${echapper(n)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(n)}" alt="Image jointe par le coach" loading="lazy"></a>`).join('')}</div>` : ''}
  </div>`;
}
const zoneImages = () => `<div data-images="/admin/images">
  <label class="fichier">${ICONE.plus}<span><b>Joindre des images</b><br>Captures, exemples…</span><input type="file" accept="image/*" multiple hidden></label>
  <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>`;
// Une capture envoyée par le membre (compte, revenus).
const zoneCapture = (nom, titre, aide, deja) => `<div data-images="/api/parcours/image" data-une>
  <label class="fichier">${ICONE.plus}<span><b>${echapper(titre)}</b><br>${echapper(aide)}</span><input type="file" accept="image/*" hidden></label>
  <input type="hidden" name="${nom}" value="${echapper(deja || '')}"><div class="apercus" style="margin-top:8px">${deja ? `<img src="/fichiers/images/${echapper(deja)}" alt="">` : ''}</div></div>`;

function formVideo(emplacement, { etape1 = false, libelle } = {}) {
  return `<form data-envoi="${emplacement}">
    ${etape1 ? `<div class="champ"><label for="note-${emplacement}">Note donnée par l'IA</label><input id="note-${emplacement}" name="note" type="number" min="0" max="100" inputmode="numeric" placeholder="ex. 84" required><small>Sur 100, telle que l'IA te l'a donnée.</small></div>
    <div class="champ"><label for="retour-${emplacement}">Retour de l'IA</label><textarea id="retour-${emplacement}" name="retour" placeholder="Colle ici tout le retour de l'IA." required></textarea></div>` : ''}
    <label class="fichier">${ICONE.plus}<span><b>${echapper(libelle || 'Choisir la vidéo')}</b><br><span data-nom>MP4, MOV ou WEBM</span></span><input type="file" accept="video/*" hidden></label>
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
      <div><b>${s.vues === null ? '—' : Number(s.vues).toLocaleString('fr-FR')}</b><span>vues au total</span></div>
      <div><b>${echapper(s.paysPrincipal || '—')}</b><span>pays principal des abonnés</span></div>
      <div><b>${s.videosPubliees}</b><span>vidéos publiées</span></div>
      <div><b>${regularite}</b><span>régularité (jours publiés)</span></div>
      <div><b>${euros(s.revenus28)}</b><span>revenus des 28 derniers jours</span></div>
    </div></div>`;
}
function blocObjectifs(s, { lien, texteLien = 'Voir mon tableau de bord' } = {}) {
  if (!s) return '';
  const max = s.objectifs[s.objectifs.length - 1].montant;
  const pct = Math.min(100, Math.round((s.revenusTotal / max) * 100));
  return `<div class="carte"><div class="envoi-tete"><h2>Objectifs de revenus</h2><span class="etat" data-etat="${s.revenusTotal >= max ? 'valide' : 'attente'}">${euros(s.revenusTotal)}</span></div>
    <div class="barre-objectifs"><i style="width:${pct}%"></i></div>
    <div class="paliers">${s.objectifs.map((o) => `<span data-atteint="${o.atteint ? 1 : 0}">${o.atteint ? ICONE.ok : ''}${dollars(o.montant, { centimes: false })}</span>`).join('')}</div>
    <p class="doux petit" style="margin:10px 0 0">Récompenses cumulées des comptes rendus validés. GOAT : ${dollars(1000, { centimes: false })} sur 28 jours (${euros(s.revenus28)} en ce moment).</p>
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
const page = (titre, contenu, espace, actif, maxMo, plus = '') => pageEspace(titre, `${STYLE_PARCOURS}${contenu}`, espace, actif, {
  script: `${SCRIPT_LOCAL}${maxMo ? scriptEnvoi(maxMo) : ''}${SCRIPT_IMAGES}${plus}`,
});
const enTete = (n, titre, d) => `<div class="titre-page"><div><p class="etiquette">Étape ${n} sur 4</p><h1>${echapper(titre)}</h1></div>${delai(d)}</div>${frise(n)}`;
const jourDe = (p) => Math.min(90, Math.max(1, Math.floor((Date.now() - new Date(p.entree_le)) / 86400000) + 1));

// ---------- Membre : Mon parcours ----------
function pageParcours(config, { espace, parcours: p, tache, prochain, derniere, formation, stats }) {
  return page('Mon parcours', `
  <div class="titre-page"><div><p class="etiquette">Overmaxx Elite · jour ${jourDe(p)} sur 90</p><h1>Mon parcours</h1></div></div>
  ${frise(p.etape)}
  <div class="colonnes-2">
    <div>
      <div class="carte a-faire">
        <div class="envoi-tete"><p class="etiquette" style="margin:0">À faire maintenant${p.etape <= 4 ? ` · étape ${p.etape}` : ''}</p>${delai(tache.delai)}</div>
        <h2>${echapper(tache.titre)}</h2>
        <p class="doux" style="margin:0">${echapper(tache.texte)}</p>
        <a class="bouton" href="${echapper(tache.lien)}">${echapper(tache.bouton)}</a>
      </div>
      ${derniere ? `<div class="carte"><div class="envoi-tete"><h2>Dernière remarque du coach</h2><a class="doux petit" href="/fiche#remarques">Toutes les remarques</a></div>
        <div style="margin-top:12px">${remarque(derniere)}</div></div>` : ''}
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
        <h2>Formation sur Whop</h2>
        ${formation ? `<div class="recap"><div><b>${formation.faites} / ${formation.total || '?'}</b><span>leçons terminées</span></div>
          <div><b>${formation.derniere ? echapper(formatDate(formation.derniere)) : '—'}</b><span>dernière activité</span></div></div>
          <p class="doux petit" style="margin:10px 0 0">Mis à jour tout seul depuis Whop : rien à cocher.</p>`
    : '<p class="doux" style="margin:0">Ta progression apparaîtra ici dès que ton accès Whop sera validé.</p>'}
      </div>
    </div>
  </div>`, espace, 'parcours');
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
    </ul><p class="doux petit" style="margin:10px 0 0">Pendant ce coaching : choix de ta niche, ton compte monétisé, ta connexion, et tes coachings de la semaine.</p></div>`
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
function pageEtape3(config, { espace, parcours: p, tache, soumissions, remarquesDe, coachings, maxMo }) {
  const fini = p.etape > 3;
  const valides = soumissions.filter((s) => s.etat === 'valide').length;
  const bloc = (n) => {
    const emplacement = `V${n}`;
    const s = soumissions.find((x) => x.emplacement === emplacement);
    const etat = s ? s.etat : 'vide';
    const rem = s ? remarquesDe(s.id)[0] : null;
    let corps;
    if (['vide', 'brouillon'].includes(etat)) corps = fini ? '' : formVideo(emplacement, { libelle: `Choisir la vidéo ${n}` });
    else if (etat === 'corriger') {
      corps = `${rem ? remarque(rem) : ''}${s.corriger_avant ? `<div>${delai({ fin: s.corriger_avant, duree: 24 * 3600000 })}</div>` : ''}
        ${formVideo(emplacement, { libelle: 'Choisir la nouvelle version' })}<p class="doux petit" style="margin:0">Elle remplace l'ancienne.</p>`;
    } else {
      corps = `<p class="doux petit" style="margin:0">Envoyée le ${echapper(formatDate(s.envoye_le))}</p>${rem ? remarque(rem) : ''}
        ${etat === 'attente' && !fini ? `<details><summary>Envoyer une autre version</summary><div style="margin-top:12px">${formVideo(emplacement)}</div></details>` : ''}`;
    }
    return `<div class="carte envoi"><div class="envoi-tete"><h2>Vidéo ${n}</h2>${etatPuce(etat)}</div>${corps}</div>`;
  };
  return page('Étape 3 · Validation du contenu', `
  ${enTete(3, 'Validation du contenu', fini ? null : tache && tache.delai)}
  ${blocVideo(config.offres.elite.wistiaEtape3 || '', 'Étape 3 : tes 3 vidéos')}
  <div class="carte">
    <div class="envoi-tete"><h2>Tes 3 vidéos, avant de publier</h2><span class="etat" data-etat="${valides === 3 ? 'valide' : 'attente'}">${valides} / 3 validées</span></div>
    <p class="doux" style="margin:8px 0 0">${fini ? 'Tes 3 vidéos sont validées : tu es autorisé à publier.' : 'Ne publie rien pour l\'instant. Quand tes 3 vidéos auront la coche verte, tu seras autorisé à publier.'}</p>
  </div>
  <div class="grille-cartes">${bloc(1)}${bloc(2)}${bloc(3)}</div>
  <div class="carte">
    <div class="envoi-tete"><h2>Mes coachings de la semaine</h2>${coachings.reserves >= coachings.min ? `<span class="etat" data-etat="valide">${ICONE.ok}Réservés</span>` : '<span class="etat" data-etat="corriger">À réserver</span>'}</div>
    <p class="doux" style="margin:8px 0 0">${coachings.reserves} réservé(s) · minimum ${coachings.min}, maximum ${coachings.max} par semaine.</p>
    <a class="bouton secondaire" href="/coaching">Mes coachings</a>
  </div>`, espace, 'parcours', maxMo);
}

// ---------- La fiche (membre ou coach) ----------
function pageFiche(config, { espace, vueCoach, parcours: p, remarques, toutes, message, stats, recompenses = [], sinistre, historique = [], joursAbsence = 0 }) {
  const visibles = toutes ? remarques : remarques.slice(0, 1);
  // Ce qui attend une décision du coach (sinistre, rôle à confirmer) passe en haut de la colonne.
  const aConfirmer = recompenses.some((r) => !r.confirme_le);
  const base = vueCoach ? `/admin/membres/${encodeURIComponent(p.discord_id)}` : '/fiche';
  const dates = [['Prise en main', p.etape1_le], ['Coaching d\'entrée', p.etape2_le], ['Validation du contenu', p.etape3_le]]
    .map(([t, le], i) => [t, le ? formatDate(le) : p.etape === i + 1 ? 'en cours' : '—']);
  return page(vueCoach ? `Fiche de ${p.pseudo || p.discord_id}` : 'Ma fiche', `
  ${vueCoach ? '<p class="doux petit"><a href="/admin/membres">← Tous les membres</a></p>' : ''}
  <div class="titre-page"><div><p class="etiquette">${vueCoach ? 'Fiche Elite' : 'Overmaxx Elite'}</p><h1>${echapper(vueCoach ? p.nom || p.pseudo || p.discord_id : 'Ma fiche')}</h1></div></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}
  ${frise(p.etape)}
  <div class="colonnes-2">
    <div>
      ${vueCoach ? `<form class="carte" id="remarque" method="post" action="${base}/remarque" style="display:grid;gap:10px">
        <h2 style="margin:0">Nouvelle remarque</h2>
        <textarea name="texte" placeholder="Ta remarque. Les liens (https://…) deviennent cliquables."></textarea>
        ${zoneImages()}
        <button class="bouton" type="submit" style="margin-top:0">Publier la remarque</button>
        <p class="doux petit" style="margin:0">${echapper(p.pseudo || 'Le membre')} la voit sur sa fiche, et Bob le prévient.</p></form>` : ''}
      <div class="carte" id="remarques">
        <div class="envoi-tete"><h2>Remarques du coach</h2><span class="doux petit">${remarques.length} au total</span></div>
        <div style="display:grid;gap:10px;margin-top:12px">${visibles.map(remarque).join('') || '<p class="doux" style="margin:0">Pas encore de remarque.</p>'}</div>
        ${!toutes && remarques.length > 1 ? `<a class="bouton secondaire" href="${base}?toutes=1#remarques">Tout afficher (${remarques.length})</a>` : ''}
      </div>
    </div>
    <div>
      ${sinistre ? blocSinistres({ vueCoach, base, p, sinistre, historique, joursAbsence }) : ''}
      ${vueCoach && aConfirmer ? blocRecompenses(base, recompenses) : ''}
      <div class="carte"><h2>Identité</h2><dl class="details">
        <div><dt>Discord</dt><dd>${echapper(p.pseudo || p.discord_id)}</dd></div>
        <div><dt>Entrée</dt><dd>${echapper(formatDate(p.entree_le))}</dd></div>
        <div><dt>Fin des 90 jours</dt><dd>${echapper(formatDate(p.fin_le))}</dd></div>
        <div><dt>Niveau</dt><dd>${echapper(p.niveau || '—')}</dd></div>
      </dl></div>
      ${vueCoach ? `<form class="carte" method="post" action="${base}/compte" style="display:grid;gap:10px">
        <h2 style="margin:0">Compte TikTok</h2>
        <div class="champ"><label for="compte">Compte</label><input id="compte" name="compte" value="${echapper(p.compte_tiktok || '')}" placeholder="@compte"></div>
        <div class="champ"><label for="niche">Niche</label><input id="niche" name="niche" value="${echapper(p.niche || '')}"></div>
        <div class="champ"><label for="pays">Pays cible</label><input id="pays" name="pays" value="${echapper(p.pays || '')}"></div>
        ${p.etape === 2 ? '<button class="bouton" type="submit" name="ouvrir" value="3" style="margin-top:0">Enregistrer et ouvrir l\'étape 3</button>' : ''}
        <button class="bouton${p.etape === 2 ? ' secondaire' : ''}" type="submit" style="margin-top:0">Enregistrer</button></form>`
    : `<div class="carte"><h2>Compte TikTok</h2><dl class="details">
        <div><dt>Compte</dt><dd>${echapper(p.compte_tiktok || 'à l\'étape 2')}</dd></div>
        <div><dt>Niche</dt><dd>${echapper(p.niche || '—')}</dd></div>
        <div><dt>Pays cible</dt><dd>${echapper(p.pays || '—')}</dd></div></dl></div>`}
      <div class="carte"><h2>Parcours</h2><dl class="details">${dates.map(([t, le]) => `<div><dt>${echapper(t)}</dt><dd>${echapper(le)}</dd></div>`).join('')}</dl>
        ${p.etapes_forcees ? `<p class="doux petit" style="margin:10px 0 0">Passée(s) par ${vueCoach ? 'toi' : 'ton coach'} : étape(s) ${echapper(JSON.parse(p.etapes_forcees).join(', '))}.</p>` : ''}
        ${vueCoach && p.etape < 5 ? `<a class="bouton secondaire" href="/admin/eleves?eleve=${encodeURIComponent(p.discord_id)}">Changer d'étape</a>` : ''}</div>
      ${p.etape >= 4 && stats ? (vueCoach ? `${blocObjectifs(stats, { lien: `${base}/profil`, texteLien: 'Voir son tableau de bord' })}${blocStats(stats)}`
        : blocObjectifs(stats, { lien: '/profil' })) : '<div class="carte"><h2>Statistiques</h2><p class="doux" style="margin:0">Elles s\'afficheront à partir de l\'étape 4, avec les comptes rendus.</p></div>'}
      ${vueCoach && !aConfirmer ? blocRecompenses(base, recompenses) : ''}
      ${sinistre ? '' : blocSinistres({ vueCoach, base, p, sinistre, historique, joursAbsence })}
    </div>
  </div>`, espace, vueCoach ? 'membres' : 'fiche');
}

const NOMS_ROLES = { goat: 'GOAT', 1500: '$1,500', 5000: '$5,000', 10000: '$10,000' };
function blocRecompenses(base, recompenses) {
  if (!recompenses.length) return '';
  return `<div class="carte"><h2>Rôles</h2>${recompenses.map((r) => `<div class="ligne-envoi"><div class="qui"><b>${echapper(NOMS_ROLES[r.role] || r.role)}</b>
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
</style>`;

function pageATraiter(config, { espace, a, candidatures = [], comptesRendus = [], fichesSinistre = [], roles = [] }) {
  const nom = (p) => (p && (p.nom || p.pseudo)) || '?';
  const carte = ({ qui, pseudo, quoi, quand, lien, bouton = 'Ouvrir', retard }) => `<div class="carte-traiter">
    <span class="qui">${echapper(qui)}</span>${pseudo ? `<span class="pseudo">${echapper(pseudo)}</span>` : ''}
    <span class="quoi">${echapper(quoi)}</span>${quand ? `<span class="quand">${echapper(quand)}</span>` : ''}
    ${retard ? '<span><span class="etat" data-etat="corriger">En retard</span></span>' : ''}
    <span class="espace-bouton"></span><a class="bouton${bouton === 'Ouvrir' ? '' : ' secondaire'}" href="${echapper(lien)}">${echapper(bouton)}</a></div>`;
  const grille = (cartes) => (cartes.length ? `<div class="cartes-traiter">${cartes.join('')}</div>` : '<p class="vide-traiter">Rien à traiter.</p>');
  const envoi = (s) => carte({ qui: nom(s.parcours), pseudo: s.parcours && s.parcours.pseudo,
    quoi: s.etape === 1 ? `Exercice ${s.emplacement} · note de l'IA ${s.note} / 100` : `Vidéo ${s.emplacement.slice(1)}`,
    quand: `Envoyé le ${formatDate(s.envoye_le)}`, lien: `/admin/envois/${s.id}` });
  const etape1 = a.envois.filter((s) => s.etape === 1).map(envoi);
  const etape2 = a.etape2.map((x) => carte({ qui: nom(x.parcours), pseudo: x.parcours.pseudo, quoi: 'Coaching d\'entrée fait : ouvre son étape 3',
    quand: `Coaching du ${x.entree.date} à ${x.entree.heure} GMT`, lien: `/admin/membres/${encodeURIComponent(x.parcours.discord_id)}` }));
  const etape3 = a.envois.filter((s) => s.etape === 3).map(envoi);
  const etape4 = comptesRendus.map((cr) => carte({ qui: nom(cr.parcours), pseudo: cr.parcours && cr.parcours.pseudo, quoi: `Compte rendu du ${jourLisible(cr.jour)}`,
    quand: `Envoyé le ${formatDate(cr.envoye_le)}`, lien: `/admin/comptes-rendus/${cr.id}` }));
  const sinistres = fichesSinistre.map((s) => carte({ qui: nom(s.parcours), pseudo: s.parcours && s.parcours.pseudo, quoi: `Fiche de sinistre (${s.numero} / 3)`,
    quand: `Remplie le ${formatDate(s.fiche_le)}`, lien: `/admin/membres/${encodeURIComponent(s.discord_id)}` }));
  const recompenses = roles.map((r) => carte({ qui: nom(r.parcours), pseudo: r.parcours && r.parcours.pseudo, quoi: `Rôle ${NOMS_ROLES[r.role] || r.role} à confirmer`,
    quand: `Seuil atteint le ${formatDate(r.atteint_le)}`, lien: `/admin/membres/${encodeURIComponent(r.discord_id)}` }));
  const cand = (c, quoi) => carte({ qui: c.nom, pseudo: c.pseudo, quoi, quand: `Le ${formatDate(c.maj_le)}`, lien: `/admin/candidatures/${c.id}`, bouton: 'Inspecter' });
  const videosCand = candidatures.filter((c) => c.statut === 'video').map((c) => cand(c, 'Vidéo de présentation reçue'));
  const nouvellesCand = candidatures.filter((c) => c.statut === 'examen').map((c) => cand(c, 'Formulaire de candidature à examiner'));
  const retards = a.retards.map((x) => carte({ qui: nom(x.parcours), pseudo: x.parcours.pseudo, quoi: `Étape ${x.parcours.etape} : ${x.tache.titre}`,
    lien: `/admin/membres/${encodeURIComponent(x.parcours.discord_id)}`, bouton: 'Voir sa fiche', retard: true }));
  const sections = [
    { id: 'etape-1', puce: 'Étape 1', titre: 'Étape 1 · Exercices à valider', aide: 'Exercices L1 et L2 : tes remarques, puis Valider.', n: etape1.length, corps: grille(etape1) },
    { id: 'etape-2', puce: 'Étape 2', titre: 'Étape 2 · Étape 3 à ouvrir', aide: 'Coaching d\'entrée fait : note son compte, sa niche et son pays, puis ouvre son étape 3.', n: etape2.length, corps: grille(etape2) },
    { id: 'etape-3', puce: 'Étape 3', titre: 'Étape 3 · Vidéos à valider', aide: 'Ses 3 vidéos avant publication : Demander des modifications ou Valider.', n: etape3.length, corps: grille(etape3) },
    { id: 'etape-4', puce: 'Étape 4', titre: 'Étape 4 · Comptes rendus', aide: 'Les résultats de ses vidéos : Demander des modifications ou Valider. Les revenus validés font avancer ses objectifs.', n: etape4.length, corps: grille(etape4) },
    { id: 'roles', puce: 'Rôles', titre: 'GOAT et rôles de revenus à confirmer', aide: 'Seuil atteint d\'après ses comptes rendus validés : confirme, et Bob donne le rôle.', n: recompenses.length, corps: grille(recompenses) },
    { id: 'sinistres', puce: 'Sinistrés', titre: 'Fiches de sinistre', aide: 'Lis sa fiche : Demander des précisions ou Réhabiliter.', n: sinistres.length, corps: grille(sinistres) },
    { id: 'demandes', puce: 'Demandes d\'intégration', titre: 'Demandes d\'intégration', aide: 'Les candidats retenus qui ont envoyé leur vidéo passent avant les nouvelles candidatures.',
      n: videosCand.length + nouvellesCand.length,
      corps: `<h3 class="sous">Vidéos de présentation (${videosCand.length})</h3>${grille(videosCand)}<h3 class="sous">Nouvelles candidatures (${nouvellesCand.length})</h3>${grille(nouvellesCand)}` },
  ];
  if (retards.length) sections.push({ id: 'retards', puce: 'En retard', titre: 'En retard', aide: 'Pour information : Bob les relance déjà toutes les 12 heures.', n: retards.length, corps: grille(retards) });
  const total = sections.filter((x) => x.id !== 'retards').reduce((t, x) => t + x.n, 0);
  return page('À traiter', `${STYLE_TRAITER}
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>À traiter</h1></div><span class="doux petit">${total} en attente de ta décision</span></div>
  <nav class="puces-traiter" aria-label="Catégories">${sections.map((x) => `<a href="#${x.id}"${x.n ? '' : ' data-vide'}>${echapper(x.puce)}<b>${x.n}</b></a>`).join('')}</nav>
  ${sections.map((x) => `<section class="section-traiter" id="${x.id}"><div class="tete"><h2>${echapper(x.titre)}</h2><span class="doux petit">${x.n} à traiter</span></div>
    <p>${echapper(x.aide)}</p>${x.corps}</section>`).join('')}`, espace, 'traiter');
}

// ---------- Coach : valider un envoi ----------
function pageEnvoi(config, { espace, s, parcours: p, remarques, niveauPropose, message }) {
  const etape1 = s.etape === 1;
  const titre = etape1 ? `Exercice ${s.emplacement}` : `Vidéo ${s.emplacement.slice(1)}`;
  const decision = s.etat !== 'attente'
    ? `<div class="carte"><h2>Déjà traité</h2><p class="doux" style="margin:0">${s.etat === 'valide' ? 'Validé' : 'Modifications demandées'} le ${echapper(formatDate(s.decide_le))}.</p></div>`
    : `<form class="carte" method="post" action="/admin/envois/${s.id}/decision" style="display:grid;gap:12px">
        <h2 style="margin:0">Ta décision</h2>
        ${etape1 ? `<div class="champ"><label for="niveau">Niveau</label><select id="niveau" name="niveau">
            <option value="L2"${niveauPropose === 'L2' ? ' selected' : ''}>L2</option><option value="L1"${niveauPropose === 'L1' ? ' selected' : ''}>L1</option></select>
          <small>Proposé : ${echapper(niveauPropose)} (L2 si ses deux notes sont à 80 ou plus).</small></div>` : ''}
        <div class="champ"><label for="texte">${etape1 ? 'Tes remarques (facultatif)' : 'Ton retour complet'}</label>
          <textarea id="texte" name="texte" placeholder="${etape1 ? 'Ce qu\'il peut améliorer.' : 'Ce qui va, ce qui ne va pas, et quoi changer.'}"></textarea></div>
        ${zoneImages()}
        ${etape1 ? '<button class="bouton vert" type="submit" name="decision" value="valider" style="margin-top:0">Valider</button><p class="doux petit" style="margin:0">À l\'étape 1, les exercices ne se refont pas : tu ajoutes tes remarques et tu valides.</p>'
    : '<div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">Demander des modifications</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div><p class="doux petit" style="margin:0">Modifications : il a 24 h pour renvoyer, Bob le prévient. Validé : plus rien ne se modifie.</p>'}
      </form>`;
  return page(`${titre} de ${p.pseudo || ''}`, `
  <p class="doux petit"><a href="/admin/a-traiter">← À traiter</a></p>
  <div class="titre-page"><div><p class="etiquette">${echapper(p.nom || p.pseudo || '')} · étape ${s.etape}</p><h1>${echapper(titre)}</h1></div>${etatPuce(s.etat)}</div>
  ${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}
  <div class="colonnes-2">
    <div>
      ${s.fichier ? `<video controls preload="metadata" playsinline src="/admin/envois/${s.id}/video" style="width:100%;max-height:70vh;border-radius:14px;background:#000"></video>`
    : '<div class="carte"><p class="doux" style="margin:0">La vidéo a été supprimée du serveur (étape validée).</p></div>'}
      ${etape1 ? `<div class="carte"><div class="envoi-tete"><h2>Note de l'IA</h2><span class="note-ia">${echapper(s.note)}<small> / 100</small></span></div>
        <details style="margin-top:10px"><summary>Retour de l'IA (copié par ${echapper(p.pseudo || 'le membre')})</summary><p class="doux" style="white-space:pre-line">${echapper(s.retour_ia || '')}</p></details></div>` : ''}
      ${remarques.length ? `<div class="carte"><h2>Tes remarques sur cet envoi</h2><div style="display:grid;gap:10px">${remarques.map(remarque).join('')}</div></div>` : ''}
    </div>
    <div>
      ${decision}
      <div class="carte"><h2>${echapper(p.pseudo || p.discord_id)}</h2><p class="doux petit" style="margin:0">Étape ${p.etape}${p.niche ? ` · ${echapper(p.niche)}` : ''}${p.compte_tiktok ? ` · ${echapper(p.compte_tiktok)}` : ''}</p>
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
function formHeures(p, { titre = 'Choisis tes 3 heures' } = {}) {
  const h = (nom, val, label, conseil) => `<div class="champ"><label for="${nom}">${label}</label><input id="${nom}" name="${nom}" type="time" value="${echapper(val || '')}" required><small>${conseil}</small></div>`;
  return `<form method="post" action="/parcours/etape-4/heures" style="display:grid;gap:14px">
    ${titre ? `<h2 style="margin:0">${echapper(titre)}</h2>` : ''}
    <p class="doux" style="margin:0">Des heures fixes, chaque jour. Bob te les rappelle, à ton heure (<span data-fuseau>GMT</span>).</p>
    ${h('creation', p.heure_creation, 'Création de ta vidéo', 'Le moment où tu es le plus libre et le plus en forme. Il n\'y a pas de bon moment : le meilleur est celui que tu décides d\'y consacrer.')}
    ${h('publication', p.heure_publication, 'Publication', 'Je te conseille 1 h après la création : le montage prend 1 h maximum.')}
    ${h('compte_rendu', p.heure_compte_rendu, 'Compte rendu', '24 h après la publication : tu envoies les résultats de la veille.')}
    <input type="hidden" name="fuseau" value="">
    <button class="bouton" type="submit" style="margin-top:0">Enregistrer mes heures</button></form>`;
}
function pageEtape4(config, { espace, parcours: p, tache, aujourdhui, publications, capture, aFaire, stats, message }) {
  const corps = !p.heure_creation ? `<div class="carte">${formHeures(p)}</div>` : `
  <div class="carte">
    <div class="envoi-tete"><h2>Aujourd'hui</h2>${publications.length ? `<span class="etat" data-etat="valide">${ICONE.ok}${publications.length} vidéo(s) déclarée(s)</span>` : '<span class="etat" data-etat="attente">À déclarer</span>'}</div>
    <p class="doux" style="margin:8px 0 12px">Au moins une vidéo par jour. Après avoir publié, colle son lien et ajoute la capture de ton compte.</p>
    ${publications.length ? `<ul class="liste" style="margin-bottom:12px">${publications.map((x, i) => `<li>${ICONE.ok}<span>Vidéo ${i + 1} : <a href="${echapper(x.lien)}" target="_blank" rel="noopener">${echapper(x.lien)}</a></span></li>`).join('')}</ul>` : ''}
    <form method="post" action="/parcours/etape-4/publication" style="display:grid;gap:12px">
      <div class="champ"><label for="liens">${publications.length ? 'Une autre vidéo publiée aujourd\'hui ?' : 'Lien de ta vidéo TikTok'}</label>
        <textarea id="liens" name="liens" placeholder="https://www.tiktok.com/@ton.compte/video/…" style="min-height:70px"></textarea><small>Un lien par ligne si tu en as publié plusieurs.</small></div>
      ${capture ? '<p class="doux petit" style="margin:0">Capture du compte reçue pour aujourd\'hui. Tu peux la remplacer :</p>' : ''}
      ${zoneCapture('capture', capture ? 'Remplacer la capture du compte' : 'Capture de ton compte', 'Ton profil TikTok tel qu\'il est maintenant : on y voit tes vidéos publiées.', '')}
      <button class="bouton" type="submit" style="margin-top:0">Déclarer</button>
    </form>
  </div>
  <div class="carte">
    <div class="envoi-tete"><h2>Comptes rendus</h2>${aFaire.length ? `<span class="etat" data-etat="corriger">${aFaire.length} à faire</span>` : `<span class="etat" data-etat="valide">${ICONE.ok}À jour</span>`}</div>
    ${aFaire.length ? aFaire.map((x) => `<div class="ligne-envoi"><div class="qui"><b>Compte rendu du ${echapper(jourLisible(x.jour))}</b><span>${x.videos} vidéo(s)${x.cr && x.cr.etat === 'corriger' ? ' · à corriger' : ''}</span></div>
      <a class="bouton" href="/parcours/compte-rendu/${echapper(x.jour)}">Faire</a></div>`).join('')
    : '<p class="doux" style="margin:8px 0 0">Rien à envoyer pour l\'instant. Le compte rendu d\'un jour se fait le lendemain, à ton heure de compte rendu.</p>'}
  </div>
  <div class="carte"><div class="envoi-tete"><h2>Mes heures</h2><span class="doux petit">à ton heure</span></div>
    <div class="recap" style="grid-template-columns:repeat(3,1fr)"><div><b>${echapper(p.heure_creation)}</b><span>création</span></div><div><b>${echapper(p.heure_publication)}</b><span>publication</span></div><div><b>${echapper(p.heure_compte_rendu)}</b><span>compte rendu</span></div></div>
    <details style="margin-top:12px"><summary>Modifier mes heures</summary><div style="margin-top:12px">${formHeures(p, { titre: '' })}</div></details></div>
  ${blocObjectifs(stats, { lien: '/profil' })}`;
  return page('Étape 4 · Publication et suivi', `
  <div class="titre-page"><div><p class="etiquette">Étape 4 sur 4${aujourdhui ? ` · ${echapper(jourLisible(aujourdhui))}` : ''}</p><h1>Publication et suivi</h1></div>${delai(tache && tache.delai)}</div>
  ${frise(Math.min(p.etape, 5))}
  ${message ? `<p class="${message.erreur ? 'erreur-form' : 'message-ok'}">${echapper(message.texte)}</p>` : ''}
  ${corps}`, espace, 'parcours', null, SCRIPT_FUSEAU);
}

// ---------- Membre : le compte rendu d'un jour ----------
function pageCompteRendu(config, { espace, parcours: p, jour, videos, cr, questions, remarques = [], erreur, precedent }) {
  const v = (k) => (cr && cr[k] !== null && cr[k] !== undefined ? cr[k] : '');
  const stat = (id, k) => { const x = cr && (cr.videos || []).find((y) => y.publication_id === id); return x && x[k] !== null ? x[k] : ''; };
  const pays = (k, i) => (cr && cr[k] && cr[k][i]) || '';
  const champ = (nom, label, val, { type = 'number', aide, pas } = {}) => `<div class="champ"><label for="${nom}">${label}</label><input id="${nom}" name="${nom}" type="${type}" ${type === 'number' ? `min="0" inputmode="decimal"${pas ? ` step="${pas}"` : ''}` : ''} value="${echapper(val)}" required>${aide ? `<small>${aide}</small>` : ''}</div>`;
  const troisPays = (k, label) => `<div class="champ"><label for="${k}_1">${label}</label><div class="trois">${[0, 1, 2].map((i) => `<input id="${k}_${i + 1}" name="${k}_${i + 1}" type="text" placeholder="${['1er', '2e', '3e'][i]}" aria-label="${label} : n° ${i + 1}" value="${echapper(pays(k, i))}"${i ? '' : ' required'}>`).join('')}</div></div>`;
  const question = cr && cr.question;
  const predefinie = questions.includes(question);
  return page(`Compte rendu du ${jourLisible(jour)}`, `
  <p class="doux petit"><a href="/parcours/etape-4">← Étape 4</a></p>
  <div class="titre-page"><div><p class="etiquette">Compte rendu</p><h1>Résultats du ${echapper(jourLisible(jour))}</h1></div>${cr && cr.etat ? etatPuce(cr.etat) : ''}</div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${cr && cr.etat === 'corriger' && remarques[0] ? remarque({ ...remarques[0], type: 'corriger' }) : ''}
  <form method="post" action="/parcours/compte-rendu/${echapper(jour)}" style="display:grid;gap:14px;margin-top:14px">
    <div class="carte" style="display:grid;gap:12px;margin:0"><h2 style="margin:0">Tes récompenses TikTok</h2>
      <div class="champ"><label for="total_mois">Récompenses estimées de ${echapper(moisLisible(jour))}</label>
        <input id="total_mois" name="total_mois" type="text" inputmode="decimal" placeholder="$0.00" autocomplete="off" value="${echapper(v('total_mois'))}" required
          data-precedent="${precedent ? precedent.total : 0}" data-jour-precedent="${precedent ? echapper(jourLisible(precedent.jour)) : ''}" data-mois="${echapper(moisLisible(jour))}">
        <small>Programme de récompenses → <b>Par mois</b> → ${echapper(moisLisible(jour))} : recopie le gros montant du haut, tel quel.</small></div>
      <p class="calcul-gain" aria-live="polite">${precedent ? `Ton dernier total de ${echapper(moisLisible(jour))} : <b>${dollars(precedent.total)}</b> (${echapper(jourLisible(precedent.jour))}). Le site calcule ton gain du jour.` : `Premier compte rendu de ${echapper(moisLisible(jour))} : ce total est ton gain du jour.`}</p>
      ${zoneCapture('capture_revenus', cr && cr.capture_revenus ? 'Remplacer la capture des récompenses' : 'Capture de ce tableau de bord', 'La page Programme de récompenses, avec le montant que tu viens de recopier.', cr ? cr.capture_revenus : '')}</div>
    <div class="carte" style="display:grid;gap:12px;margin:0"><h2 style="margin:0">Ton compte</h2>
      <div class="grille-champs">
        ${champ('abonnes_total', 'Abonnés au total', v('abonnes_total'))}${champ('vues_total', 'Vues au total', v('vues_total'))}
        ${champ('abonnes_jour', 'Abonnés gagnés', v('abonnes_jour'))}${champ('vues_jour', 'Vues du jour', v('vues_jour'))}
      </div>
      ${troisPays('pays_vues', 'Top 3 des pays de tes vues')}
      ${troisPays('pays_abonnes', 'Top 3 des pays de tes abonnés')}
    </div>
    ${videos.map((x, i) => `<div class="carte video-cr" style="margin:0"><h2 style="margin:0">Vidéo ${i + 1}</h2><a href="${echapper(x.lien)}" target="_blank" rel="noopener">${echapper(x.lien)}</a>
      <div class="grille-champs">
        ${champ(`v_${x.id}_vues`, 'Vues', stat(x.id, 'vues'))}${champ(`v_${x.id}_abonnes`, 'Abonnés gagnés', stat(x.id, 'abonnes'))}
        ${champ(`v_${x.id}_heure`, 'Heure de publication', stat(x.id, 'heure'), { type: 'time' })}
        ${champ(`v_${x.id}_visionnage_s`, 'Visionnage moyen (s)', stat(x.id, 'visionnage_s'))}
        ${champ(`v_${x.id}_retention_10s`, 'Rétention à 10 s (%)', stat(x.id, 'retention_10s'), { pas: '0.1' })}
        ${champ(`v_${x.id}_revenus`, 'Récompenses de la vidéo ($)', stat(x.id, 'revenus'), { pas: '0.01' })}
      </div></div>`).join('')}
    <div class="carte" style="display:grid;gap:12px;margin:0"><h2 style="margin:0">Ta question du moment</h2>
      <select name="question" id="question">
        <option value="">Pas de question</option>
        ${questions.map((x) => `<option${x === question ? ' selected' : ''}>${echapper(x)}</option>`).join('')}
        <option value="autre"${question && !predefinie ? ' selected' : ''}>Autre (je l'écris)</option>
      </select>
      <textarea name="question_autre" placeholder="Ta question, si tu as choisi « Autre ».">${question && !predefinie ? echapper(question) : ''}</textarea></div>
    <button class="bouton" type="submit" style="margin-top:0">Envoyer mon compte rendu</button>
  </form>`, espace, 'parcours', null, SCRIPT_GAIN);
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
function pageCompteRenduCoach(config, { espace, cr, parcours: p, capture, message, precedent }) {
  const nb = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('fr-FR'));
  const decision = cr.etat !== 'attente'
    ? `<div class="carte"><h2>Déjà traité</h2><p class="doux" style="margin:0">${cr.etat === 'valide' ? 'Validé' : 'Modifications demandées'} le ${echapper(formatDate(cr.decide_le))}.</p></div>`
    : `<form class="carte" method="post" action="/admin/comptes-rendus/${cr.id}/decision" style="display:grid;gap:12px">
        <h2 style="margin:0">Ta décision</h2>
        <div class="champ"><label for="texte">Ton retour</label><textarea id="texte" name="texte" placeholder="Obligatoire pour demander des modifications."></textarea></div>
        ${zoneImages()}
        <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="corriger">Demander des modifications</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div>
        <p class="doux petit" style="margin:0">Validé : ses revenus comptent pour ses objectifs, GOAT et ses rôles.</p></form>`;
  const revenus = cr.videos.reduce((t, x) => t + (x.revenus || 0), 0);
  return page(`Compte rendu de ${p.pseudo || ''}`, `
  <p class="doux petit"><a href="/admin/a-traiter#etape-4">← À traiter</a></p>
  <div class="titre-page"><div><p class="etiquette">${echapper(p.nom || p.pseudo || '')} · étape 4</p><h1>Compte rendu du ${echapper(jourLisible(cr.jour))}</h1></div>${etatPuce(cr.etat)}</div>
  ${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}
  <div class="colonnes-2">
    <div>
      <div class="carte"><h2>Ses récompenses TikTok</h2>${cr.total_mois === null || cr.total_mois === undefined ? '<p class="doux" style="margin:0">Pas de total recopié.</p>' : `<div class="recap">
        <div><b>${dollars(cr.total_mois)}</b><span>total de ${echapper(moisLisible(cr.jour))} (tableau de bord)</span></div>
        <div><b>${dollars(Math.round((cr.total_mois - (precedent ? precedent.total : 0)) * 100) / 100)}</b><span>gain du jour</span></div></div>
        <p class="doux petit" style="margin:10px 0 0">${precedent ? `${dollars(cr.total_mois)} − ${dollars(precedent.total)} (son total du ${echapper(jourLisible(precedent.jour))}${precedent.etat === 'valide' ? '' : ', pas encore validé'}).` : `Premier compte rendu de ${echapper(moisLisible(cr.jour))} : le total est le gain du jour.`} Vérifie-le sur sa capture.</p>`}</div>
      <div class="carte"><h2>Son compte</h2><div class="recap">
        <div><b>${nb(cr.abonnes_total)}</b><span>abonnés au total</span></div><div><b>${nb(cr.vues_total)}</b><span>vues au total</span></div>
        <div><b>+${nb(cr.abonnes_jour)}</b><span>abonnés ce jour-là</span></div><div><b>${nb(cr.vues_jour)}</b><span>vues ce jour-là</span></div></div>
        <dl class="details" style="margin-top:12px"><div><dt>Pays des vues</dt><dd>${echapper(cr.pays_vues.join(', ') || '—')}</dd></div>
        <div><dt>Pays des abonnés</dt><dd>${echapper(cr.pays_abonnes.join(', ') || '—')}</dd></div></dl></div>
      <div class="carte"><h2>Ses vidéos (${cr.videos.length}) · ${dollars(revenus)}</h2><div class="defile"><table class="cr">
        <tr><th>Vidéo</th><th>Vues</th><th>Abonnés</th><th>Publiée à</th><th>Visionnage</th><th>Rétention 10 s</th><th>Revenus</th></tr>
        ${cr.videos.map((x, i) => `<tr><td><a href="${echapper(x.lien)}" target="_blank" rel="noopener">Vidéo ${i + 1}</a></td><td>${nb(x.vues)}</td><td>${nb(x.abonnes)}</td><td>${echapper(x.heure || '—')}</td>
          <td>${nb(x.visionnage_s)} s</td><td>${nb(x.retention_10s)} %</td><td>${euros(x.revenus)}</td></tr>`).join('')}
      </table></div></div>
      ${cr.question ? `<div class="carte"><h2>Sa question</h2><p style="margin:0">${texteRiche(cr.question)}</p></div>` : ''}
      <div class="carte"><h2>Captures</h2><div class="captures-cr">
        ${capture ? `<figure><a href="/fichiers/images/${echapper(capture.image)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(capture.image)}" alt="Capture du compte"></a><figcaption>Son compte, ${echapper(jourLisible(cr.jour))}</figcaption></figure>` : ''}
        ${cr.capture_revenus ? `<figure><a href="/fichiers/images/${echapper(cr.capture_revenus)}" target="_blank" rel="noopener"><img src="/fichiers/images/${echapper(cr.capture_revenus)}" alt="Capture des récompenses"></a><figcaption>Son tableau de bord des récompenses</figcaption></figure>` : ''}</div></div>
    </div>
    <div>
      ${decision}
      <div class="carte"><h2>${echapper(p.pseudo || p.discord_id)}</h2><p class="doux petit" style="margin:0">${p.compte_tiktok ? echapper(p.compte_tiktok) : ''}${p.niche ? ` · ${echapper(p.niche)}` : ''}</p>
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
function pageProfil(config, { espace, parcours: p, tableau, stats, recompenses = [], vueCoach }) {
  const trophees = recompenses.filter((r) => r.confirme_le);
  const nom = p.pseudo || p.nom || 'Membre';
  return page(vueCoach ? `Profil de ${nom}` : 'Mon profil', `<style>
    .profil-tete { display:flex; align-items:center; gap:14px; margin:6px 0 18px; }
    .profil-tete .avatar { width:64px; height:64px; border-radius:50%; display:grid; place-items:center; background:#2c2c2e; font-size:26px; font-weight:800; flex:none; }
    .profil-tete h1 { margin:0; font-size:24px; overflow-wrap:anywhere; }
    .profil-tete p { margin:2px 0 0; color:var(--doux); font-size:14px; overflow-wrap:anywhere; }
    .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .badges span { font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; border:1px solid var(--bord-fort); }
    .badges .trophee { border-color:#f5c542; color:#f5c542; }
  </style>
  ${vueCoach ? `<p class="doux petit"><a href="/admin/membres/${encodeURIComponent(p.discord_id)}">← Sa fiche</a></p>` : ''}
  <div class="profil-tete"><div class="avatar" aria-hidden="true">${echapper(nom.charAt(0).toUpperCase())}</div>
    <div><h1>${echapper(nom)}</h1><p>${echapper([p.compte_tiktok, p.niche].filter(Boolean).join(' · ') || 'Overmaxx Elite')}</p>
      <div class="badges"><span>${p.etape >= 5 ? 'GOAT' : `Étape ${p.etape}`}</span><span>Jour ${jourDe(p)} sur 90</span>
        ${trophees.map((r) => `<span class="trophee">${echapper(NOMS_ROLES[r.role] || r.role)}</span>`).join('')}</div></div></div>
  <div class="colonnes-2">
    <div>${blocTableau(tableau)}</div>
    <div>${blocObjectifs(stats)}${blocStats(stats)}</div>
  </div>`, espace, vueCoach ? 'membres' : 'profil', null, SCRIPT_TABLEAU);
}

module.exports = { ETAPES, pageProfil, blocTableau, pageParcours, pageEtape1, pageEtape2, pageEtape3, pageEtape4, pageCompteRendu, pageSinistre, pageCompteRenduCoach, pageFiche, pageATraiter, pageEnvoi, delai, frise, texteRiche };
