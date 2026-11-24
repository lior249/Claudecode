'use strict';

// Formulaire maison « façon Tally » : une question par écran, grande typographie, réponse soulignée,
// « OK » ou Entrée pour avancer, barre de progression, flèches ▲▼ pour revenir.
const { echapper, gabarit } = require('./pages');

const STYLE_FORMULAIRE = `<style>
  main { max-width:680px; padding-top:16px; }
  .entete { padding:0 0 4px; } .entete .logo { font-size:18px; }
  .tf-progres { position:fixed; top:0; left:0; right:0; height:4px; background:#141414; z-index:5; }
  .tf-progres i { display:block; height:100%; width:0; background:#fff; transition:width .35s ease; }
  .tf-ecran { min-height:calc(100vh - 150px); min-height:calc(100dvh - 150px); display:flex; flex-direction:column; justify-content:center; padding:24px 0 72px; animation:tf-entree .35s ease; }
  @keyframes tf-entree { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
  .tf-num { color:var(--doux); font:600 14px var(--police); margin:0 0 8px; display:flex; align-items:center; gap:6px; }
  .tf-q { font-size:clamp(22px, 5.2vw, 30px); line-height:1.25; font-weight:700; letter-spacing:-0.02em; margin:0 0 8px; }
  .tf-q .etoile { color:var(--doux); font-weight:500; }
  .tf-aide { color:var(--doux); font-size:16px; margin:0 0 26px; }
  .tf-champ { width:100%; background:transparent; border:0; border-bottom:2px solid #3a3a3a; border-radius:0; padding:8px 0 10px;
    color:#fff; font:500 clamp(19px, 4.6vw, 24px) var(--police); outline:none; transition:border-color .2s; }
  .tf-champ:focus { border-bottom-color:#fff; }
  .tf-champ:focus-visible { outline:none; }
  .tf-champ::placeholder { color:#4a4a4a; }
  textarea.tf-champ { resize:none; min-height:48px; }
  .tf-options { display:flex; flex-direction:column; gap:10px; max-width:420px; }
  .tf-option { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid #3a3a3a; border-radius:12px; background:#0d0d0d;
    color:#fff; font:500 17px var(--police); cursor:pointer; text-align:left; }
  .tf-option b { display:grid; place-items:center; width:26px; height:26px; border:1px solid #555; border-radius:6px; font-size:12px; flex:none; }
  .tf-option.choisi { border-color:#fff; background:#1a1a1a; } .tf-option.choisi b { background:#fff; color:#000; border-color:#fff; }
  .tf-fichier { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:150px; border:1.5px dashed #444;
    border-radius:16px; color:var(--doux); cursor:pointer; text-align:center; padding:18px; }
  .tf-fichier b { color:#fff; font-size:17px; }
  .tf-fichier.rempli { border-style:solid; border-color:#fff; }
  .tf-erreur { color:var(--erreur); font-size:15px; min-height:22px; margin:12px 0 0; }
  .tf-actions { display:flex; align-items:center; gap:14px; margin-top:18px; }
  .tf-ok { display:inline-flex; align-items:center; gap:8px; padding:11px 20px; border:0; border-radius:10px; background:#fff; color:#000;
    font:700 16px var(--police); cursor:pointer; }
  .tf-ok:disabled { opacity:.5; cursor:default; }
  .tf-indice { color:var(--gris); font-size:13px; } .tf-indice b { color:var(--doux); }
  .tf-nav { position:fixed; right:16px; bottom:16px; display:flex; gap:2px; z-index:5; }
  .tf-nav button { width:38px; height:34px; border:0; background:#fff; color:#000; font-size:14px; cursor:pointer; }
  .tf-nav button:first-child { border-radius:8px 0 0 8px; } .tf-nav button:last-child { border-radius:0 8px 8px 0; }
  .tf-nav button:disabled { opacity:.35; cursor:default; }
  .tf-barre { height:8px; border-radius:8px; background:#1a1a1a; overflow:hidden; margin:18px 0 6px; } .tf-barre i { display:block; height:100%; width:0; background:#fff; }
  .tf-fin .icone-ronde { margin:0 0 18px; }
  @media (hover: none) { .tf-indice { display:none; } }
</style>`;

