'use strict';

// Page « Notifications » : installer l'application Overmaxx sur son téléphone, puis choisir où recevoir ses messages
// (Bob sur Discord, ou l'application). Les rappels de paiement passent toujours par les deux.
// Les outils communs (installer, activer les notifications) servent aussi à l'accueil des nouveaux membres.
const { echapper, formatDate, fenetreTutoBob } = require('./pages');
const { pageEspace } = require('./pages-espace');

const STYLE_NOTIF = `<style>
  .option { display:flex; gap:12px; align-items:flex-start; padding:14px; border:1px solid var(--bord-fort); border-radius:14px; cursor:pointer; margin:0 0 10px; }
  .option input { width:20px; height:20px; margin:2px 0 0; flex:none; accent-color:#fff; }
  .option b { display:block; font-size:15px; }
  .option span { display:block; color:var(--doux); font-size:13px; margin-top:2px; font-weight:400; }
  .option:has(input:checked) { border-color:#fff; background:#111; }
  .etapes { margin:10px 0 0; padding-left:20px; display:grid; gap:8px; }
  .etapes li { padding-left:4px; }
  .etapes svg { width:18px; height:18px; vertical-align:-3px; stroke:#fff; fill:none; stroke-width:1.8; }
  .app-ok { display:flex; align-items:center; gap:10px; color:var(--ok); font-weight:600; }
  .appareil { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1px solid var(--bord); }
  .appareil:first-child { border-top:0; padding-top:0; }
  .statut { margin:6px 0 0; font-size:13.5px; }
  .statut[data-ton="erreur"] { color:var(--erreur); } .statut[data-ton="ok"] { color:var(--ok); }
</style>`;

const PARTAGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const AJOUTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';

// Installer l'application : bouton (Android), étapes (iPhone), ou « déjà installée ».
const blocInstallation = () => `
  <p data-app-installee class="app-ok" hidden>✓ L'application est installée sur cet appareil.</p>
  <div data-app-android hidden>
    <button data-installer class="bouton" type="button" hidden>Installer l'application</button>
    <p data-installer-aide class="doux petit" style="margin:0">Dans le menu de ton navigateur (⋮), touche <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>.</p>
  </div>
  <div data-app-iphone hidden>
    <p style="margin:0">Sur iPhone (iOS 16.4 ou plus récent), depuis <b>Safari</b> :</p>
    <ol class="etapes">
      <li>Touche ${PARTAGER} <b>Partager</b>, en bas de l'écran.</li>
      <li>Touche ${AJOUTER} <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li>
      <li>Ouvre <b>Overmaxx</b> depuis ton écran d'accueil : la suite se fera dans l'application.</li>
    </ol>
    <p class="doux petit" style="margin:10px 0 0">Sur iPhone, les notifications ne marchent que dans l'application installée.</p>
  </div>`;

