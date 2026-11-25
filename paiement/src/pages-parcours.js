'use strict';

// Parcours de l'accompagnement Elite : Mon parcours, les étapes 1 à 3, la fiche du membre,
// et côté coach : À traiter et la validation d'un envoi. Voir docs/ACCOMPAGNEMENT-ELITE.md.
const { ICONE, echapper, formatDate, blocVideo } = require('./pages');
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
    input.addEventListener('change', function () {
      Array.prototype.forEach.call(input.files, function (f) {
        var x = new XMLHttpRequest();
        x.open('POST', '/admin/images');
        x.setRequestHeader('Content-Type', f.type || 'image/jpeg');
        x.onload = function () {
          var d = {};
          try { d = JSON.parse(x.responseText); } catch (e) { d = {}; }
          if (x.status === 200 && d.nom) {
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

const ETATS = { vide: 'À envoyer', brouillon: 'À envoyer', attente: 'En attente de validation', corriger: 'À corriger', valide: 'Validé' };
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
const zoneImages = () => `<div data-images>
  <label class="fichier">${ICONE.plus}<span><b>Joindre des images</b><br>Captures, exemples…</span><input type="file" accept="image/*" multiple hidden></label>
  <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>`;

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

const page = (titre, contenu, espace, actif, maxMo) => pageEspace(titre, `${STYLE_PARCOURS}${contenu}`, espace, actif, {
  script: `${SCRIPT_LOCAL}${maxMo ? scriptEnvoi(maxMo) : ''}${espace && espace.estAdmin ? SCRIPT_IMAGES : ''}`,
});
const enTete = (n, titre, d) => `<div class="titre-page"><div><p class="etiquette">Étape ${n} sur 4</p><h1>${echapper(titre)}</h1></div>${delai(d)}</div>${frise(n)}`;
const jourDe = (p) => Math.min(90, Math.max(1, Math.floor((Date.now() - new Date(p.entree_le)) / 86400000) + 1));

// ---------- Membre : Mon parcours ----------
function pageParcours(config, { espace, parcours: p, tache, prochain, derniere, formation }) {
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
function pageFiche(config, { espace, vueCoach, parcours: p, remarques, toutes, message }) {
  const visibles = toutes ? remarques : remarques.slice(0, 1);
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
        ${vueCoach ? `<form method="post" action="${base}/etape" style="display:grid;gap:8px;margin-top:12px">
          <label class="doux petit" for="etape">Corriger l'étape à la main</label>
          <select id="etape" name="etape">${ETAPES.map((e) => `<option value="${e.n}"${e.n === p.etape ? ' selected' : ''}>${e.n} · ${echapper(e.titre)}</option>`).join('')}</select>
          <button class="bouton secondaire" type="submit" style="margin-top:0">Changer d'étape</button></form>` : ''}</div>
      <div class="carte"><h2>Statistiques</h2><p class="doux" style="margin:0">Elles s'afficheront à partir de l'étape 4, avec les comptes rendus.</p></div>
    </div>
  </div>`, espace, vueCoach ? 'membres' : 'fiche');
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

function pageATraiter(config, { espace, a, candidatures = [] }) {
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
  const cand = (c, quoi) => carte({ qui: c.nom, pseudo: c.pseudo, quoi, quand: `Le ${formatDate(c.maj_le)}`, lien: `/admin/candidatures/${c.id}`, bouton: 'Inspecter' });
  const videosCand = candidatures.filter((c) => c.statut === 'video').map((c) => cand(c, 'Vidéo de présentation reçue'));
  const nouvellesCand = candidatures.filter((c) => c.statut === 'examen').map((c) => cand(c, 'Formulaire de candidature à examiner'));
  const retards = a.retards.map((x) => carte({ qui: nom(x.parcours), pseudo: x.parcours.pseudo, quoi: `Étape ${x.parcours.etape} : ${x.tache.titre}`,
    lien: `/admin/membres/${encodeURIComponent(x.parcours.discord_id)}`, bouton: 'Voir sa fiche', retard: true }));
  const sections = [
    { id: 'etape-1', puce: 'Étape 1', titre: 'Étape 1 · Exercices à valider', aide: 'Exercices L1 et L2 : tes remarques, puis Valider.', n: etape1.length, corps: grille(etape1) },
    { id: 'etape-2', puce: 'Étape 2', titre: 'Étape 2 · Étape 3 à ouvrir', aide: 'Coaching d\'entrée fait : note son compte, sa niche et son pays, puis ouvre son étape 3.', n: etape2.length, corps: grille(etape2) },
    { id: 'etape-3', puce: 'Étape 3', titre: 'Étape 3 · Vidéos à valider', aide: 'Ses 3 vidéos avant publication : Demander des modifications ou Valider.', n: etape3.length, corps: grille(etape3) },
    { id: 'etape-4', puce: 'Étape 4', titre: 'Étape 4 · Comptes rendus', aide: 'Les comptes rendus de publication arrivent avec la prochaine livraison.', n: 0, corps: '<p class="vide-traiter">Bientôt disponible.</p>' },
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

module.exports = { ETAPES, pageParcours, pageEtape1, pageEtape2, pageEtape3, pageFiche, pageATraiter, pageEnvoi, delai, frise, texteRiche };
