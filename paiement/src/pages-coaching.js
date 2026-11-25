'use strict';

// Coaching privé (livraison 3) : la page du membre (heure locale, créneaux fixes ou semaine par semaine, annuler ou reporter,
// séances annulées par le coach en rouge, coachings en réserve en vert), et côté coach : le calendrier,
// les disponibilités de la semaine et l'imprévu.
const { ICONE, echapper, blocSupport } = require('./pages');
const { pageEspace } = require('./pages-espace');

const NOMS_TYPES = { fixe: 'Créneau fixe', entree: 'Coaching d\'entrée', semaine: 'Semaine par semaine', report: 'Séance reportée', reserve: 'Coaching en réserve' };
const jsonPage = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

const STYLE_COACHING = `<style>
  .onglets { display:flex; gap:8px; margin:4px 0 14px; }
  .onglets a { flex:1; text-align:center; padding:10px 12px; border-radius:999px; border:1px solid var(--bord-fort); color:#fff; text-decoration:none; font-weight:600; font-size:14px; }
  .onglets a[aria-current="page"] { background:#fff; color:#000; border-color:#fff; }
  .case.absent { background:repeating-linear-gradient(135deg, #1b1b1b 0 5px, #2a2a2a 5px 10px); cursor:not-allowed; }
  .case.passe { background:#101010; cursor:default; }
  .case.touchee, .case.annulee-coach { background:#3a0d0d; outline:2px solid #ff3b3b; outline-offset:-2px; color:#ffb3b3; }
  .case.choisie { background:#ff8a00; color:#000; }
  .case.reserve { background:#1f8f4e; }
  .tableau .h b { color:#fff; font-weight:700; }
  .tableau .h .nuit { color:#8fb3ff; }
  .carte.touchee { border-color:#ff3b3b; background:linear-gradient(#2a0b0b, #160707); }
  .carte.touchee .quand { font-size:17px; font-weight:700; margin:6px 0 2px; }
  .reserves { display:flex; align-items:baseline; gap:8px; }
  .reserves b { font-size:30px; font-weight:800; color:#3ddc84; }
  .ligne-seance { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:11px 0; border-top:1px solid var(--bord); }
  .ligne-seance:first-child { border-top:0; padding-top:0; }
  .ligne-seance .quand { font-weight:700; }
  .ligne-seance .type { display:block; color:var(--doux); font-size:12.5px; margin-top:2px; }
  .choix-libres { display:grid; gap:12px; max-height:46vh; overflow:auto; margin:10px 0; padding-right:4px; }
  .choix-libres .jour { color:var(--doux); font-size:12px; text-transform:uppercase; letter-spacing:.1em; margin:0 0 6px; }
  .choix-libres .puces { display:grid; grid-template-columns:repeat(auto-fill, minmax(84px, 1fr)); gap:6px; }
  .choix-libres button { padding:9px 6px; border-radius:10px; border:1px solid var(--bord-fort); background:#151515; color:#fff; font:600 13px var(--police); cursor:pointer; }
  .choix-libres[data-vert] button { border-color:#1f8f4e; background:#0e2a1a; color:#bff5d4; }
  .choix-libres button[aria-pressed="true"] { background:#fff; color:#000; border-color:#fff; }
  .choix-libres button small { display:block; font-size:10.5px; font-weight:500; opacity:.75; }
  dialog h2 { margin:0 0 8px; font-size:18px; }
  dialog .deux-boutons { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  dialog .deux-boutons .bouton { margin:0; }
  .sem-nav { display:flex; gap:8px; margin-bottom:10px; }
  .sem-nav a { flex:1; text-align:center; padding:8px; border-radius:10px; border:1px solid var(--bord); color:var(--doux); text-decoration:none; font-size:13px; font-weight:600; }
  .sem-nav a[aria-current="page"] { color:#fff; border-color:#fff; }
</style>`;

// Heures et dates à l'heure du membre (fuseau de son téléphone).
const SCRIPT_HEURES = `
var OVX = (function () {
  function d(iso) { return new Date(iso); }
  function heure(iso) { return d(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function jour(iso, o) { var t = d(iso).toLocaleDateString('fr-FR', o || { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); }
  function quand(iso) { return jour(iso) + ' à ' + heure(iso); }
  // Un créneau qui tombe un autre jour chez le membre que le jour UTC de la colonne : « nuit » (ou « veille »).
  function decalage(date, h) {
    var x = d(date + 'T' + h + ':00.000Z');
    var local = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
    return local > date ? 'nuit' : local < date ? 'veille' : '';
  }
  document.querySelectorAll('[data-quand]').forEach(function (el) { el.textContent = quand(el.getAttribute('data-quand')); });
  var o = -new Date().getTimezoneOffset() / 60;
  document.querySelectorAll('[data-fuseau]').forEach(function (el) { el.textContent = 'UTC' + (o >= 0 ? '+' : '') + o; });
  return { heure: heure, jour: jour, quand: quand, decalage: decalage, fuseau: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })() };
})();`;