// Outils communs : détecter l'appareil, installer l'application, activer les notifications (abonnement web-push).
const SCRIPT_OUTILS_APP = `
var OVXApp = (function () {
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var installee = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var supporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function poster(url, corps) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.erreur) throw new Error(d.erreur || 'Erreur'); return d; }); });
  }
  function cleVapid(b) {
    var p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function appareil() {
    var u = navigator.userAgent;
    var os = /Android/.test(u) ? 'Android' : ios ? 'iPhone' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : 'Ordinateur';
    var nav = /Edg\\//.test(u) ? 'Edge' : /Firefox/.test(u) ? 'Firefox' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'navigateur';
    return os + ' · ' + (installee ? 'application' : nav);
  }
  // Abonne cet appareil aux notifications, puis choisit l'application comme canal.
  function activer(cle) {
    if (!supporte) return Promise.reject(new Error(ios && !installee ? 'Sur iPhone, installe d\\'abord l\\'application, ouvre-la, puis active les notifications.' : 'Ce navigateur ne gère pas les notifications.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('Notifications refusées. Autorise-les pour Overmaxx dans les réglages de ton téléphone.');
      return navigator.serviceWorker.register('/sw.js');
    }).then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid(cle) }); }); })
      .then(function (s) { return poster('/api/notifications/abonnement', { abonnement: s.toJSON(), appareil: appareil() }); })
      .then(function () { return poster('/api/notifications/canal', { canal: 'app' }); });
  }
  // Bloc « Installer l'application » : affiche la bonne version selon l'appareil.
  var invite = null;
  function montrerInstallation() {
    var q = function (s) { return document.querySelector(s); };
    if (!q('[data-app-installee]')) return;
    if (installee) q('[data-app-installee]').hidden = false;
    else if (ios) q('[data-app-iphone]').hidden = false;
    else q('[data-app-android]').hidden = false;
    var b = q('[data-installer]');
    if (invite && b) { b.hidden = false; q('[data-installer-aide]').hidden = true; }
    if (b) b.onclick = function () { if (!invite) return; invite.prompt(); invite.userChoice.then(function () { invite = null; b.hidden = true; }); };
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); invite = e; montrerInstallation(); });
  window.addEventListener('appinstalled', function () { installee = true; var a = document.querySelector('[data-app-android]'); if (a) a.hidden = true; var o = document.querySelector('[data-app-installee]'); if (o) o.hidden = false; });
  return { ios: ios, installee: installee, supporte: supporte, poster: poster, activer: activer, montrerInstallation: montrerInstallation };
})();`;