// questions : liste filtrée (côté serveur) ; mode : 'candidature' | 'confirmation'.
function pageFormulaire(config, { titre, mode, questions, intro, fin, videoMaxMo }) {
  const donnees = {
    mode, videoMaxMo,
    questions: questions.map((q) => ({ id: q.id, type: q.type, question: q.question, aide: q.aide || '', obligatoire: Boolean(q.obligatoire), options: q.options || [] })),
  };
  const script = `
  (function () {
    var D = ${JSON.stringify(donnees)};
    var Q = D.questions, rep = {}, fichier = null, i = ${intro ? -1 : 0}, envoi = false;
    var zone = document.getElementById('tf'), barre = document.querySelector('.tf-progres i');
    var haut = document.getElementById('tf-haut'), bas = document.getElementById('tf-bas');
    var INTRO = document.getElementById('tf-intro'), FIN = document.getElementById('tf-fin');
    function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt !== undefined) e.textContent = txt; return e; }
    function progres() { barre.style.width = (Math.max(0, i) / Q.length * 100) + '%'; haut.disabled = i <= 0 || envoi; bas.disabled = i < 0 || i >= Q.length - 1 || envoi; }

    function afficher(erreur) {
      zone.innerHTML = ''; progres();
      if (i < 0) { zone.appendChild(INTRO.content.cloneNode(true)); var go = zone.querySelector('[data-commencer]'); if (go) go.onclick = function () { i = 0; afficher(); }; return; }
      var q = Q[i], e = el('section', 'tf-ecran');
      var n = el('p', 'tf-num'); n.textContent = (i + 1) + ' → '; e.appendChild(n);
      var h = el('h1', 'tf-q', q.question); if (q.obligatoire) { var s = el('span', 'etoile', ' *'); h.appendChild(s); } e.appendChild(h);
      if (q.aide) e.appendChild(el('p', 'tf-aide', q.aide));
      var champ = null;
      if (q.type === 'choix') {
        var box = el('div', 'tf-options');
        q.options.forEach(function (o, k) {
          var b = el('button', 'tf-option' + (rep[q.id] === o ? ' choisi' : '')); b.type = 'button';
          b.appendChild(el('b', '', String.fromCharCode(65 + k))); b.appendChild(document.createTextNode(o));
          b.onclick = function () { rep[q.id] = o; afficher(); setTimeout(suivant, 350); };
          box.appendChild(b);
        });
        e.appendChild(box);
      } else if (q.type === 'video') {
        var lab = el('label', 'tf-fichier' + (fichier ? ' rempli' : ''));
        var input = el('input'); input.type = 'file'; input.accept = 'video/*'; input.hidden = true;
        lab.appendChild(input);
        lab.appendChild(el('b', '', fichier ? fichier.name : 'Choisir une vidéo'));
        lab.appendChild(el('span', '', fichier ? Math.max(1, Math.round(fichier.size / 1048576)) + ' Mo' : 'MP4, MOV ou WEBM · ' + D.videoMaxMo + ' Mo maximum'));
        input.onchange = function () {
          var f = input.files[0]; if (!f) return;
          if (f.size > D.videoMaxMo * 1048576) { fichier = null; afficher('Vidéo trop lourde : ' + Math.round(f.size / 1048576) + ' Mo (maximum ' + D.videoMaxMo + ' Mo). Raccourcis-la ou baisse la qualité.'); return; }
          fichier = f; afficher();
        };
        e.appendChild(lab);
      } else {
        champ = q.type === 'texte_long' ? el('textarea', 'tf-champ') : el('input', 'tf-champ');
        if (q.type === 'email') champ.type = 'email';
        if (q.type === 'nombre') { champ.inputMode = 'decimal'; }
        if (q.type === 'discord') { champ.autocapitalize = 'none'; champ.autocomplete = 'off'; champ.spellcheck = false; }
        champ.placeholder = 'Écris ta réponse ici…';
        champ.value = rep[q.id] || '';
        champ.oninput = function () { rep[q.id] = champ.value; if (champ.tagName === 'TEXTAREA') { champ.style.height = 'auto'; champ.style.height = champ.scrollHeight + 'px'; } };
        e.appendChild(champ);
      }
      e.appendChild(el('p', 'tf-erreur', erreur || ''));
      var act = el('div', 'tf-actions');
      var ok = el('button', 'tf-ok', i === Q.length - 1 ? 'Envoyer' : 'OK ✓'); ok.type = 'button'; ok.onclick = suivant; act.appendChild(ok);
      var ind = el('span', 'tf-indice'); ind.innerHTML = 'appuie sur <b>Entrée ↵</b>'; act.appendChild(ind);
      e.appendChild(act);
      zone.appendChild(e);
      if (champ) setTimeout(function () { champ.focus(); }, 50);
    }

    function valide(q) {
      if (q.type === 'video') return !q.obligatoire || fichier;
      return !q.obligatoire || (rep[q.id] && String(rep[q.id]).trim());
    }
    function suivant() {
      if (envoi || i < 0) return;
      if (!valide(Q[i])) { afficher(Q[i].type === 'video' ? 'Choisis ta vidéo pour continuer.' : 'Cette question est obligatoire.'); return; }
      if (i < Q.length - 1) { i++; afficher(); } else envoyer();
    }

    function attente(texte, avecBarre) {
      zone.innerHTML = '';
      var e = el('section', 'tf-ecran');
      e.appendChild(el('h1', 'tf-q', texte));
      if (avecBarre) { var b = el('div', 'tf-barre'); b.appendChild(el('i')); e.appendChild(b); e.appendChild(el('p', 'tf-aide', 'Garde cette page ouverte.')); }
      zone.appendChild(e);
      return e.querySelector('.tf-barre i');
    }
    function terminer() { envoi = false; barre.style.width = '100%'; haut.disabled = bas.disabled = true; zone.innerHTML = ''; zone.appendChild(FIN.content.cloneNode(true)); }
    function echec(d) {
      envoi = false;
      if (d && d.champ) { var k = Q.findIndex(function (q) { return q.id === d.champ; }); if (k >= 0) { i = k; afficher(d.erreur); return; } }
      afficher((d && d.erreur) || 'L\\'envoi a échoué. Vérifie ta connexion et réessaie.');
    }

    function envoyer() {
      envoi = true;
      var reponses = {}; Q.forEach(function (q) { if (q.type !== 'video' && rep[q.id] !== undefined) reponses[q.id] = rep[q.id]; });
      attente('Envoi en cours…');
      var url = D.mode === 'candidature' ? '/api/candidature/formulaire' : '/api/candidature/confirmation';
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reponses: reponses }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) return echec(x.d);
          if (!fichier) return terminer();
          var b = attente('Envoi de ta vidéo…', true);
          var xhr = new XMLHttpRequest(); xhr.open('POST', '/api/candidature/video');
          xhr.setRequestHeader('Content-Type', fichier.type || 'video/mp4');
          xhr.upload.onprogress = function (ev) { if (ev.lengthComputable) b.style.width = Math.round(ev.loaded / ev.total * 100) + '%'; };
          xhr.onload = function () { var d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {} if (xhr.status === 200) terminer(); else echec(d); };
          xhr.onerror = function () { echec(); };
          xhr.send(fichier);
        })
        .catch(function () { echec(); });
    }

    haut.onclick = function () { if (i > 0) { i--; afficher(); } };
    bas.onclick = function () { suivant(); };
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.shiftKey || i < 0 || envoi) return;
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      ev.preventDefault(); suivant();
    });
    afficher();
  })();`;
  return gabarit(titre, `${STYLE_FORMULAIRE}
  <div class="tf-progres"><i></i></div>
  <div id="tf"></div>
  <template id="tf-intro"><section class="tf-ecran">${intro || ''}</section></template>
  <template id="tf-fin"><section class="tf-ecran tf-fin">${fin}</section></template>
  <div class="tf-nav"><button id="tf-haut" type="button" aria-label="Question précédente">▲</button><button id="tf-bas" type="button" aria-label="Question suivante">▼</button></div>
  <noscript><p>Active JavaScript pour remplir le formulaire.</p></noscript>`, { script });
}

module.exports = { pageFormulaire: pageFormulaire, STYLE_FORMULAIRE };