// ---------- Page du membre ----------
function pageCoaching(config, { session, coaching, mode = 'fixe', grille, semaine, lundis = [], seances = [], touchees = [], reserves = 0, libres = [],
  aDesFixes = false, message, interdit, versParcours, espace = { session } }) {
  if (interdit) {
    return pageEspace('Coaching privé', `
    <h1>Coaching privé</h1>
    <div class="carte"><p style="margin:0">${echapper(interdit)}</p></div>
    ${versParcours ? '<a class="bouton" href="/parcours" style="max-width:340px">Mon parcours</a>'
    : '<a class="bouton secondaire" href="/deconnexion?autre=1" style="max-width:340px">Changer de compte</a>'}
    ${blocSupport(config)}`, espace, 'coaching');
  }
  const min = config.coaching.minParSemaine;
  const max = config.coaching.maxParSemaine || 7;
  const limite = coaching.limiteDuJour('2026-01-05').toISOString().slice(11, 16);
  const donnees = {
    mode, min, max, jours: coaching.JOURS, heures: coaching.creneaux,
    fixe: grille ? grille.cases : [], semaine: semaine || null,
    libres: libres.map((x) => ({ date: x.date, heure: x.heure, debut: x.debut.toISOString() })),
    reserves, rappel: grille ? grille.rappelMin : 240,
  };
  const iso = (o) => echapper(new Date(o.debut).toISOString());
  const blocTouchees = touchees.map((t) => `<div class="carte touchee">
    <div class="envoi-tete"><h2>Séance annulée par ton coach</h2><span class="etat" data-etat="corriger">${t.type === 'imprevu' ? 'Imprévu' : 'Coach absent'}</span></div>
    <p class="quand" data-quand="${iso(t)}">${echapper(t.date)} à ${echapper(t.heure)} GMT</p>
    ${t.message ? `<p style="margin:6px 0">« ${echapper(t.message)} »</p>` : ''}
    <p class="doux petit" style="margin:4px 0 0">${t.credite ? 'Tu as reçu 1 coaching en réserve.' : `Tu as déjà ${coaching.MAX_RESERVES} coachings en réserve (le maximum).`}
      Reprogramme-le maintenant, ou garde-le pour plus tard.</p>
    <div class="deux-boutons" style="margin-top:12px">
      <button class="bouton" type="button" data-reprogrammer="${echapper(t.date)}|${echapper(t.heure)}"${reserves ? '' : ' disabled'}>Reprogrammer</button>
      <button class="bouton secondaire" type="button" data-garder="${echapper(t.date)}|${echapper(t.heure)}">Garder en réserve</button></div></div>`).join('');
  const listeSeances = seances.length
    ? seances.map((s) => `<div class="ligne-seance"><div><span class="quand" data-quand="${iso(s)}">${echapper(s.date)} à ${echapper(s.heure)} GMT</span>
        <span class="type">${echapper(NOMS_TYPES[s.type] || 'Coaching')}${s.touchee ? ' · annulée par ton coach' : ''}</span></div>
        ${s.touchee ? '<span class="etat" data-etat="corriger">Annulée</span>' : `<button class="petit-bouton" type="button" data-modifier="${echapper(s.date)}|${echapper(s.heure)}" data-debut="${iso(s)}">Annuler ou reporter</button>`}</div>`).join('')
    : '<p class="doux" style="margin:0">Aucune séance prévue dans les prochains jours.</p>';

  const grilleFixe = `
      <div class="alerte">Réserve avant <b data-limite="${echapper(limite)}">${echapper(limite)} GMT</b> pour qu'une séance compte le jour même.</div>
      <div class="legende"><span><i style="background:#ff8a00"></i>Mes créneaux</span><span><i style="background:#1b1b1b;border:1px solid #333"></i>Pris</span><span><i style="background:#4a4a4a"></i>Libre</span></div>
      <div id="grille" class="tableau"></div>
      <p id="compteur" class="compteur" style="margin:0"></p>
      <button id="enregistrer" class="bouton" type="button" style="margin-top:6px;min-height:46px">Enregistrer mes créneaux fixes</button>
      <p class="doux petit" style="margin:8px 0 0">Les mêmes chaque semaine : c'est le plus simple, et personne ne te les prend.</p>`;
  const grilleSem = semaine ? `
      <nav class="sem-nav" aria-label="Semaine">${lundis.map((l, i) => `<a href="/coaching?mode=semaine&semaine=${echapper(l)}"${l === semaine.lundi ? ' aria-current="page"' : ''}>${i ? 'Semaine prochaine' : 'Cette semaine'}</a>`).join('')}</nav>
      ${aDesFixes ? `<div class="alerte">Tu as des créneaux fixes. Pour réserver semaine par semaine, retire-les d'abord (tes séances déjà passées ne changent pas).
        <button id="retirer-fixes" class="petit-bouton" type="button" style="margin-top:8px;display:block">Retirer mes créneaux fixes</button></div>` : ''}
      <div class="legende"><span><i style="background:#ff8a00"></i>Mes séances</span><span><i style="background:#1b1b1b;border:1px solid #333"></i>Pris</span><span><i style="background:#4a4a4a"></i>Libre</span>
        <span><i style="background:repeating-linear-gradient(135deg,#1b1b1b 0 3px,#2a2a2a 3px 6px)"></i>Coach absent</span><span><i style="background:#3a0d0d;outline:2px solid #ff3b3b;outline-offset:-2px"></i>Annulée par le coach</span></div>
      <div id="grille-semaine" class="tableau"></div>
      <p id="compteur-semaine" class="compteur" style="margin:0"></p>
      <button id="reserver-semaine" class="bouton" type="button" style="margin-top:6px;min-height:46px"${aDesFixes ? ' disabled' : ''}>Réserver cette semaine</button>
      <p class="doux petit" style="margin:8px 0 0">Une semaine à la fois : à refaire chaque semaine, et d'autres membres peuvent prendre les créneaux avant toi.</p>` : '';

  const script = `${SCRIPT_HEURES}
(function () {
  var D = ${jsonPage(donnees)};
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function envoyer(url, corps, apres) {
    corps.fuseau = OVX.fuseau;
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.erreur) { alert(d.erreur); return null; } if (apres) location.href = apres; return d; })
      .catch(function () { alert('Connexion impossible. Réessaie.'); return null; });
  }
  var COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  // Libellé d'une ligne : l'heure chez le membre, avec « nuit » quand le créneau tombe le lendemain chez lui.
  function libelle(date, h) {
    var lab = el('div', 'h');
    var iso = date + 'T' + h + ':00.000Z';
    lab.appendChild(el('b', '', OVX.heure(iso)));
    var dec = OVX.decalage(date, h);
    if (dec) lab.appendChild(el('small', 'nuit', dec === 'nuit' ? 'nuit' : 'veille'));
    return lab;
  }
  function coupure(g, i) { if (i > 0 && +D.heures[i].slice(0, 2) - +D.heures[i - 1].slice(0, 2) > 1) g.appendChild(el('div', 'coupure')); }
  var ref = new Date(); var refDate = ref.toISOString().slice(0, 10);
  document.querySelectorAll('[data-limite]').forEach(function (b) { b.textContent = OVX.heure(refDate + 'T' + b.getAttribute('data-limite') + ':00.000Z') + ' (ton heure)'; });

  // ----- Créneaux fixes -----
  var grille = document.getElementById('grille');
  if (grille) {
    var choix = {};
    D.fixe.forEach(function (c) { if (c.etat === 'moi') choix[c.jour] = c.heure; });
    var lundi = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - ((ref.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
    var dessiner = function () {
      grille.innerHTML = '';
      grille.appendChild(el('div'));
      COURTS.forEach(function (n, j) { grille.appendChild(el('div', 'tete' + (choix[j] !== undefined ? ' choisi' : ''), n)); });
      D.heures.forEach(function (h, i) {
        coupure(grille, i);
        grille.appendChild(libelle(lundi, h));
        for (var j = 0; j < 7; j++) (function (j) {
          var c = D.fixe.filter(function (x) { return x.jour === j && x.heure === h; })[0];
          var mien = choix[j] === h;
          var b = el('button', 'case ' + (mien ? 'moi' : c.etat === 'pris' ? 'pris' : 'libre'));
          b.type = 'button';
          b.setAttribute('aria-label', D.jours[j] + ' ' + OVX.heure(lundi + 'T' + h + ':00.000Z') + (c.etat === 'pris' ? ' (pris)' : mien ? ' (choisi)' : ''));
          if (c.etat === 'pris') b.disabled = true;
          else b.onclick = function () { if (mien) delete choix[j]; else choix[j] = h; dessiner(); };
          grille.appendChild(b);
        })(j);
      });
      var n = Object.keys(choix).length;
      document.getElementById('compteur').textContent = n + ' créneau(x) choisi(s) · de ' + D.min + ' à ' + D.max + ' · 1 par jour';
      document.getElementById('enregistrer').disabled = n < D.min || n > D.max;
    };
    dessiner();
    document.getElementById('enregistrer').onclick = function () {
      var sel = Object.keys(choix).map(function (j) { return { jour: +j, heure: choix[j] }; });
      var btn = this; btn.disabled = true; btn.textContent = 'Enregistrement…';
      envoyer('/api/coaching/creneaux', { selection: sel, rappelMin: +document.getElementById('rappel').value }, '/coaching?ok=1')
        .then(function (d) { if (!d) { btn.disabled = false; btn.textContent = 'Enregistrer mes créneaux fixes'; } });
    };
  }

  // ----- Semaine par semaine -----
  var gs = document.getElementById('grille-semaine');
  if (gs && D.semaine) {
    var S = D.semaine;
    var dates = []; S.cases.forEach(function (c) { if (dates.indexOf(c.date) < 0) dates.push(c.date); });
    var pris = {};
    S.cases.forEach(function (c) { if (c.etat === 'moi' && c.type === 'semaine') pris[c.date] = c.heure; });
    var dessinerSemaine = function () {
      gs.innerHTML = '';
      gs.appendChild(el('div'));
      dates.forEach(function (dt, j) {
        var t = el('div', 'tete' + (pris[dt] ? ' choisi' : ''), COURTS[j]);
        t.appendChild(el('small', '', dt.slice(8, 10) + '/' + dt.slice(5, 7)));
        gs.appendChild(t);
      });
      D.heures.forEach(function (h, i) {
        coupure(gs, i);
        gs.appendChild(libelle(dates[0], h));
        dates.forEach(function (dt) {
          var c = S.cases.filter(function (x) { return x.date === dt && x.heure === h; })[0];
          var mien = pris[dt] === h;
          var etat = mien ? 'choisie' : c.etat === 'moi' ? 'moi' : c.etat;
          var b = el('button', 'case ' + etat);
          b.type = 'button';
          b.setAttribute('aria-label', OVX.quand(dt + 'T' + h + ':00.000Z') + ' : ' + ({ libre: 'libre', pris: 'pris', absent: 'coach absent', passe: 'passé', touchee: 'annulée par ton coach', moi: 'ta séance', choisie: 'choisi' })[etat]);
          var cliquable = (c.etat === 'libre' || (c.etat === 'moi' && c.modifiable)) && !${aDesFixes ? 'true' : 'false'};
          if (!cliquable) b.disabled = true;
          else b.onclick = function () { if (mien) delete pris[dt]; else pris[dt] = h; dessinerSemaine(); };
          gs.appendChild(b);
        });
      });
      var n = Object.keys(pris).length;
      document.getElementById('compteur-semaine').textContent = n + ' séance(s) cette semaine · de ' + D.min + ' à ' + D.max + ' · 1 par jour';
    };
    dessinerSemaine();
    var rs = document.getElementById('reserver-semaine');
    rs.onclick = function () {
      var sel = Object.keys(pris).filter(function (dt) {
        var c = S.cases.filter(function (x) { return x.date === dt && x.heure === pris[dt]; })[0];
        return c && (c.etat === 'libre' || c.modifiable || c.etat === 'moi');
      }).map(function (dt) { return { date: dt, heure: pris[dt] }; });
      rs.disabled = true; rs.textContent = 'Réservation…';
      envoyer('/api/coaching/semaine', { lundi: S.lundi, selection: sel, rappelMin: +document.getElementById('rappel').value }, '/coaching?mode=semaine&semaine=' + S.lundi + '&ok=semaine')
        .then(function (d) { if (!d) { rs.disabled = false; rs.textContent = 'Réserver cette semaine'; } });
    };
    var rf = document.getElementById('retirer-fixes');
    if (rf) rf.onclick = function () {
      if (!confirm('Retirer tous tes créneaux fixes ? Tu réserveras ensuite semaine par semaine.')) return;
      envoyer('/api/coaching/retirer-fixes', {}, '/coaching?mode=semaine&semaine=' + S.lundi);
    };
  }

  // ----- Choisir un créneau libre (report, réserve, reprogrammation) -----
  var dlgC = document.getElementById('dlg-choisir'), zone = document.getElementById('choix-libres'), choisi = null, action = null;
  function ouvrirChoix(titre, texte, vert, bouton, quandChoisi) {
    document.getElementById('choix-titre').textContent = titre;
    document.getElementById('choix-texte').textContent = texte;
    var ok = document.getElementById('choix-ok');
    ok.textContent = bouton; ok.disabled = true; choisi = null; action = quandChoisi;
    zone.innerHTML = '';
    if (vert) zone.setAttribute('data-vert', ''); else zone.removeAttribute('data-vert');
    var parJour = {};
    D.libres.forEach(function (x) { var k = OVX.jour(x.debut); (parJour[k] = parJour[k] || []).push(x); });
    var cles = Object.keys(parJour);
    if (!cles.length) zone.appendChild(el('p', 'doux', 'Aucun créneau libre dans les 14 prochains jours.'));
    cles.forEach(function (k) {
      var bloc = el('div'); bloc.appendChild(el('p', 'jour', k));
      var puces = el('div', 'puces');
      parJour[k].forEach(function (x) {
        var b = el('button', '', OVX.heure(x.debut)); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
        b.onclick = function () { zone.querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); choisi = x; ok.disabled = false; };
        puces.appendChild(b);
      });
      bloc.appendChild(puces); zone.appendChild(bloc);
    });
    dlgC.showModal();
  }
  document.getElementById('choix-fermer').onclick = function () { dlgC.close(); };
  document.getElementById('choix-ok').onclick = function () { if (choisi && action) { this.disabled = true; action(choisi); } };

  var ur = document.getElementById('utiliser-reserve');
  if (ur) ur.onclick = function () {
    ouvrirChoix('Utiliser un coaching en réserve', 'En vert : les créneaux libres des 14 prochains jours, à ton heure. Il s\\'ajoute à tes coachings habituels.', true, 'Réserver ce coaching',
      function (x) { envoyer('/api/coaching/reserve', { date: x.date, heure: x.heure }, '/coaching?ok=reserve'); });
  };
  document.querySelectorAll('[data-reprogrammer]').forEach(function (b) {
    b.onclick = function () {
      var t = b.getAttribute('data-reprogrammer').split('|');
      ouvrirChoix('Reprogrammer ta séance', 'Choisis un nouveau créneau, à ton heure. Il utilise le coaching en réserve que ton coach t\\'a donné.', true, 'Reprogrammer ici',
        function (x) { envoyer('/api/coaching/touchee', { date: t[0], heure: t[1], choix: 'reprogrammer', nouvelle: { date: x.date, heure: x.heure } }, '/coaching?ok=reprogramme'); });
    };
  });
  document.querySelectorAll('[data-garder]').forEach(function (b) {
    b.onclick = function () { var t = b.getAttribute('data-garder').split('|'); envoyer('/api/coaching/touchee', { date: t[0], heure: t[1], choix: 'reserve' }, '/coaching?ok=garde'); };
  });

  // ----- Annuler ou reporter une séance -----
  var dlgM = document.getElementById('dlg-modifier'), cible = null;
  document.querySelectorAll('[data-modifier]').forEach(function (b) {
    b.onclick = function () {
      cible = b.getAttribute('data-modifier').split('|');
      document.getElementById('modifier-quand').textContent = OVX.quand(b.getAttribute('data-debut'));
      document.getElementById('justif').value = '';
      dlgM.showModal();
    };
  });
  function justification() {
    var j = document.getElementById('justif').value.trim();
    if (j.length < 5) { alert('Explique en quelques mots pourquoi (obligatoire).'); return null; }
    return j;
  }
  document.getElementById('modifier-fermer').onclick = function () { dlgM.close(); };
  document.getElementById('modifier-annuler').onclick = function () {
    var j = justification(); if (!j) return;
    envoyer('/api/coaching/annuler', { date: cible[0], heure: cible[1], justification: j }, '/coaching?annule=1');
  };
  document.getElementById('modifier-reporter').onclick = function () {
    var j = justification(); if (!j) return;
    dlgM.close();
    ouvrirChoix('Reporter ta séance', 'Choisis le nouveau créneau, à ton heure.', false, 'Reporter ici',
      function (x) { envoyer('/api/coaching/reporter', { date: cible[0], heure: cible[1], justification: j, nouvelle: { date: x.date, heure: x.heure } }, '/coaching?ok=report'); });
  };

  var rap = document.getElementById('rappel');
  if (rap) rap.onchange = function () { envoyer('/api/coaching/rappel', { rappelMin: +rap.value }); };
  // Le fuseau du téléphone, pour que Bob écrive les heures à l'heure du membre.
  if (OVX.fuseau && !sessionStorage.getItem('ovx-fuseau')) { try { sessionStorage.setItem('ovx-fuseau', '1'); } catch (e) {} envoyer('/api/coaching/fuseau', {}); }
})();`;

  const rappelOptions = coaching.RAPPELS_POSSIBLES.map((m) => `<option value="${m}"${m === donnees.rappel ? ' selected' : ''}>${m >= 120 ? `${m / 60} h` : '1 h 30'} avant</option>`).join('');
  return pageEspace('Mes coachings', `${STYLE_COACHING}
  <h1 style="font-size:21px;margin:0 0 2px">Mes coachings</h1>
  <p class="doux petit" style="margin-bottom:10px">${echapper(session.pseudo || '')} · ${min} à ${max} par semaine, 1 par jour · heures à ton heure (<span data-fuseau>GMT</span>)</p>
  ${message ? `<p class="ok petit" style="margin-bottom:10px">${echapper(message)}</p>` : ''}
  ${blocTouchees}
  <div class="colonnes">
    <div>
      <nav class="onglets" aria-label="Façon de réserver"><a href="/coaching"${mode === 'fixe' ? ' aria-current="page"' : ''}>Créneaux fixes</a><a href="/coaching?mode=semaine"${mode === 'semaine' ? ' aria-current="page"' : ''}>Semaine par semaine</a></nav>
      ${mode === 'semaine' ? grilleSem : grilleFixe}
    </div>
    <div class="cote">
      <div class="carte" style="margin-top:14px">
        <div class="envoi-tete"><h2>Coachings en réserve</h2><span class="reserves"><b>${reserves}</b><span class="doux petit">/ ${coaching.MAX_RESERVES}</span></span></div>
        <p class="doux petit" style="margin:6px 0 0">Tu en reçois un chaque fois que ton coach annule une séance. Utilise-le quand tu veux, en plus de tes coachings habituels.</p>
        <button id="utiliser-reserve" class="bouton${reserves ? '' : ' secondaire'}" type="button"${reserves ? '' : ' disabled'}>Utiliser une réserve</button>
      </div>
      <div class="carte">
        <h2>Mes prochaines séances</h2>
        ${listeSeances}
        <p class="doux petit" style="margin:10px 0 0">Annuler ou reporter : jusqu'à ${config.coaching.annulationMinutes} minutes avant, avec une justification.</p>
      </div>
      <div class="carte" style="padding:14px 16px">
        <label for="rappel" style="margin-top:0">Mon rappel personnalisé</label>
        <select id="rappel">${rappelOptions}</select>
        <p class="doux petit" style="margin:6px 0 0">En plus : rappel automatique 1 h avant chaque séance.</p>
      </div>
    </div>
  </div>
  <dialog id="dlg-modifier">
    <h2>Annuler ou reporter</h2>
    <p class="doux" style="margin:0 0 10px">Séance du <b id="modifier-quand"></b></p>
    <label for="justif">Pourquoi ? (obligatoire)</label>
    <textarea id="justif" maxlength="500" placeholder="Ex. : j'ai un empêchement familial"></textarea>
    <div class="deux-boutons"><button id="modifier-annuler" class="bouton secondaire" type="button">Annuler la séance</button><button id="modifier-reporter" class="bouton" type="button">Reporter…</button></div>
    <button id="modifier-fermer" class="bouton secondaire" type="button" style="margin-top:8px">Garder la séance</button>
  </dialog>
  <dialog id="dlg-choisir">
    <h2 id="choix-titre"></h2>
    <p id="choix-texte" class="doux petit" style="margin:0"></p>
    <div id="choix-libres" class="choix-libres"></div>
    <div class="deux-boutons"><button id="choix-fermer" class="bouton secondaire" type="button">Fermer</button><button id="choix-ok" class="bouton" type="button" disabled>Choisir</button></div>
  </dialog>`, espace, 'coaching', { script });
}