function pageNotifications(config, { espace, clePublique, canal, appareils = [], message }) {
  const script = `${SCRIPT_OUTILS_APP}
(function () {
  var D = ${JSON.stringify({ cle: clePublique, canal }).replace(/</g, '\\u003c')};
  function q(s) { return document.querySelector(s); }
  function statut(t, ton) { var e = q('#statut'); e.textContent = t; e.setAttribute('data-ton', ton || ''); }
  OVXApp.montrerInstallation();
  document.querySelectorAll('input[name=canal]').forEach(function (r) {
    r.onchange = function () {
      if (r.value === 'bob') {
        OVXApp.poster('/api/notifications/canal', { canal: 'bob' }).then(function () { statut('C\\'est noté : Bob t\\'écrit sur Discord.', 'ok'); }).catch(function (e) { statut(e.message, 'erreur'); });
        return;
      }
      statut('Activation des notifications…');
      OVXApp.activer(D.cle)
        .then(function () { statut('C\\'est activé : tes notifications arrivent dans l\\'application.', 'ok'); setTimeout(function () { location.reload(); }, 1200); })
        .catch(function (e) { q('input[value=bob]').checked = true; statut(e.message, 'erreur'); });
    };
  });
  q('#tester').onclick = function () {
    var b = this; b.disabled = true;
    (D.canal === 'app' || !OVXApp.supporte ? Promise.resolve() : OVXApp.activer(D.cle))
      .then(function () { return OVXApp.poster('/api/notifications/test'); })
      .then(function (d) { statut(d.appareils ? 'Notification envoyée sur ' + d.appareils + ' appareil(s).' : 'Aucun appareil : active d\\'abord les notifications.', d.appareils ? 'ok' : 'erreur'); })
      .catch(function (e) { statut(e.message, 'erreur'); })
      .then(function () { b.disabled = false; });
  };
  // Cet appareil est-il déjà abonné ? (bouton « Retirer »)
  if (OVXApp.supporte) navigator.serviceWorker.getRegistration('/').then(function (reg) { return reg && reg.pushManager.getSubscription(); }).then(function (s) {
    if (!s) return;
    document.querySelectorAll('[data-endpoint]').forEach(function (l) {
      if (l.getAttribute('data-endpoint') !== s.endpoint) return;
      l.querySelector('.ce').hidden = false;
      var b = l.querySelector('button'); b.hidden = false;
      b.onclick = function () { s.unsubscribe().then(function () { return OVXApp.poster('/api/notifications/desabonnement', { endpoint: s.endpoint }); }).then(function () { location.reload(); }); };
    });
  }).catch(function () {});
})();`;
  return pageEspace('Notifications', `${STYLE_NOTIF}
  <div class="titre-page"><div><p class="etiquette">Mon compte</p><h1>Notifications</h1></div></div>
  ${message ? `<p class="message-ok" style="color:var(--ok);font-weight:600">${echapper(message)}</p>` : ''}
  <div class="colonnes">
    <div>
      <div class="carte">
        <h2>L'application Overmaxx</h2>
        <p class="doux" style="margin:0 0 10px">Sur l'écran d'accueil de ton téléphone, avec l'icône Overmaxx : elle s'ouvre comme une vraie application, déjà connectée, sans passer par un store.</p>
        ${blocInstallation()}
      </div>
      <div class="carte">
        <h2>Où recevoir mes notifications ?</h2>
        <label class="option"><input type="radio" name="canal" value="bob"${canal === 'bob' ? ' checked' : ''}><div><b>Bob, sur Discord</b>
          <span>En message privé (ou dans ton fil Bob).</span></div></label>
        <label class="option"><input type="radio" name="canal" value="app"${canal === 'app' ? ' checked' : ''}><div><b>L'application Overmaxx</b>
          <span>Sur ton téléphone, même quand Discord est fermé. Si aucun de tes appareils ne répond, Bob prend le relais.</span></div></label>
        <p id="statut" class="statut" aria-live="polite"></p>
        <button id="tester" class="bouton secondaire" type="button">Envoyer une notification de test</button>
        <p class="doux petit" style="margin:10px 0 0"><b>Rappels de paiement</b> : toujours par Bob, puis dans l'application 10 minutes plus tard si tu n'as pas encore payé.</p>
        <p class="doux petit" style="margin:6px 0 0">Bob ne t'écrit pas ? <a href="#" data-tuto-bob>Vérifie ce réglage dans Discord</a>.</p>
      </div>
    </div>
    <div class="cote">
      <div class="carte">
        <h2>Mes appareils</h2>
        ${appareils.length ? appareils.map((a) => `<div class="appareil" data-endpoint="${echapper(a.endpoint)}"><div><b>${echapper(a.appareil || 'Appareil')}</b>
          <span class="ce doux petit" hidden> · cet appareil</span><br><span class="doux petit">depuis le ${echapper(formatDate(a.cree_le))}</span></div>
          <button class="petit-bouton" type="button" hidden>Retirer</button></div>`).join('')
    : '<p class="doux" style="margin:0">Aucun appareil pour l\'instant.</p>'}
      </div>
    </div>
  </div>
  ${fenetreTutoBob(config, { rejoindre: false })}`, espace, 'notifications', { script });
}

