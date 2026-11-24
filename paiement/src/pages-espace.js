'use strict';

// Pages Elite (candidature), Coaching privé (réservation) et Admin (calendrier).
const { ICONE, echapper, gabarit, formatDate, blocSupport } = require('./pages');

const STYLE_GRILLE = `<style>
  .legende { display:flex; flex-wrap:wrap; gap:10px; font-size:11px; color:var(--doux); margin:0 0 8px; }
  .legende span { display:inline-flex; align-items:center; gap:6px; }
  .legende i { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .tableau { display:grid; grid-template-columns:38px repeat(7, 1fr); gap:3px; margin-bottom:8px; }
  .tableau .tete { text-align:center; font:700 11px var(--police); color:var(--doux); padding-bottom:2px; line-height:1.2; }
  .tableau .tete small { display:block; font-weight:500; font-size:10px; color:var(--gris); }
  .tableau .tete.choisi { color:#ff8a00; }
  .tableau .h { display:flex; flex-direction:column; justify-content:center; font:600 11px/1.1 var(--police); color:var(--doux); }
  .tableau .h small { font-size:9px; font-weight:500; color:var(--gris); }
  .tableau .coupure { grid-column:1 / -1; height:3px; }
  .case { height:24px; border:0; border-radius:7px; padding:0; cursor:pointer; font:700 9px/1 var(--police); overflow:hidden; white-space:nowrap; }
  .case.libre { background:#4a4a4a; }
  .case.pris { background:#1b1b1b; cursor:not-allowed; }
  .case.moi { background:#ff8a00; color:#000; }
  .case.annulee { outline:2px solid var(--erreur); outline-offset:-2px; }
  .case:disabled { cursor:default; }
  .barre-action { padding:4px 0 0; }
  .compteur { text-align:center; font-size:13px; color:var(--doux); }
  .alerte { border:1px solid #5a4a1a; background:#1d1708; color:#f1d38a; border-radius:12px; padding:8px 12px; font-size:12px; margin-bottom:10px; }
  select, textarea { width:100%; padding:12px 14px; border-radius:14px; border:1px solid var(--bord-fort); background:#000; color:#fff; font:15px var(--police); }
  textarea { min-height:80px; resize:vertical; }
  .seance { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1px solid var(--bord); }
  .seance:first-child { border-top:0; }
  .petit-bouton { padding:8px 12px; border-radius:10px; border:1px solid var(--bord-fort); background:transparent; color:#fff; font:600 13px var(--police); cursor:pointer; text-decoration:none; }
  dialog { background:var(--surface); color:#fff; border:1px solid var(--bord-fort); border-radius:20px; padding:20px; width:min(420px, calc(100% - 32px)); }
  dialog::backdrop { background:rgba(0,0,0,.7); }
  .nav-semaine { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  table.membres { width:100%; border-collapse:collapse; font-size:13px; }
  table.membres td, table.membres th { text-align:left; padding:8px 4px; border-top:1px solid var(--bord); }
  table.membres th { color:var(--doux); font-weight:600; }
</style>`;

const LEGENDE = `<div class="legende"><span><i style="background:#ff8a00"></i>Mes créneaux</span><span><i style="background:#1b1b1b;border:1px solid #333"></i>Pris</span><span><i style="background:#4a4a4a"></i>Libre</span></div>`;

function pageConnexionRequise(config, { retour, message }) {
  return gabarit('Connexion', `
  <h1>${echapper(message || 'Connecte-toi avec Discord')}</h1>
  <div class="carte"><p class="doux" style="margin:0">On utilise ton compte Discord pour savoir qui tu es et quel est ton rôle sur le serveur.</p></div>
  <a class="bouton" href="/connexion?retour=${encodeURIComponent(retour)}">Se connecter avec Discord</a>
  ${blocSupport(config)}`);
}

