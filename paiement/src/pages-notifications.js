'use strict';

// Page « Notifications » : installer l'application Overmaxx sur son téléphone, puis choisir où recevoir ses messages
// (Bob sur Discord, ou l'application). Les rappels de paiement passent toujours par les deux.
const { echapper, formatDate } = require('./pages');
const { pageEspace } = require('./pages-espace');

const STYLE_NOTIF = `<style>
  .option { display:flex; gap:12px; align-items:flex-start; padding:14px; border:1px solid var(--bord-fort); border-radius:14px; cursor:pointer; margin:0 0 10px; }
  .option input { width:20px; height:20px; margin:2px 0 0; flex:none; accent-color:#fff; }
  .option b { display:block; font-size:15px; }
  .option span { display:block; color:var(--doux); font-size:13px; margin-top:2px; font-weight:400; }
  .option:has(input:checked) { border-color:#fff; background:#111; }
  .option[aria-disabled="true"] { opacity:.5; cursor:not-allowed; }
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

function pageNotifications(config, { espace, clePublique, canal, appareils = [], message }) {
  const donnees = { cle: clePublique, canal };
  const script = `
(function () {
  var D = ${JSON.stringify(donnees).replace(/</g, '\\u003c')};
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var installee = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var supporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function q(s) { return document.querySelector(s); }
  function statut(t, ton) { var e = q('#statut'); e.textContent = t; e.setAttribute('data-ton', ton || ''); }
  function poster(url, corps) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps || {}) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.erreur) throw new Error(d.erreur || 'Erreur'); return d; }); });
  }
  // ----- Installer l'application -----
  if (installee) { q('#app-installee').hidden = false; }
  else if (ios) { q('#app-iphone').hidden = false; }
  else { q('#app-android').hidden = false; }
  var invite = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); invite = e; q('#installer').hidden = false; q('#installer-aide').hidden = true; });
  q('#installer').onclick = function () { if (!invite) return; invite.prompt(); invite.userChoice.then(function () { invite = null; q('#installer').hidden = true; }); };
  window.addEventListener('appinstalled', function () { q('#app-android').hidden = true; q('#app-installee').hidden = false; });

  // ----- Activer les notifications sur cet appareil -----
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
  function activer() {
    if (!supporte) return Promise.reject(new Error(ios && !installee ? 'Sur iPhone, installe d\\'abord l\\'application (étapes ci-dessus), puis ouvre-la et reviens ici.' : 'Ce navigateur ne gère pas les notifications.'));
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('Notifications refusées. Autorise-les dans les réglages de ton téléphone pour Overmaxx.');
      return navigator.serviceWorker.register('/sw.js');
    }).then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid(D.cle) }); }); })
      .then(function (s) { return poster('/api/notifications/abonnement', { abonnement: s.toJSON(), appareil: appareil() }); });
  }
  document.querySelectorAll('input[name=canal]').forEach(function (r) {
    r.onchange = function () {
      if (r.value === 'bob') {
        poster('/api/notifications/canal', { canal: 'bob' }).then(function () { statut('C\\'est noté : Bob t\\'écrit sur Discord.', 'ok'); }).catch(function (e) { statut(e.message, 'erreur'); });
        return;
      }
      statut('Activation des notifications…');
      activer().then(function () { return poster('/api/notifications/canal', { canal: 'app' }); })
        .then(function () { statut('C\\'est activé : tes notifications arrivent dans l\\'application.', 'ok'); setTimeout(function () { location.reload(); }, 1200); })
        .catch(function (e) { q('input[value=bob]').checked = true; statut(e.message, 'erreur'); });
    };
  });
  q('#tester').onclick = function () {
    var b = this; b.disabled = true;
    (D.canal === 'app' || !supporte ? Promise.resolve() : activer())
      .then(function () { return poster('/api/notifications/test'); })
      .then(function (d) { statut(d.appareils ? 'Notification envoyée sur ' + d.appareils + ' appareil(s).' : 'Aucun appareil : active d\\'abord les notifications.', d.appareils ? 'ok' : 'erreur'); })
      .catch(function (e) { statut(e.message, 'erreur'); })
      .then(function () { b.disabled = false; });
  };
  // Cet appareil est-il déjà abonné ? (bouton « Retirer cet appareil »)
  if (supporte) navigator.serviceWorker.getRegistration('/').then(function (reg) { return reg && reg.pushManager.getSubscription(); }).then(function (s) {
    if (!s) return;
    document.querySelectorAll('[data-endpoint]').forEach(function (l) {
      if (l.getAttribute('data-endpoint') !== s.endpoint) return;
      l.querySelector('.ce').hidden = false;
      var b = l.querySelector('button'); b.hidden = false;
      b.onclick = function () { s.unsubscribe().then(function () { return poster('/api/notifications/desabonnement', { endpoint: s.endpoint }); }).then(function () { location.reload(); }); };
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
        <p id="app-installee" class="app-ok" hidden>✓ L'application est installée sur cet appareil.</p>
        <div id="app-android" hidden>
          <button id="installer" class="bouton" type="button" hidden>Installer l'application</button>
          <p id="installer-aide" class="doux petit" style="margin:0">Dans le menu de ton navigateur (⋮), touche <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>.</p>
        </div>
        <div id="app-iphone" hidden>
          <p style="margin:0">Sur iPhone (iOS 16.4 ou plus récent), depuis <b>Safari</b> :</p>
          <ol class="etapes">
            <li>Touche ${PARTAGER} <b>Partager</b>, en bas de l'écran.</li>
            <li>Touche ${AJOUTER} <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li>
            <li>Ouvre <b>Overmaxx</b> depuis ton écran d'accueil et reviens sur cette page pour activer les notifications.</li>
          </ol>
          <p class="doux petit" style="margin:10px 0 0">Sur iPhone, les notifications ne marchent que dans l'application installée.</p>
        </div>
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
  </div>`, espace, 'notifications', { script });
}

module.exports = { pageNotifications };