// ---------- Coach : calendrier de la semaine ----------
function pageAdmin(config, { lundi, jours, cases, annulations, touchees = [], dispoProchaine, lundiProchain, aujourdhui, coaching, espace, message }) {
  const membres = {};
  for (const c of cases) if (c.membre) membres[c.cle] = c.membre;
  const script = `
  (function () {
    var dlg = document.getElementById('dlg'); var I = ${jsonPage(membres)};
    document.querySelectorAll('[data-cle]').forEach(function (b) {
      b.onclick = function () {
        var m = I[b.getAttribute('data-cle')]; if (!m) return;
        var t = document.getElementById('dlg-corps'); t.innerHTML = '';
        [['Membre', m.nom], ['Discord', m.pseudo], ['Email', m.email], ['Séance', b.getAttribute('data-quand')], ['Type', m.type], ['Créneaux fixes', m.creneaux], ['Rappel', m.rappel], ['Son heure', m.fuseau], ['État', m.etat]]
          .forEach(function (l) { var d = document.createElement('div'); var a = document.createElement('dt'); a.textContent = l[0]; var v = document.createElement('dd'); v.textContent = l[1] || '—'; d.appendChild(a); d.appendChild(v); t.appendChild(d); });
        var f = document.getElementById('dlg-fiche'); f.hidden = !m.fiche; if (m.fiche) f.href = m.fiche;
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
        const classe = c.membre ? (c.touchee ? 'touchee' : 'moi') : c.absence ? 'absent' : 'libre';
        return `<button type="button" class="case ${classe}"${c.membre
          ? ` data-cle="${echapper(c.cle)}" data-quand="${echapper(j.nom)} ${echapper(c.date)} ${echapper(c.heure)} GMT" aria-label="${echapper(c.membre.court)}"`
          : ` disabled aria-label="${c.absence ? (c.absence.type === 'imprevu' ? 'Imprévu' : 'Absent') : 'Libre'}"`}>${c.membre ? `<span class="c-court">${echapper(c.membre.court.slice(0, 3))}</span><span class="c-long">${echapper(c.membre.court)}</span>` : ''}</button>`;
      }).join('')}`).join('')}</div>`;
  const lignesAnnul = annulations.length
    ? annulations.map((a) => `<div class="seance"><div><b>${echapper(a.date)} ${echapper(a.heure)}</b> · ${echapper(a.nom)}<br><span class="doux petit">${echapper(a.justification)}</span></div></div>`).join('')
    : '<p class="doux" style="margin:0">Aucune annulation cette semaine.</p>';
  const lignesTouchees = touchees.length
    ? touchees.map((t) => `<div class="seance"><div><b>${echapper(t.date)} ${echapper(t.heure)}</b> · ${echapper(t.nom)}<br><span class="doux petit">${t.type === 'imprevu' ? 'Imprévu' : 'Absence'} · ${t.choix === 'reprogramme' ? 'reprogrammée' : t.choix === 'reserve' ? 'gardée en réserve' : 'choix du membre en attente'}</span></div></div>`).join('')
    : '<p class="doux" style="margin:0">Aucune séance annulée de ton côté.</p>';
  return pageEspace('Calendrier', `${STYLE_COACHING}
  <div class="titre-page">
    <div><p class="etiquette">Gestion</p><h1>Calendrier des coachings</h1></div>
    <div class="nav-semaine" style="margin:0;gap:8px">
      <a class="petit-bouton" href="/admin?semaine=${echapper(coaching.ajouterJours(lundi, -7))}">${ICONE.retour.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Précédente</a>
      <span class="doux petit">Semaine du ${echapper(lundi.slice(8, 10))}/${echapper(lundi.slice(5, 7))}</span>
      <a class="petit-bouton" href="/admin?semaine=${echapper(coaching.ajouterJours(lundi, 7))}">Suivante</a>
    </div>
  </div>
  ${message ? `<p class="message-ok" style="color:var(--ok);font-weight:600">${echapper(message)}</p>` : ''}
  <div class="colonnes">
    <div>
      <div class="legende"><span><i style="background:#ff8a00"></i>Réservé (touche pour voir)</span><span><i style="background:#4a4a4a"></i>Libre</span>
        <span><i style="background:repeating-linear-gradient(135deg,#1b1b1b 0 3px,#2a2a2a 3px 6px)"></i>Tu es absent</span><span><i style="background:#3a0d0d;outline:2px solid #ff3b3b;outline-offset:-2px"></i>Séance annulée par toi</span></div>
      ${grille}
      <p class="doux petit">Heures GMT (UTC). Chaque membre voit les siennes à son heure.</p>
    </div>
    <div class="cote">
      <div class="carte">
        <h2>Tes disponibilités</h2>
        <p class="doux petit" style="margin:0 0 10px">Semaine du ${echapper(lundiProchain.slice(8, 10))}/${echapper(lundiProchain.slice(5, 7))} : ${dispoProchaine ? 'envoyées' : 'pas encore envoyées (tout est disponible par défaut)'}.</p>
        <a class="bouton" href="/admin/disponibilites?semaine=${echapper(lundiProchain)}" style="margin-top:0">Sélectionner mes disponibilités</a>
        <a class="bouton secondaire" href="/admin/disponibilites?semaine=${echapper(lundi)}">Cette semaine</a>
        <a class="bouton secondaire" href="/admin/imprevu?date=${echapper(aujourdhui)}" style="border-color:var(--erreur);color:var(--erreur)">J'ai un imprévu aujourd'hui</a>
      </div>
      <div class="carte"><h2>Séances que tu as annulées</h2>${lignesTouchees}</div>
      <div class="carte"><h2>Annulations des membres</h2>${lignesAnnul}</div>
    </div>
  </div>
  <dialog id="dlg"><h2>Réservation</h2><dl class="details" id="dlg-corps"></dl>
    <a id="dlg-fiche" class="bouton" href="#" hidden>Voir sa fiche</a>
    <button id="dlg-fermer" class="bouton secondaire" type="button">Fermer</button></dialog>`, espace, 'calendrier', { script });
}

// ---------- Coach : disponibilités de la semaine ----------
function pageDisponibilites(config, { espace, coaching, lundi, absences, seances, envoye, maintenant = new Date(), nomDe = (id) => id }) {
  const jours = Array.from({ length: 7 }, (_, i) => coaching.ajouterJours(lundi, i));
  const absent = new Set(absences.map((a) => `${a.date} ${a.heure}`));
  const imprevu = new Set(absences.filter((a) => a.type === 'imprevu').map((a) => `${a.date} ${a.heure}`));
  const seance = new Map(seances.map((s) => [`${s.date} ${s.heure}`, s]));
  const heures = coaching.creneaux;
  const script = `
  (function () {
    document.querySelectorAll('[data-jour]').forEach(function (b) {
      b.onclick = function () {
        var cases = document.querySelectorAll('input[data-date="' + b.getAttribute('data-jour') + '"]:not(:disabled)');
        var tout = Array.prototype.every.call(cases, function (c) { return c.checked; });
        cases.forEach(function (c) { c.checked = !tout; });
        compter();
      };
    });
    function compter() {
      var n = document.querySelectorAll('input[name=dispo]:not(:disabled):not(:checked)').length;
      document.getElementById('nb-absences').textContent = n ? n + ' créneau(x) d\\'absence' : 'Disponible partout';
    }
    document.querySelectorAll('input[name=dispo]').forEach(function (c) { c.onchange = compter; });
    compter();
  })();`;
  const cellule = (date, h) => {
    const k = `${date} ${h}`;
    const passe = new Date(`${date}T${h}:00.000Z`) <= maintenant;
    const s = seance.get(k);
    return `<label class="dispo${passe ? ' passe' : ''}" title="${echapper(date)} ${echapper(h)} GMT">
      <input type="checkbox" name="dispo" value="${echapper(date)}|${echapper(h)}" data-date="${echapper(date)}"${absent.has(k) ? '' : ' checked'}${passe || imprevu.has(k) ? ' disabled' : ''}>
      <span>${s ? echapper(String(nomDe(s.discordId)).slice(0, 8)) : ''}</span></label>`;
  };
  return pageEspace('Mes disponibilités', `${STYLE_COACHING}<style>
    .dispos { display:grid; grid-template-columns:44px repeat(7, 1fr); gap:4px; }
    .dispos .tete { text-align:center; font:700 11px var(--police); color:var(--doux); }
    .dispos .tete button { width:100%; background:none; border:0; color:#fff; font:700 12px var(--police); cursor:pointer; padding:4px 0; }
    .dispos .tete small { display:block; color:var(--gris); font-weight:500; }
    .dispos .h { font:600 11px var(--police); color:var(--doux); display:flex; align-items:center; }
    .dispo { position:relative; display:block; height:34px; margin:0; cursor:pointer; }
    .dispo input { position:absolute; opacity:0; inset:0; margin:0; cursor:pointer; }
    .dispo span { display:grid; place-items:center; height:100%; border-radius:8px; font:700 10px var(--police); overflow:hidden;
      background:repeating-linear-gradient(135deg, #2a0f0f 0 5px, #3a1414 5px 10px); color:#ffb3b3; border:1px solid #5a1f1f; }
    .dispo input:checked + span { background:#1f8f4e; border-color:#1f8f4e; color:#fff; }
    .dispo.passe { opacity:.35; cursor:default; }
    .dispo input:focus-visible + span { outline:2px solid #fff; outline-offset:2px; }
    @media (min-width: 960px) { .dispos { grid-template-columns:60px repeat(7, 1fr); gap:6px; } .dispo { height:42px; } .dispo span { font-size:11.5px; } }
  </style>
  <p class="doux petit"><a href="/admin?semaine=${echapper(lundi)}">← Calendrier</a></p>
  <div class="titre-page"><div><p class="etiquette">Coaching</p><h1>Mes disponibilités</h1></div>
    <span class="doux petit">Semaine du ${echapper(lundi.slice(8, 10))}/${echapper(lundi.slice(5, 7))}${envoye ? ' · envoyées' : ''}</span></div>
  <div class="carte"><p style="margin:0">Tout est coché (en vert) par défaut. <b>Décoche tes absences</b> : un créneau, ou un jour entier en touchant son nom.
    Les membres qui ont une séance à une heure où tu es absent sont prévenus par Bob ; la séance ne compte pas dans leur minimum,
    et ils reçoivent un coaching en réserve.</p></div>
  <form method="post" action="/admin/disponibilites">
    <input type="hidden" name="semaine" value="${echapper(lundi)}">
    <div class="dispos">
      <div></div>${jours.map((d, i) => `<div class="tete"><button type="button" data-jour="${echapper(d)}">${echapper(coaching.JOURS[i].slice(0, 3))}<small>${echapper(d.slice(8, 10))}/${echapper(d.slice(5, 7))}</small></button></div>`).join('')}
      ${heures.map((h) => `<div class="h">${echapper(h)}</div>${jours.map((d) => cellule(d, h)).join('')}`).join('')}
    </div>
    <p class="doux petit" style="margin:10px 0 0">Heures GMT. Un nom = un membre a une séance à ce moment-là. <b id="nb-absences"></b></p>
    <button class="bouton" type="submit">Enregistrer mes disponibilités</button>
  </form>`, espace, 'calendrier', { script });
}

// ---------- Coach : imprévu ----------
function pageImprevu(config, { espace, date, seances, nomDe = (id) => id, erreur }) {
  const aVenir = seances.filter((s) => !s.touchee);
  return pageEspace('Imprévu', `${STYLE_COACHING}
  <p class="doux petit"><a href="/admin">← Calendrier</a></p>
  <div class="titre-page"><div><p class="etiquette">Coaching · ${echapper(date)}</p><h1>J'ai un imprévu</h1></div></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${aVenir.length ? `<form class="carte" method="post" action="/admin/imprevu" style="display:grid;gap:12px">
    <input type="hidden" name="date" value="${echapper(date)}">
    <p style="margin:0">Choisis les séances que tu ne peux pas assurer. Bob envoie ton message en privé à chaque membre concerné ;
      chacun reçoit un coaching en réserve et voit sa séance en rouge, avec <b>Reprogrammer</b> ou <b>Garder en réserve</b>.</p>
    <div style="display:grid;gap:8px">${aVenir.map((s) => `<label style="display:flex;gap:10px;align-items:center;margin:0;font-weight:600">
      <input type="checkbox" name="heure" value="${echapper(s.heure)}" checked style="width:20px;height:20px;margin:0">
      ${echapper(s.heure)} GMT · ${echapper(nomDe(s.discordId))}</label>`).join('')}</div>
    <div class="champ"><label for="message">Ton message aux membres</label>
      <textarea id="message" name="message" required placeholder="Ex. : Désolé, j'ai une urgence familiale. On se rattrape très vite !"></textarea></div>
    <button class="bouton" type="submit" style="margin-top:0">Prévenir les membres</button></form>`
    : '<div class="carte"><p style="margin:0">Aucune séance à venir ce jour-là.</p></div>'}
  `, espace, 'calendrier');
}

module.exports = { pageCoaching, pageAdmin, pageDisponibilites, pageImprevu, NOMS_TYPES };