// ---------- Espace notifications du coach : deux onglets, Notifications et Mes rappels ----------
const STYLE_ADMIN_NOTIF = `<style>
  .onglets-admin { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:999px; background:var(--surface-2, #151515); margin:0 0 18px; max-width:520px; }
  .onglets-admin a { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px; border-radius:999px; color:var(--doux); font-weight:700; font-size:14px; text-decoration:none; }
  .onglets-admin a[aria-current] { background:#fff; color:#000; }
  .onglets-admin b { display:inline-grid; place-items:center; min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:#ff8a00; color:#000; font-size:11px; }
  .nf-liste { display:grid; gap:8px; max-width:760px; }
  .nf { display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border-radius:16px; background:var(--surface); border:1px solid var(--bord); }
  .nf.nouvelle { border-color:#3a3a3a; background:#141414; }
  .nf .pt { flex:none; width:9px; height:9px; margin-top:7px; border-radius:50%; background:transparent; } .nf.nouvelle .pt { background:#ff8a00; }
  .nf .corps { flex:1; min-width:0; } .nf p { margin:0; white-space:pre-line; overflow-wrap:anywhere; font-size:14.5px; }
  .nf small { color:var(--doux); font-size:12.5px; } .nf a.ouvrir { flex:none; align-self:center; font-size:13px; font-weight:700; color:#fff; padding:7px 12px; border:1px solid var(--bord-fort); border-radius:999px; text-decoration:none; }
  .rp-form { display:grid; gap:12px; max-width:560px; }
  .rp-form .ligne { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .rp-jours { display:flex; flex-wrap:wrap; gap:6px; } .rp-jours label { display:inline-flex; align-items:center; gap:6px; padding:7px 11px; border:1px solid var(--bord-fort); border-radius:999px; font-size:13px; cursor:pointer; }
  .rp-modeles { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 4px; } .rp-modeles button { padding:7px 12px; border-radius:999px; border:1px dashed var(--bord-fort); background:transparent; color:#fff; font:600 12.5px var(--police); cursor:pointer; }
  .rp { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:16px; background:var(--surface); border:1px solid var(--bord); }
  .rp.pause { opacity:.55; } .rp .corps { flex:1; min-width:0; } .rp b { display:block; overflow-wrap:anywhere; } .rp small { color:var(--doux); }
  .rp form { margin:0; } .rp .bouton { margin:0; width:auto; min-height:34px; padding:5px 12px; font-size:12.5px; }
</style>`;
const quandRappel = (r, JOURS) => (r.frequence === 'jour' ? `Chaque jour à ${r.heure} GMT`
  : r.frequence === 'semaine' ? `${r.jours.map((j) => JOURS[j]).join(', ')} à ${r.heure} GMT` : `Le ${r.date.split('-').reverse().join('/')} à ${r.heure} GMT`);
