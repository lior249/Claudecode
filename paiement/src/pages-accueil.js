'use strict';

// Accueil des nouveaux membres (/bienvenue), à la première connexion, en 5 écrans :
// bienvenue → ses informations → installer l'application → ses notifications (l'application, recommandée, ou Bob) → c'est prêt.
// Chaque écran se passe ; ce qui est déjà fait est sauté (ex. l'iPhone qui revient dans l'application installée).
const { echapper, fenetreTutoBob } = require('./pages');
const { pageEspace } = require('./pages-espace');
const { blocInstallation, SCRIPT_OUTILS_APP, STYLE_NOTIF } = require('./pages-notifications');

const PAYS = ['Togo', 'Bénin', 'Côte d\'Ivoire', 'Sénégal', 'Cameroun', 'Burkina Faso', 'Mali', 'Niger', 'Guinée', 'Gabon', 'Congo',
  'RD Congo', 'Maroc', 'Algérie', 'Tunisie', 'Madagascar', 'France', 'Belgique', 'Suisse', 'Canada', 'Luxembourg'];

const STYLE_ACCUEIL = `<style>
  .accueil { max-width:520px; margin:0 auto; }
  .points { display:flex; gap:6px; justify-content:center; margin:4px 0 18px; }
  .points i { width:28px; height:5px; border-radius:3px; background:#2a2a2a; }
  .points i[data-fait] { background:#fff; }
  .ecran[hidden] { display:none; }
  .ecran h1 { font-size:26px; margin:0 0 8px; }
  .ecran .liste-accueil { list-style:none; padding:0; margin:14px 0; display:grid; gap:10px; }
  .ecran .liste-accueil li { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--bord); border-radius:14px; }
  .ecran .liste-accueil b { display:block; }
  .ecran .liste-accueil span { color:var(--doux); font-size:13.5px; }
  .ecran .num { flex:none; display:grid; place-items:center; width:26px; height:26px; border-radius:50%; background:#fff; color:#000; font-weight:800; font-size:13px; }
  .passer { display:block; width:100%; margin-top:10px; background:none; border:0; color:var(--doux); font:600 14px var(--police); cursor:pointer; padding:10px; }
  .choix-notif { display:grid; gap:10px; margin:14px 0; }
  .choix-notif button { text-align:left; padding:14px; border-radius:14px; border:1px solid var(--bord-fort); background:#111; color:#fff; cursor:pointer; font:inherit; }
  .choix-notif button b { display:block; font-size:15px; } .choix-notif button span { color:var(--doux); font-size:13px; }
  .choix-notif .recommande { border-color:#fff; }
  .choix-notif .recommande em { font-style:normal; font-size:11px; font-weight:800; background:#fff; color:#000; border-radius:999px; padding:2px 8px; margin-left:6px; }
</style>`;