// /coaching/elite : présentation et candidature. Aucun prix affiché.
function pageEliteCandidature(config) {
  const o = config.offres.elite;
  const vsl = o.wistiaVsl
    ? `<div class="video"><iframe src="https://fast.wistia.net/embed/iframe/${echapper(o.wistiaVsl)}?videoFoam=true&playerColor=000000"
        title="Présentation ${echapper(o.nom)}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe></div>` : '';
  const form = o.tallyFormId
    ? `<div class="carte" style="padding:6px"><iframe src="https://tally.so/embed/${echapper(o.tallyFormId)}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
        title="Candidature ${echapper(o.nom)}" style="width:100%;min-height:900px;border:0" loading="lazy"></iframe></div>` : '';
  return gabarit(o.nom, `
  <p class="etiquette">Accompagnement privé</p>
  <h1>${echapper(o.nom)}</h1>
  <p class="doux">L'accompagnement Elite est sur sélection. Regarde la vidéo jusqu'au bout, puis remplis le formulaire.</p>
  ${vsl}
  ${form}
  <p class="doux petit centre">Si ton profil est retenu, nous te recontactons personnellement.</p>`);
}

function pageCoaching(config, { session, grille, seances, coaching, message, interdit }) {
  if (interdit) {
    return gabarit('Coaching privé', `
    <h1>Coaching privé</h1>
    <div class="carte"><p style="margin:0">${echapper(interdit)}</p></div>
    <a class="bouton secondaire" href="/deconnexion">Changer de compte</a>
    ${blocSupport(config)}`);
  }
  const limite = (() => {
    const [h, m] = coaching.creneaux[0].split(':').map(Number);
    const t = h * 60 + m - config.coaching.delaiReservationHeures * 60;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  })();
  const donnees = {
    cases: grille.cases, jours: coaching.JOURS, min: config.coaching.minParSemaine,
  };
  const listeSeances = seances.length
    ? seances.map((s) => `<div class="seance"><div><b>${echapper(coaching.JOURS[(new Date(s.debut).getUTCDay() + 6) % 7])} ${echapper(s.date.slice(8, 10))}/${echapper(s.date.slice(5, 7))}</b> à ${echapper(s.heure)} GMT</div>
        <button class="petit-bouton" type="button" data-annuler="${echapper(s.date)}|${echapper(s.heure)}">Annuler</button></div>`).join('')
    : '<p class="doux" style="margin:0">Aucune séance prévue dans les prochains jours.</p>';
  const script = `
  (function () {
    var D = ${JSON.stringify(donnees)};
    var choix = {};
    D.cases.forEach(function (c) { if (c.etat === 'moi') choix[c.jour] = c.heure; });
    var grille = document.getElementById('grille');
    var decalage = -new Date().getTimezoneOffset();
    function local(h) {
      if (!decalage) return '';
      var p = h.split(':'); var t = (+p[0] * 60 + +p[1] + decalage + 1440) % 1440;
      return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
    }
    var COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    var HEURES = []; D.cases.forEach(function (c) { if (HEURES.indexOf(c.heure) < 0) HEURES.push(c.heure); });
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
    function dessiner() {
      grille.innerHTML = '';
      grille.appendChild(el('div'));
      COURTS.forEach(function (n, j) { grille.appendChild(el('div', 'tete' + (choix[j] !== undefined ? ' choisi' : ''), n)); });
      HEURES.forEach(function (h, i) {
        if (i > 0 && +h.slice(0, 2) - +HEURES[i - 1].slice(0, 2) > 1) grille.appendChild(el('div', 'coupure'));
        var lab = el('div', 'h', h);
        if (local(h)) lab.appendChild(el('small', '', local(h)));
        grille.appendChild(lab);
        for (var j = 0; j < 7; j++) (function (j) {
          var c = D.cases.filter(function (x) { return x.jour === j && x.heure === h; })[0];
          var mien = choix[j] === h;
          var b = el('button', 'case ' + (mien ? 'moi' : c.etat === 'pris' ? 'pris' : 'libre'));
          b.type = 'button';
          b.setAttribute('aria-label', D.jours[j] + ' ' + h + (c.etat === 'pris' ? ' (pris)' : mien ? ' (choisi)' : ''));
          if (c.etat === 'pris') b.disabled = true;
          else b.onclick = function () { if (mien) delete choix[j]; else choix[j] = h; dessiner(); };
          grille.appendChild(b);
        })(j);
      });
      var n = Object.keys(choix).length;
      document.getElementById('compteur').textContent = n + ' créneau(x) choisi(s) · minimum ' + D.min + ' · 1 par jour';
      document.getElementById('enregistrer').disabled = n < D.min;
    }
    dessiner();
    document.getElementById('enregistrer').onclick = function () {
      var sel = Object.keys(choix).map(function (j) { return { jour: +j, heure: choix[j] }; });
      var btn = this; btn.disabled = true; btn.textContent = 'Enregistrement…';
      fetch('/api/coaching/creneaux', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection: sel, rappelMin: +document.getElementById('rappel').value }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.erreur) { alert(d.erreur); btn.disabled = false; btn.textContent = 'Enregistrer mes créneaux'; return; }
          location.href = '/coaching?ok=1';
        });
    };
    var dlg = document.getElementById('dlg-annuler'); var cible = null;
    document.querySelectorAll('[data-annuler]').forEach(function (b) {
      b.onclick = function () { cible = b.getAttribute('data-annuler').split('|'); document.getElementById('dlg-quand').textContent = cible[0] + ' à ' + cible[1] + ' GMT'; dlg.showModal(); };
    });
    document.getElementById('dlg-fermer').onclick = function () { dlg.close(); };
    document.getElementById('dlg-valider').onclick = function () {
      var j = document.getElementById('justif').value;
      fetch('/api/coaching/annuler', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: cible[0], heure: cible[1], justification: j }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.erreur) alert(d.erreur); else location.href = '/coaching?annule=1'; });
    };
  })();`;
  const rappelOptions = coaching.RAPPELS_POSSIBLES.map((m) => `<option value="${m}"${m === grille.rappelMin ? ' selected' : ''}>${m >= 120 ? `${m / 60} h` : '1 h 30'} avant</option>`).join('');
  return gabarit('Coaching privé', `${STYLE_GRILLE}<style>.entete{padding:0 0 12px}.entete .logo{font-size:18px}main{padding-top:14px}</style>
  <h1 style="font-size:19px;margin:0 0 2px">Mes créneaux de coaching</h1>
  <p class="doux petit" style="margin-bottom:8px">${echapper(session.pseudo)} · au moins ${config.coaching.minParSemaine} par semaine, 1 par jour, chaque semaine. Heures GMT.</p>
  ${message ? `<p class="ok petit" style="margin-bottom:8px">${echapper(message)}</p>` : ''}
  <div class="alerte">Réserve avant <b>${limite} GMT</b> pour qu'une séance compte le jour même.</div>
  ${LEGENDE}
  <div id="grille" class="tableau"></div>
  <div class="barre-action">
    <p id="compteur" class="compteur" style="margin:0"></p>
    <button id="enregistrer" class="bouton" type="button" style="margin-top:6px;min-height:46px">Enregistrer mes créneaux</button>
  </div>
  <div class="carte" style="padding:14px 16px;margin-top:14px">
    <label for="rappel" style="margin-top:0">Mon rappel personnalisé</label>
    <select id="rappel">${rappelOptions}</select>
    <p class="doux petit" style="margin:6px 0 0">En plus : rappel automatique 1 h avant chaque séance.</p>
  </div>
  <div class="carte" style="margin-top:18px">
    <h2>Mes prochaines séances</h2>
    ${listeSeances}
    <p class="doux petit" style="margin:10px 0 0">Annulation possible jusqu'à ${config.coaching.annulationMinutes} minutes avant, avec une justification.</p>
  </div>
  <dialog id="dlg-annuler">
    <h2>Annuler la séance du <span id="dlg-quand"></span></h2>
    <label for="justif">Justification (obligatoire)</label>
    <textarea id="justif" maxlength="500" placeholder="Ex. : j'ai un empêchement familial"></textarea>
    <button id="dlg-valider" class="bouton" type="button">Confirmer l'annulation</button>
    <button id="dlg-fermer" class="bouton secondaire" type="button">Garder la séance</button>
  </dialog>
  <a class="bouton secondaire" href="/deconnexion">Se déconnecter</a>`, { script });
}