const SCRIPT_RAPPELS = `(function () {
  var f = document.querySelector('.rp-form'); if (!f) return;
  function maj() { var v = f.frequence.value; f.querySelector('[data-pour="semaine"]').hidden = v !== 'semaine'; f.querySelector('[data-pour="une-fois"]').hidden = v !== 'une-fois'; }
  f.frequence.addEventListener('change', maj); maj();
  document.querySelectorAll('[data-modele]').forEach(function (b) { b.addEventListener('click', function () {
    var m = JSON.parse(b.getAttribute('data-modele'));
    f.texte.value = m.texte; f.frequence.value = m.frequence; f.heure.value = m.heure;
    f.querySelectorAll('input[name="jours"]').forEach(function (c) { c.checked = (m.jours || []).indexOf(Number(c.value)) >= 0; });
    maj(); f.texte.focus();
  }); });
})();`;
function pageNotificationsAdmin(config, { espace, onglet, notifications = [], nonLues = 0, rappels = [], modeles = [], JOURS = [], message, erreur }) {
  const formatHeure = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' GMT';
  const tabs = `<nav class="onglets-admin" aria-label="Notifications">
    <a href="/notifications"${onglet === 'notifications' ? ' aria-current="page"' : ''}>Notifications${nonLues ? `<b>${nonLues}</b>` : ''}</a>
    <a href="/notifications?onglet=rappels"${onglet === 'rappels' ? ' aria-current="page"' : ''}>Mes rappels</a></nav>`;
  const corps = onglet === 'rappels' ? `
    <form class="carte rp-form" method="post" action="/admin/rappels">
      <h2 style="margin:0">Nouveau rappel</h2>
      <div class="rp-modeles">${modeles.map((m) => `<button type="button" data-modele="${echapper(JSON.stringify(m))}">+ ${echapper(m.texte)}</button>`).join('')}</div>
      <div class="champ"><label for="texte">Le rappel</label><input id="texte" name="texte" maxlength="300" placeholder="ex. Vérifier les coachings du jour" required></div>
      <div class="ligne">
        <div class="champ"><label for="frequence">Quand</label><select id="frequence" name="frequence">
          <option value="jour">Chaque jour</option><option value="semaine">Certains jours</option><option value="une-fois">Une seule fois</option></select></div>
        <div class="champ"><label for="heure">Heure (GMT)</label><input id="heure" name="heure" type="time" value="09:00" required></div>
      </div>
      <div class="rp-jours" data-pour="semaine" hidden>${JOURS.map((j, i) => ({ j, i })).slice(1).concat([{ j: JOURS[0], i: 0 }])
    .map(({ j, i }) => `<label><input type="checkbox" name="jours" value="${i}">${echapper(j)}</label>`).join('')}</div>
      <div class="champ" data-pour="une-fois" hidden><label for="date">Date</label><input id="date" name="date" type="date"></div>
      ${erreur ? `<p class="erreur-form" style="margin:0">${echapper(erreur)}</p>` : ''}
      <button class="bouton" type="submit" style="margin:0">Ajouter le rappel</button>
      <p class="doux petit" style="margin:0">Bob te l'envoie à l'heure choisie, dans l'application ou sur Discord selon ton réglage.</p>
    </form>
    <h2 style="font-size:16px;margin:22px 0 10px">Mes rappels (${rappels.length})</h2>
    <div class="nf-liste">${rappels.map((r) => `<div class="rp${r.actif ? '' : ' pause'}"><div class="corps"><b>${echapper(r.texte)}</b><small>${echapper(quandRappel(r, JOURS))}${r.actif ? '' : ' · en pause'}</small></div>
      ${r.frequence === 'une-fois' && !r.actif && r.dernier_envoi ? '' : `<form method="post" action="/admin/rappels/${r.id}/basculer"><button class="bouton secondaire" type="submit">${r.actif ? 'Pause' : 'Reprendre'}</button></form>`}
      <form method="post" action="/admin/rappels/${r.id}/supprimer"><button class="bouton secondaire" type="submit" aria-label="Supprimer">Supprimer</button></form></div>`).join('')
      || '<p class="vide-traiter">Aucun rappel. Crée-en un avec le formulaire, ou une des idées en un clic.</p>'}</div>`
    : `<div class="nf-liste">${notifications.map((n) => `<div class="nf${n.lu_le ? '' : ' nouvelle'}"><span class="pt"></span>
      <div class="corps"><p>${echapper(n.texte)}</p><small>${echapper(formatHeure(n.cree_le))}</small></div>
      ${n.lien ? `<a class="ouvrir" href="${echapper(n.lien)}">Ouvrir</a>` : ''}</div>`).join('') || '<p class="vide-traiter">Aucune notification pour le moment.</p>'}</div>
    <p class="doux petit" style="margin:18px 0 0"><a href="/notifications?onglet=reglages">Réglages : application et notifications sur ce téléphone</a></p>`;
  return pageEspace('Notifications', `${STYLE_ADMIN_NOTIF}
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Notifications</h1></div></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${tabs}${corps}`, espace, 'notifications', onglet === 'rappels' ? { script: SCRIPT_RAPPELS } : {});
}

// Notifications d'un membre : ses derniers messages (Bob ou l'application), puis l'onglet Réglages.
function pageNotificationsMembre(config, { espace, notifications = [] }) {
  const formatHeure = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return pageEspace('Notifications', `${STYLE_ADMIN_NOTIF}
  <div class="titre-page"><div><p class="etiquette">Mon compte</p><h1>Notifications</h1></div></div>
  <nav class="onglets-admin" aria-label="Notifications"><a href="/notifications" aria-current="page">Notifications</a><a href="/notifications?onglet=reglages">Réglages</a></nav>
  <div class="nf-liste">${notifications.map((n) => `<div class="nf${n.lu_le ? '' : ' nouvelle'}"><span class="pt"></span>
    <div class="corps"><p>${echapper(n.texte)}</p><small>${echapper(formatHeure(n.cree_le))}</small></div>
    ${n.lien ? `<a class="ouvrir" href="${echapper(n.lien)}">Ouvrir</a>` : ''}</div>`).join('') || '<p class="vide-traiter">Aucune notification pour le moment.</p>'}</div>`, espace, 'notifications');
}

module.exports = { pageNotificationsMembre, pageNotifications, pageNotificationsAdmin, blocInstallation, SCRIPT_OUTILS_APP, STYLE_NOTIF };