function pageAccueilMembre(config, { espace, session, profil, clePublique, canal, suite }) {
  const donnees = { cle: clePublique, canal, suite, infos: Boolean(profil && profil.prenom && profil.pays) };
  const script = `${SCRIPT_OUTILS_APP}
(function () {
  var D = ${JSON.stringify(donnees).replace(/</g, '\\u003c')};
  var ecrans = document.querySelectorAll('.ecran'), points = document.querySelectorAll('.points i'), n = 0;
  function aller(i) {
    n = i;
    ecrans.forEach(function (e, k) { e.hidden = k !== i; });
    points.forEach(function (p, k) { if (k <= i) p.setAttribute('data-fait', ''); else p.removeAttribute('data-fait'); });
    window.scrollTo(0, 0);
  }
  function statut(id, t, ton) { var e = document.getElementById(id); e.textContent = t; e.setAttribute('data-ton', ton || ''); }
  document.querySelectorAll('[data-suivant]').forEach(function (b) { b.onclick = function () { aller(n + 1); }; });
  OVXApp.montrerInstallation();
  // Ses informations (prénom, pays) ; le fuseau horaire vient du téléphone.
  var fuseau = ''; try { fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  document.getElementById('fuseau-vu').textContent = fuseau || 'inconnu';
  document.getElementById('form-infos').onsubmit = function (ev) {
    ev.preventDefault();
    var f = ev.target;
    OVXApp.poster('/api/bienvenue/infos', { prenom: f.prenom.value, pays: f.pays.value, fuseau: fuseau })
      .then(function () { aller(2); })
      .catch(function (e) { statut('statut-infos', e.message, 'erreur'); });
  };
  // Notifications : l'application (recommandée) ou Bob.
  document.getElementById('notif-app').onclick = function () {
    statut('statut-notif', 'Activation…');
    OVXApp.activer(D.cle).then(function () { statut('statut-notif', 'Activé : tes notifications arrivent dans l\\'application.', 'ok'); setTimeout(function () { aller(4); }, 900); })
      .catch(function (e) { statut('statut-notif', e.message, 'erreur'); });
  };
  document.getElementById('notif-bob').onclick = function () {
    OVXApp.poster('/api/notifications/canal', { canal: 'bob' }).then(function () {
      statut('statut-notif', 'C\\'est noté : Bob t\\'écrit sur Discord. Vérifie qu\\'il peut le faire :', 'ok');
      document.getElementById('verifier-bob').hidden = false;
    }).catch(function (e) { statut('statut-notif', e.message, 'erreur'); });
  };
  document.getElementById('terminer').onclick = function () {
    var b = this; b.disabled = true;
    OVXApp.poster('/api/bienvenue/fini').then(function () { location.href = D.suite; }).catch(function () { location.href = D.suite; });
  };
  // Déjà fait : on passe directement à la suite (ex. retour dans l'application installée sur iPhone).
  var depart = 0;
  if (D.infos) depart = OVXApp.installee ? 3 : 2;
  if (D.infos && D.canal === 'app') depart = 4;
  aller(depart);
})();`;
  const prenom = (profil && profil.prenom) || '';
  return pageEspace('Bienvenue', `${STYLE_NOTIF}${STYLE_ACCUEIL}
  <div class="accueil">
    <div class="points" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

    <section class="ecran">
      <p class="etiquette">Overmaxx</p>
      <h1>Bienvenue, ${echapper(session.pseudo || 'toi')} !</h1>
      <p class="doux">Deux minutes pour bien démarrer :</p>
      <ul class="liste-accueil">
        <li><span class="num">1</span><div><b>Tes informations</b><span>ton prénom et ton pays</span></div></li>
        <li><span class="num">2</span><div><b>L'application Overmaxx</b><span>sur l'écran d'accueil de ton téléphone</span></div></li>
        <li><span class="num">3</span><div><b>Tes notifications</b><span>pour ne rien rater : coachings, rappels, remarques de ton coach</span></div></li>
      </ul>
      <button class="bouton" type="button" data-suivant>Commencer</button>
    </section>

    <section class="ecran" hidden>
      <h1>Tes informations</h1>
      <form id="form-infos" class="carte" style="display:grid;gap:12px">
        <div class="champ"><label for="prenom">Ton prénom</label><input id="prenom" name="prenom" value="${echapper(prenom)}" autocomplete="given-name" required maxlength="40"></div>
        <div class="champ"><label for="pays">Ton pays</label><input id="pays" name="pays" list="liste-pays" value="${echapper((profil && profil.pays) || '')}" autocomplete="country-name" required maxlength="60">
          <datalist id="liste-pays">${PAYS.map((p) => `<option value="${echapper(p)}">`).join('')}</datalist></div>
        <p class="doux petit" style="margin:0">Ton heure : <b id="fuseau-vu"></b>. Tous les horaires (coachings, rappels) s'affichent à ton heure.</p>
        <p id="statut-infos" class="statut" aria-live="polite"></p>
        <button class="bouton" type="submit" style="margin-top:0">Suivant</button>
      </form>
    </section>

    <section class="ecran" hidden>
      <h1>L'application Overmaxx</h1>
      <p class="doux">Sur l'écran d'accueil de ton téléphone, avec l'icône Overmaxx : elle s'ouvre comme une vraie application, déjà connectée.</p>
      <div class="carte">${blocInstallation()}</div>
      <button class="bouton" type="button" data-suivant>Suivant</button>
      <button class="passer" type="button" data-suivant>Plus tard</button>
    </section>

    <section class="ecran" hidden>
      <h1>Tes notifications</h1>
      <p class="doux">Où veux-tu recevoir tes rappels de coaching, les remarques de ton coach et tes tâches du jour ?</p>
      <div class="choix-notif">
        <button id="notif-app" class="recommande" type="button"><b>L'application Overmaxx<em>Recommandé</em></b>
          <span>Directement sur ton téléphone, même quand Discord est fermé.</span></button>
        <button id="notif-bob" type="button"><b>Bob, sur Discord</b><span>En message privé.</span></button>
      </div>
      <p id="statut-notif" class="statut" aria-live="polite"></p>
      <button id="verifier-bob" class="bouton secondaire" type="button" data-tuto-bob hidden>Vérifier que Bob peut m'écrire</button>
      <button class="bouton" type="button" data-suivant>Suivant</button>
      <p class="doux petit" style="margin:10px 0 0">Tu pourras changer à tout moment dans <b>Notifications</b>.</p>
    </section>

    <section class="ecran" hidden>
      <h1>Tout est prêt !</h1>
      <p class="doux">Ton espace t'attend. À chaque étape, Overmaxx te montrera ce qu'il te reste à faire.</p>
      <button id="terminer" class="bouton" type="button">Ouvrir mon espace</button>
    </section>
  </div>
  ${fenetreTutoBob(config, { rejoindre: false })}`, espace, null, { script });
}

module.exports = { pageAccueilMembre };