function pageAdmin(config, { lundi, jours, cases, membres, annulations, coaching }) {
  const script = `
  (function () {
    var dlg = document.getElementById('dlg'); var I = ${JSON.stringify(cases.filter((c) => c.membre).reduce((acc, c) => { acc[c.cle] = c.membre; return acc; }, {}))};
    document.querySelectorAll('[data-cle]').forEach(function (b) {
      b.onclick = function () {
        var m = I[b.getAttribute('data-cle')]; if (!m) return;
        var t = document.getElementById('dlg-corps'); t.innerHTML = '';
        [['Membre', m.nom], ['Discord', m.pseudo], ['Email', m.email], ['Accès jusqu\\'au', m.fin], ['Créneaux', m.creneaux], ['Rappel', m.rappel], ['Séance', b.getAttribute('data-quand')], ['Annulation', m.annulation || '—']]
          .forEach(function (l) { var d = document.createElement('div'); var a = document.createElement('dt'); a.textContent = l[0]; var v = document.createElement('dd'); v.textContent = l[1] || '—'; d.appendChild(a); d.appendChild(v); t.appendChild(d); });
        dlg.showModal();
      };
    });
    document.getElementById('dlg-fermer').onclick = function () { dlg.close(); };
  })();`;
  const heures = coaching.creneaux;
  const grille = `<div class="tableau"><div></div>${jours.map((j) => `<div class="tete">${echapper(j.nom.slice(0, 3))}<small>${echapper(j.date.slice(8, 10))}/${echapper(j.date.slice(5, 7))}</small></div>`).join('')}${
    heures.map((h, i) => `${i > 0 && Number(h.slice(0, 2)) - Number(heures[i - 1].slice(0, 2)) > 1 ? '<div class="coupure"></div>' : ''}<div class="h">${echapper(h)}</div>${
      jours.map((j) => {
        const c = cases.find((x) => x.date === j.date && x.heure === h);
        return `<button type="button" class="case ${c.membre ? 'moi' : 'libre'}${c.annulee ? ' annulee' : ''}"${c.membre
          ? ` data-cle="${echapper(c.cle)}" data-quand="${echapper(j.nom)} ${echapper(c.date)} ${echapper(c.heure)} GMT" aria-label="${echapper(c.membre.court)}"` : ' disabled'}>${c.membre ? echapper(c.membre.court.slice(0, 3)) : ''}</button>`;
      }).join('')}`).join('')}</div>`;
  const lignesMembres = membres.map((m) => `<tr><td>${echapper(m.nom)}<br><span class="doux">${echapper(m.discord_pseudo || '—')}</span></td><td>${echapper(config.offres[m.programme].nom.replace('Overmaxx ', ''))}</td><td>${m.statut === 'actif' ? '' : '<span class="erreur-form">expiré</span><br>'}${echapper(formatDate(m.acces_jusqu_au))}</td></tr>`).join('');
  const lignesAnnul = annulations.length
    ? annulations.map((a) => `<div class="seance"><div><b>${echapper(a.date)} ${echapper(a.heure)}</b> · ${echapper(a.nom)}<br><span class="doux petit">${echapper(a.justification)}</span></div></div>`).join('')
    : '<p class="doux" style="margin:0">Aucune annulation cette semaine.</p>';
  return gabarit('Admin', `${STYLE_GRILLE}
  <p class="etiquette">Admin</p>
  <h1>Calendrier des coachings</h1>
  <div class="nav-semaine">
    <a class="petit-bouton" href="/admin?semaine=${echapper(coaching.ajouterJours(lundi, -7))}">${ICONE.retour.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Précédente</a>
    <span class="doux petit">Semaine du ${echapper(lundi.slice(8, 10))}/${echapper(lundi.slice(5, 7))}</span>
    <a class="petit-bouton" href="/admin?semaine=${echapper(coaching.ajouterJours(lundi, 7))}">Suivante</a>
  </div>
  <div class="legende"><span><i style="background:#ff8a00"></i>Réservé (clique pour voir le profil)</span><span><i style="background:#4a4a4a"></i>Libre</span><span><i style="outline:2px solid var(--erreur)"></i>Annulé</span></div>
  ${grille}
  <div class="carte"><h2>Annulations de la semaine</h2>${lignesAnnul}</div>
  <div class="carte"><h2>Membres mobile money</h2><table class="membres"><tr><th>Membre</th><th>Offre</th><th>Fin d'accès</th></tr>${lignesMembres}</table></div>
  <dialog id="dlg"><h2>Réservation</h2><dl class="details" id="dlg-corps"></dl><button id="dlg-fermer" class="bouton secondaire" type="button">Fermer</button></dialog>
  <a class="bouton secondaire" href="/deconnexion">Se déconnecter</a>`, { script });
}

module.exports = { pageConnexionRequise, pageEliteCandidature, pageCoaching, pageAdmin };
