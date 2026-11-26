'use strict';

// Pages Elite (candidature), Coaching privé (réservation) et Admin (calendrier).
const { ICONE, echapper, gabarit, gabaritEspace, formatDate, formatPrix, blocSupport, blocVideo, fenetreTutoBob } = require('./pages');
const { FORMULAIRES } = require('./formulaires');
const { pageFormulaire } = require('./pages-formulaire');

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

const STYLE_BUREAU = `<style>
  .c-long { display:none; }
  .colonnes { display:block; }
  .grille-cartes { display:grid; gap:14px; } .grille-cartes .carte { margin:0; }
  .defile { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  table.membres { min-width:640px; }
  @media (min-width: 960px) {
    .tableau { grid-template-columns:60px repeat(7, 1fr); gap:6px; }
    .tableau .tete { font-size:13px; } .tableau .tete small { font-size:11px; }
    .tableau .h { font-size:13px; } .tableau .coupure { height:10px; }
    .case { height:38px; border-radius:9px; font-size:11.5px; }
    .c-court { display:none; } .c-long { display:inline; }
    .legende { font-size:12.5px; }
  }
  @media (min-width: 1180px) {
    .colonnes { display:grid; grid-template-columns:minmax(0, 1fr) 340px; gap:28px; align-items:start; }
    .colonnes > .cote { position:sticky; top:28px; }
    .grille-cartes { grid-template-columns:1fr 1fr; }
  }
</style>`;

// Menu de la barre latérale.
function navEspace(espace = {}) {
  const nav = [];
  if (espace.estAdmin) {
    nav.push({ section: 'Gestion' },
      { cle: 'coach', libelle: 'Mon profil', lien: '/coach', icone: 'profil' },
      { cle: 'traiter', libelle: 'À traiter', lien: '/admin/a-traiter', icone: 'traiter', badge: espace.aTraiterParcours || null },
      { cle: 'calendrier', libelle: 'Calendrier', lien: '/admin', icone: 'calendrier' },
      { cle: 'eleves', libelle: 'Élèves Elite', lien: '/admin/eleves', icone: 'eleves' },
      { cle: 'planifier', libelle: 'Planifier', lien: '/admin/planifier', icone: 'annonces' });
  }
  // Le coach (admin) ne réserve pas de séance : pas de « Mes coachings » pour lui.
  if (!espace.estAdmin) {
    nav.push({ section: espace.parcours ? 'Mon accompagnement' : 'Mon espace' });
    // Élèves : le minimum. Fiche (photo), remarques (bulle), notifications (cloche), « Je suis » et réglages sont sur Mon profil.
    if (espace.parcours) {
      nav.push({ cle: 'profil', libelle: 'Mon profil', lien: '/profil', icone: 'profil' },
        { cle: 'parcours', libelle: 'Mon parcours', lien: '/parcours', icone: 'parcours' });
    }
    nav.push({ cle: 'coaching', libelle: 'Mes coachings', lien: '/coaching', icone: 'coaching' });
  }
  nav.push({ cle: 'classement', libelle: 'Classement', lien: '/classement', icone: 'classement' });
  if (!espace.parcours || espace.estAdmin) nav.push({ cle: 'notifications', libelle: 'Notifications', lien: '/notifications', icone: 'notifications', badge: espace.notifsNonLues || null });
  return nav;
}

function pageEspace(titre, contenu, espace, actif, options = {}) {
  const session = espace && espace.session;
  return gabaritEspace(titre, `${STYLE_GRILLE}${STYLE_BUREAU}${contenu}`, {
    ...options, nav: navEspace(espace), actif, jetonApp: espace && espace.jetonApp, evenements: (espace && espace.evenements) || [],
    // Élèves de l'accompagnement : la barre du bas sur téléphone.
    // Le coach : Profil, À traiter, Calendrier, Planifier, Classement.
    barreBas: espace && espace.estAdmin ? [
      { cle: 'coach', libelle: 'Profil', lien: '/coach', icone: 'profil' },
      { cle: 'traiter', libelle: 'À traiter', lien: '/admin/a-traiter', icone: 'traiter', badge: espace.aTraiterParcours || 0 },
      { cle: 'calendrier', libelle: 'Calendrier', lien: '/admin', icone: 'calendrier' },
      { cle: 'planifier', libelle: 'Planifier', lien: '/admin/planifier', icone: 'annonces' },
      { cle: 'classement', libelle: 'Classement', lien: '/classement', icone: 'classement' }]
      : espace && espace.parcours ? [
      { cle: 'profil', libelle: 'Profil', lien: '/profil', icone: 'profil' },
      { cle: 'remarques', libelle: 'Remarques', lien: '/remarques', icone: 'remarques', badge: espace.remarquesNouvelles || 0 },
      { cle: 'notifications', libelle: 'Mes rappels', lien: '/notifications', icone: 'notifications', badge: espace.notifsNonLues || 0 },
      { cle: 'classement', libelle: 'Classement', lien: '/classement', icone: 'classement' }] : null,
    compte: session ? { pseudo: session.pseudo || 'Membre', role: espace.estAdmin ? 'Coach' : 'Membre Elite' } : null,
    // Le nombre sur l'icône de l'application installée (comme TikTok).
    pastilleApp: session ? (espace.notifsNonLues || 0) + (espace.remarquesNouvelles || 0) : null,
  });
}


// Toutes les pages (sauf l'accueil) demandent le compte Discord. Pas de mot de passe : la personne donne son pseudo,
// Bob lui envoie sur Discord un bouton « C'est bien moi, continuer », qui ouvre le site connecté.
const TUTO_PSEUDO = (FORMULAIRES.candidature.questions.find((x) => x.id === 'discord') || {}).images || [];
// Appareil reconnu : sa photo, son pseudo et « Me reconnecter » (sans Bob).
function carteReconnexion(appareil, retour) {
  const initiale = echapper((appareil.prenom || appareil.pseudo || '?').slice(0, 1).toUpperCase());
  return `<div class="carte" style="display:flex;align-items:center;gap:14px">
    ${appareil.avatar ? `<img src="${echapper(appareil.avatar)}" alt="" width="52" height="52" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex:none">`
    : `<span style="width:52px;height:52px;border-radius:50%;background:var(--surface-2,#232428);display:grid;place-items:center;font-weight:700;font-size:20px;flex:none">${initiale}</span>`}
    <div style="min-width:0"><b style="overflow-wrap:anywhere">${echapper(appareil.pseudo)}</b><br><span class="doux petit">Cet appareil est reconnu : pas besoin d'un nouveau code de Bob.</span></div>
  </div>
  <form method="post" action="/connexion/appareil" style="margin:0"><input type="hidden" name="retour" value="${echapper(retour)}">
    <button class="bouton" type="submit">Me reconnecter</button></form>
  <p class="doux petit centre" style="margin:16px 0 0"><a href="/connexion/oublier?retour=${encodeURIComponent(retour)}">Ce n'est pas toi ? Utiliser un autre compte</a></p>`;
}

function pageConnexionRequise(config, { retour = '/', message, erreur, pseudo, introuvable, appareil } = {}) {
  // Depuis la page d'accueil (ou l'application) : « Se connecter à Overmaxx », puis son espace s'ouvre.
  const accueil = retour === '/app';
  if (appareil) {
    return gabarit('Connexion', `
  <p class="etiquette">${echapper(message || 'Overmaxx')}</p>
  <h1>Bon retour${appareil.prenom ? `, ${echapper(appareil.prenom)}` : ''}</h1>
  ${carteReconnexion(appareil, retour)}`);
  }
  return gabarit('Connexion', `
  <p class="etiquette">${echapper(message || 'Overmaxx')}</p>
  <h1>${accueil ? 'Se connecter à Overmaxx' : 'Connecte ton compte Discord'}</h1>
  <p class="doux">Indique ton pseudo Discord. Bob, notre bot, t'envoie un code sur Discord : tape-le ici, et tu es connecté. Aucun mot de passe.</p>
  <form class="carte" method="post" action="/connexion/pseudo" novalidate>
    <label for="pseudo"><b>Ton pseudo Discord</b></label>
    <input id="pseudo" name="pseudo" value="${echapper(pseudo || '')}" placeholder="ex. awa_27" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="40" required style="margin-top:8px">
    <input type="hidden" name="retour" value="${echapper(retour)}">
    ${erreur ? `<p class="erreur-form" style="margin:10px 0 0">${echapper(erreur)}</p>` : ''}
    <button class="bouton" type="submit">Recevoir mon code</button>
  </form>
  ${TUTO_PSEUDO.length ? `<details class="carte"><summary style="cursor:pointer;font-weight:600">Où trouver mon pseudo ?</summary>
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:14px">${TUTO_PSEUDO.map((im) => `<figure style="margin:0">
      <img src="${echapper(im.src)}" alt="" loading="lazy" style="width:100%;max-width:360px;border-radius:14px;border:1px solid var(--bord)">
      <figcaption class="doux petit" style="margin-top:6px">${echapper(im.legende)}</figcaption></figure>`).join('')}</div></details>` : ''}
  ${config.lienDiscord ? `<p class="doux petit centre" style="margin:${introuvable ? '4px' : '18px'} 0 0">Pas encore sur le serveur Overmaxx ?</p>
  <a class="bouton ${introuvable ? '' : 'secondaire'}" href="${echapper(config.lienDiscord)}" style="margin-top:8px" data-tuto-bob>Rejoindre le Discord</a>
  ${fenetreTutoBob(config)}` : ''}`);
}

// Bob a envoyé le code : on le tape ici (dans l'application aussi), et cet appareil est connecté.
const SCRIPT_CODE = `(function () {
  var c = document.getElementById('code');
  if (!c) return;
  c.addEventListener('input', function () {
    var v = c.value.replace(/\\D/g, '').slice(0, 6);
    if (c.value !== v) c.value = v;
    if (v.length === 6 && !c.form.dataset.envoye) { c.form.dataset.envoye = '1'; c.form.submit(); }
  });
  // Un seul envoi : le bouton ne repart pas si le code est déjà parti.
  c.form.addEventListener('submit', function (e) {
    if (c.form.dataset.parti) { e.preventDefault(); return; }
    c.form.dataset.parti = '1'; c.form.dataset.envoye = '1';
  });
})();`;
function pageConnexionEnvoyee(config, { url, retour = '/', demande, erreur }) {
  const formulaire = demande ? `<form class="carte" method="post" action="/connexion/code" style="display:grid;gap:12px">
    <p style="margin:0">Bob vient de t'envoyer un <b>code à 6 chiffres</b>, en message privé ou dans ton fil <b>Bob</b> du serveur. Tape-le ici :</p>
    <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="••••••" aria-label="Code de Bob"
      style="font-size:30px;letter-spacing:.45em;text-align:center;font-weight:700;padding:14px 10px" required>
    <input type="hidden" name="demande" value="${echapper(demande)}"><input type="hidden" name="retour" value="${echapper(retour)}">
    ${erreur ? `<p class="erreur-form" style="margin:0">${echapper(erreur)}</p>` : ''}
    <button class="bouton" type="submit" style="margin:0">Me connecter</button>
  </form>` : `<div class="carte">${erreur ? `<p class="erreur-form" style="margin:0">${echapper(erreur)}</p>` : ''}</div>
  <a class="bouton" href="/connexion?retour=${encodeURIComponent(retour)}">Recevoir un nouveau code</a>`;
  return gabarit('Regarde sur Discord', `
  <div class="icone-ronde">${ICONE.ok}</div>
  <h1 class="centre">Regarde sur Discord</h1>
  ${formulaire}
  ${demande && url ? `<a class="bouton secondaire" href="${echapper(url)}">Ouvrir Discord</a>` : ''}
  ${demande ? `<p class="doux petit" style="margin:16px 0 0">Ensuite, cet appareil reste reconnu : après une déconnexion, « Me reconnecter » suffit.
    Tu peux aussi appuyer sur <b>C'est bien moi, continuer</b> dans le message de Bob : le site s'ouvre alors dans ton navigateur.</p>
  <a class="bouton secondaire" href="/connexion?retour=${encodeURIComponent(retour)}">Je n'ai rien reçu</a>` : ''}`, demande ? { script: SCRIPT_CODE } : {});
}

const boutonDiscord = (config) => (config.lienDiscord
  ? `<a class="bouton" href="${echapper(config.lienDiscord)}" style="max-width:340px" data-tuto-bob>Rejoindre le Discord</a>${fenetreTutoBob(config)}` : '');

// /coaching/elite : formulaire 1 (candidature), façon Tally, sans connexion. Aucun prix affiché.
function pageEliteCandidature(config, { session } = {}) {
  const o = config.offres.elite;
  const f = FORMULAIRES.candidature;
  // Connecté avec Discord (bouton de Bob) : on sait déjà qui il est, la question du pseudo est sautée.
  const questions = session ? f.questions.filter((x) => x.id !== 'discord') : f.questions;
  const vsl = blocVideo(o.wistiaVsl, `Présentation ${o.nom}`);
  const intro = `
    <p class="tf-num">Accompagnement privé · sur sélection</p>
    <h1 class="tf-q">${echapper(o.nom)}</h1>
    <p class="tf-aide">Regarde la vidéo jusqu'au bout, puis réponds aux questions. Ça prend 2 minutes.</p>
    ${vsl}
    <div class="tf-actions"><button class="tf-ok" type="button" data-commencer>Commencer</button><span class="tf-indice">${questions.length} question${questions.length > 1 ? 's' : ''}</span></div>`;
  const fin = `
    <div class="icone-ronde">${ICONE.ok}</div>
    <h1 class="tf-q">Ton formulaire est en cours de traitement.</h1>
    <p class="tf-aide">Bob, notre bot, te répondra en <b style="color:#fff">message privé sur Discord sous 24 heures</b>. Tu peux aussi garder cette page ouverte : <b style="color:#fff">elle se met à jour toute seule</b> et t'affichera la suite si ton profil est retenu.</p>
    <p class="tf-aide" style="margin-bottom:8px">Pas encore sur le serveur Overmaxx ? Rejoins-le maintenant, sinon Bob ne pourra pas t'écrire.</p>
    ${boutonDiscord(config)}`;
  return pageFormulaire(config, { titre: f.titre, mode: 'candidature', questions, intro, fin, videoMaxMo: config.videoMaxMo || 20 });
}

// Formulaire 2 (profils retenus), ouvert par le lien de Bob.
function pageConfirmation(config, { session }) {
  const f = FORMULAIRES.confirmation;
  const intro = `
    <p class="tf-num">Candidature Overmaxx Elite · ${echapper(session.pseudo || '')}</p>
    <h1 class="tf-q">Ton profil est retenu !</h1>
    <p class="tf-aide">Dernière étape avant la réponse finale : quelques réponses de plus.</p>
    <div class="tf-actions"><button class="tf-ok" type="button" data-commencer>Continuer</button></div>`;
  const fin = `
    <div class="icone-ronde">${ICONE.ok}</div>
    <h1 class="tf-q">C'est envoyé.</h1>
    <p class="tf-aide">Ta candidature est en cours d'examen. Bob te donne la réponse finale en message privé sur Discord.</p>`;
  return pageFormulaire(config, { titre: f.titre, mode: 'confirmation', questions: f.questions, intro, fin, videoMaxMo: config.videoMaxMo || 20 });
}

// /coaching/elite/candidature : une seule page qui suit la candidature de bout en bout.
function pageCandidature(config, { session, candidature, lienPaiement, paye, message, lienDiscord, apercu }) {
  const o = config.offres.elite;
  const titre = (t) => `<p class="etiquette">Candidature ${echapper(o.nom)}</p><h1>${t}</h1>`;
  const attente = (texte) => `
    <div class="centre"><div class="roue" role="status" style="width:56px;height:56px;margin:18px auto;border-radius:50%;border:6px solid var(--bord);border-top-color:#fff;animation:tourne .9s linear infinite"></div></div>
    <div class="carte"><p style="margin:0">${texte}</p></div>`;
  const suivi = `
  (function () {
    var statut = ${JSON.stringify(candidature ? candidature.statut : null)};
    setInterval(function () {
      fetch('/api/candidature', { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (d) { if (d.statut && d.statut !== statut) location.reload(); }).catch(function () {});
    }, 8000);
  })();`;

  if (!session) {
    return gabarit('Candidature', `${titre('Suivre ma candidature')}
    <div class="carte"><p class="doux" style="margin:0">Toutes les réponses arrivent sur Discord, par message privé de <b style="color:#fff">Bob</b>, notre bot.
      Quand ton profil est retenu, il t'envoie le lien de la suite du formulaire.</p></div>
    <a class="bouton" href="${o.base}">Remplir le formulaire de candidature</a>
    ${config.lienDiscord ? `<a class="bouton secondaire" href="${echapper(config.lienDiscord)}" data-tuto-bob>Rejoindre le Discord</a>${fenetreTutoBob(config)}` : ''}`);
  }
  const c = candidature;
  let corps = '';
  let script = suivi;
  switch (c.statut) {
    case 'formulaire':
      script = null;
      corps = `${titre('Ta candidature')}
      <div class="carte"><p style="margin:0">Tu n'as pas encore rempli le formulaire de candidature.</p></div>
      <a class="bouton" href="${o.base}">Remplir le formulaire</a>`;
      break;
    case 'examen':
      corps = `${titre('Candidature en cours de traitement')}${attente('Ton formulaire est bien reçu. Nous l\'examinons : <b>réponse sous 24 heures</b>, par message de Bob sur Discord. <b>Cette page se met à jour toute seule</b> : garde-la ouverte ou reviens plus tard.')}
      ${config.lienDiscord ? `<a class="bouton secondaire" href="${echapper(config.lienDiscord)}" data-tuto-bob>Rejoindre le Discord</a>${fenetreTutoBob(config)}` : ''}`;
      break;
    case 'retenu':
      script = `${suivi}
      (function () {
        var champ = document.getElementById('fichier'), btn = document.getElementById('envoyer'), barre = document.getElementById('barre'), info = document.getElementById('info');
        champ.onchange = function () { btn.disabled = !champ.files.length; if (champ.files.length) info.textContent = champ.files[0].name + ' · ' + Math.max(1, Math.round(champ.files[0].size / 1048576)) + ' Mo'; };
        btn.onclick = function () {
          var f = champ.files[0]; if (!f) return;
          if (f.size > ${Math.round((config.videoMaxMo || 150))} * 1048576) { alert('Vidéo trop lourde (maximum ${config.videoMaxMo || 150} Mo).'); return; }
          btn.disabled = true; btn.textContent = 'Envoi en cours…'; barre.parentNode.hidden = false;
          var x = new XMLHttpRequest(); x.open('POST', '/api/candidature/video');
          x.setRequestHeader('Content-Type', f.type || 'video/mp4');
          x.upload.onprogress = function (e) { if (e.lengthComputable) barre.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
          x.onload = function () { var d = {}; try { d = JSON.parse(x.responseText); } catch (e) {}
            if (x.status === 200) location.reload(); else { alert(d.erreur || 'L\'envoi a échoué. Réessaie.'); btn.disabled = false; btn.textContent = 'Envoyer ma vidéo'; } };
          x.onerror = function () { alert('Connexion interrompue. Réessaie.'); btn.disabled = false; btn.textContent = 'Envoyer ma vidéo'; };
          x.send(f);
        };
      })();`;
      corps = `${titre('Ton profil est retenu !')}
      <div class="carte">
        <h2>Dernière étape : ta vidéo d'1 minute</h2>
        <p class="doux">Filme-toi face caméra et présente-toi : qui tu es, où tu en es sur TikTok, ton objectif dans les 3 prochains mois, et pourquoi tu veux rejoindre l'Elite.</p>
        <input id="fichier" type="file" accept="video/*" hidden>
        <label for="fichier" class="bouton secondaire" style="margin-top:14px">Choisir ma vidéo</label>
        <p id="info" class="doux petit centre" style="margin:8px 0 0">MP4, MOV ou WEBM · ${config.videoMaxMo || 150} Mo maximum</p>
        <div hidden style="height:8px;border-radius:8px;background:var(--surface-2);margin-top:12px;overflow:hidden"><div id="barre" style="height:100%;width:0;background:#fff"></div></div>
        <button id="envoyer" class="bouton" type="button" disabled>Envoyer ma vidéo</button>
      </div>`;
      break;
    case 'video':
      corps = `${titre('Vidéo reçue')}${attente('Merci ! Ta vidéo est en cours d\'examen. Tu reçois la réponse finale ici et par message de Bob sur Discord.')}`;
      break;
    case 'refuse':
      script = null;
      corps = `${titre('Candidature non retenue')}
      <div class="carte"><p style="margin:0">Merci pour ta candidature. Après examen, ton profil n'a pas été retenu pour l'Elite cette fois-ci.
        Tu peux continuer à progresser avec la Community.</p></div>
      <a class="bouton" href="/community">Découvrir la Community</a>`;
      break;
    case 'valide':
      script = null;
      corps = `${titre('Bienvenue dans l\'Elite !')}
      <div class="carte">
        <p>Ta candidature est validée.</p>
        ${paye ? '<p class="ok" style="margin:0">Ton intégration est confirmée. Bob t\'a envoyé la suite sur Discord.</p>'
          : `<p class="doux" style="margin-bottom:0">Confirme ton intégration en réglant l'accompagnement. Choisis ton moyen de paiement : le prix est le même.</p>
             <a class="bouton" href="${echapper(lienPaiement)}">Payer par mobile money</a>
             ${o.lienCarte ? `<a class="bouton" href="${echapper(o.lienCarte)}">Payer par carte bancaire</a>` : ''}`}
      </div>`;
      break;
    default:
      corps = titre('Candidature');
  }
  return gabarit('Candidature', `${message ? `<p class="erreur-form">${echapper(message)}</p>` : ''}${corps}
  <a class="bouton secondaire" href="/deconnexion">Se déconnecter</a>`, script && !apercu ? { script } : {});
}

// /admin/candidatures : réponses, vidéos et décisions.
const LIBELLES_CANDIDATURE = { formulaire: 'Formulaire à remplir', examen: 'À examiner', retenu: 'Retenu, vidéo attendue', video: 'Vidéo à regarder', refuse: 'Refusé', valide: 'Validé' };
const DECISIONS_CANDIDATURE = { examen: ['retenir', 'refuser'], video: ['valider', 'refuser'], retenu: ['refuser'] };
const NOMS_DECISION = { retenir: 'Retenir', refuser: 'Refuser', valider: 'Valider' };

function carteCandidature(c, { fiche = false } = {}) {
  const liste = (rep) => `<dl class="details">${rep.map((r) => `<div><dt>${echapper(r.label)}</dt><dd>${echapper(r.valeur)}</dd></div>`).join('')}</dl>`;
  const decisions = DECISIONS_CANDIDATURE[c.statut] || [];
  return `
    <div class="carte">
      <p class="etiquette">${echapper(LIBELLES_CANDIDATURE[c.statut] || c.statut)} · ${echapper(new Date(c.maj_le).toLocaleDateString('fr-FR'))}</p>
      <h2>${fiche ? echapper(c.pseudo || c.discord_id) : `<a href="/admin/candidatures/${c.id}" style="text-decoration:none">${echapper(c.pseudo || c.discord_id)} →</a>`}</h2>
      ${c.reponses.length ? liste(c.reponses) : ''}
      ${c.reponsesConfirmation && c.reponsesConfirmation.length ? `<p class="etiquette" style="margin-top:14px">Formulaire de confirmation</p>${liste(c.reponsesConfirmation)}` : ''}
      ${c.video_fichier ? `<video controls preload="metadata" playsinline src="/admin/videos/${c.id}" style="width:100%;max-height:70vh;border-radius:14px;margin-top:12px;background:#000"></video>` : ''}
      ${decisions.length ? `<div style="display:flex;gap:10px">${decisions.map((d) => `<form method="post" action="/admin/candidatures/${c.id}/${d}" style="flex:1">
        ${fiche ? '<input type="hidden" name="retour" value="fiche">' : ''}
        <button class="bouton${d === 'refuser' ? ' secondaire' : ''}" type="submit">${NOMS_DECISION[d]}</button></form>`).join('')}</div>` : ''}
    </div>`;
}

// Liste compacte : une ligne par candidat, et « Inspecter » ouvre ses réponses et les décisions.
const nomCandidat = (c) => {
  const r = (c.reponses || []).find((x) => /nom/i.test(x.label) && !/discord|pseudo/i.test(x.label)) || (c.reponses || [])[0];
  return (r && r.valeur) || c.pseudo || c.discord_id;
};
const COULEUR_STATUT = { examen: 'attente', video: 'attente', retenu: 'neutre', valide: 'valide', refuse: 'corriger', formulaire: 'neutre' };
function pageAdminCandidatures(config, { liste, espace }) {
  const lignes = liste.map((c) => `<tr>
    <td>Candidature Elite</td>
    <td><b>${echapper(nomCandidat(c))}</b><br><span class="doux">${echapper(c.pseudo || c.discord_id)}</span></td>
    <td><span class="statut-cand" data-etat="${COULEUR_STATUT[c.statut] || 'neutre'}">${echapper(LIBELLES_CANDIDATURE[c.statut] || c.statut)}</span></td>
    <td>${echapper(new Date(c.maj_le).toLocaleDateString('fr-FR'))}</td>
    <td style="text-align:right"><a class="bouton secondaire" style="width:auto;min-height:36px;margin:0;padding:7px 16px;display:inline-flex" href="/admin/candidatures/${c.id}">Inspecter</a></td></tr>`).join('');
  return pageEspace('Candidatures', `
  <style>.statut-cand { display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface-2); color:var(--doux); white-space:nowrap; }
    .statut-cand[data-etat="attente"] { background:rgba(241,211,138,.12); color:#f1d38a; }
    .statut-cand[data-etat="valide"] { background:rgba(61,220,132,.14); color:var(--ok); }
    .statut-cand[data-etat="corriger"] { background:rgba(255,77,77,.12); color:var(--erreur); }
    table.candidatures td { vertical-align:middle; }</style>
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Candidatures Elite</h1></div><span class="doux petit">${liste.length} candidature(s)</span></div>
  <div class="carte"><div class="defile"><table class="membres candidatures">
    <tr><th>Formulaire</th><th>Nom</th><th>Statut</th><th>Mise à jour</th><th></th></tr>
    ${lignes || '<tr><td colspan="5" class="doux">Aucune candidature pour l\'instant.</td></tr>'}
  </table></div></div>`, espace, 'candidatures');
}

// /admin/candidatures/:id : la fiche d'un candidat (lien envoyé par Bob).
function pageAdminCandidature(config, { candidature, espace, message }) {
  const c = candidature;
  const etapes = [['Formulaire', ['examen', 'retenu', 'video', 'valide', 'refuse']], ['Retenu', ['retenu', 'video', 'valide']], ['Vidéo', ['video', 'valide']], ['Validé', ['valide']]];
  const frise = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px">${etapes.map(([n, ok]) => `<span class="petit-bouton" style="${ok.includes(c.statut) ? 'background:#fff;color:#000;border-color:#fff' : ''}">${n}</span>`).join('')}${c.statut === 'refuse' ? '<span class="petit-bouton" style="border-color:var(--erreur);color:var(--erreur)">Refusé</span>' : ''}</div>`;
  return pageEspace(`Candidature ${c.pseudo || ''}`, `
  <a class="retour" href="/admin/candidatures"><span aria-hidden="true">‹</span> Toutes les candidatures</a>
  <div class="titre-page"><div><p class="etiquette">Candidature Elite</p><h1>${echapper(c.pseudo || c.discord_id)}</h1></div></div>
  ${message ? `<p class="ok">${echapper(message)}</p>` : ''}
  ${frise}
  <div style="max-width:760px">${carteCandidature(c, { fiche: true })}
    <form method="post" action="/admin/candidatures/${c.id}/supprimer" onsubmit="return confirm('Supprimer cette candidature ? La personne pourra recommencer depuis le début.')">
      <button class="bouton secondaire" type="submit" style="border-color:var(--erreur);color:var(--erreur)">Supprimer la candidature (recommencer)</button>
    </form>
  </div>`, espace, 'candidatures');
}

// /admin/membres : tous les membres dans une seule liste ; le moyen de paiement est une colonne parmi d'autres.
function pageAdminMembres(config, { membres, cartes = [], progression = {}, totalLecons = 0, fiches = new Set(), espace }) {
  // Les membres Elite qui ont un parcours : leur nom ouvre leur fiche.
  const avecFiche = (id, html) => (id && fiches.has(id) ? `<a href="/admin/membres/${encodeURIComponent(id)}" style="color:#fff">${html}</a>` : html);
  const maintenant = new Date();
  const offre = (prog) => (config.offres[prog] ? config.offres[prog].nom.replace('Overmaxx ', '') : prog);
  const formation = (m) => {
    const p = m.whop_user_id && progression[m.whop_user_id];
    if (!m.whop_user_id || !totalLecons) return '<span class="doux">—</span>';
    if (!p) return '<span class="doux">Pas commencé</span>';
    return `${p.terminees} / ${p.total || totalLecons}<br><span class="doux">${echapper(formatDate(p.derniere))}</span>`;
  };
  const statutMobile = (m) => {
    if (m.statut !== 'actif') return [3, '<span class="erreur-form">Expiré</span>'];
    if (new Date(m.acces_jusqu_au) > maintenant) return [0, '<span class="ok">Actif</span>'];
    return m.programme === 'elite' ? [1, '<span class="doux">90 jours terminés</span>'] : [2, '<span style="color:#f1d38a">En attente</span>'];
  };
  const statutCarte = (c) => (c.termine_le ? [3, '<span class="erreur-form">Terminé</span>']
    : c.perdu_le ? [2, `<span style="color:#f1d38a">Carte arrêtée le ${echapper(formatDate(c.perdu_le))}</span>`] : [0, '<span class="ok">Actif</span>']);
  const lignes = [
    ...membres.map((m) => {
      const [ordre, statut] = statutMobile(m);
      return { ordre, nom: m.nom, html: `<tr>
        <td>${avecFiche(m.discord_id, `<b>${echapper(m.nom)}</b>`)}<br><span class="doux">${echapper(m.email)}</span></td>
        <td>${echapper(m.discord_pseudo || '—')}</td>
        <td>${echapper(offre(m.programme))}</td>
        <td>Mobile money</td>
        <td>${statut}</td>
        <td>${echapper(formatDate(m.acces_jusqu_au))}</td>
        <td>${m.programme === 'elite' ? '<span class="doux">Paiement unique</span>' : m.prix_renouvellement ? echapper(formatPrix(m.prix_renouvellement, m.devise || config.devise).texte) : '—'}</td>
        <td>${m.whop_membership_id ? 'Oui' : '<span class="doux">Non</span>'}</td>
        <td>${formation(m)}</td></tr>` };
    }),
    ...cartes.map((c) => {
      const [ordre, statut] = statutCarte(c);
      return { ordre, nom: c.pseudo || c.discord_id, html: `<tr>
        <td>${avecFiche(c.discord_id, `<b>${echapper(c.pseudo || c.discord_id)}</b>`)}<br><span class="doux">depuis le ${echapper(formatDate(c.depuis))}</span></td>
        <td>${echapper(c.pseudo || '—')}</td>
        <td>${echapper(offre(c.programme))}</td>
        <td>${c.source === 'main' ? 'Donné à la main' : 'Carte (Whop)'}</td>
        <td>${statut}</td>
        <td><span class="doux">${c.source === 'main' ? 'tant qu\'il a le rôle' : 'géré par Whop'}</span></td>
        <td><span class="doux">${c.source === 'main' ? '—' : c.programme === 'elite' ? 'Paiement unique' : 'Carte'}</span></td>
        <td>${c.source === 'main' ? '<span class="doux">—</span>' : 'Oui'}</td>
        <td><span class="doux">—</span></td></tr>` };
    }),
  ].sort((a, b) => a.ordre - b.ordre || String(a.nom).localeCompare(String(b.nom), 'fr'));
  return pageEspace('Membres', `
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Membres</h1></div><span class="doux petit">${lignes.length} membre(s)</span></div>
  <div class="carte"><div class="defile"><table class="membres">
    <tr><th>Membre</th><th>Discord</th><th>Offre</th><th>Paiement</th><th>Statut</th><th>Fin d'accès</th><th>Renouvellement</th><th>Whop</th><th>Formation</th></tr>
    ${lignes.map((l) => l.html).join('') || '<tr><td colspan="9" class="doux">Aucun membre pour l\'instant.</td></tr>'}
  </table></div></div>`, espace, 'membres');
}

// /admin/pages : tous les liens du site, un par un. Les aperçus utilisent des données d'exemple (rien n'est enregistré).
function pageAdminPages(config, { espace }) {
  const video = (id, nom) => (id ? '<span class="ok">vidéo réglée</span>' : `<span style="color:#f1d38a">vidéo à ajouter</span> <code>${nom}</code>`);
  const groupes = [
    ['Pages publiques', [
      ['/', 'Accueil', 'La seule page ouverte à tous : Se connecter à Overmaxx, puis Rejoindre le Discord (avec le réglage qui permet à Bob d\'écrire).', video(config.wistiaAccueil, 'WISTIA_ACCUEIL')],
      ['/community', 'Community', 'Présentation et prix de la Community.'],
      ['/community/paiement', 'Paiement Community', 'Nom, email, puis paiement mobile money.'],
      ['/community/renouveler', 'Renouvellement Community', 'Sans lien personnel : l\'email est demandé.'],
      ['/admin/apercu/candidature', 'Candidature Elite', 'Vidéo de présentation puis formulaire 1 (aperçu : le coach ne postule pas).', video(config.offres.elite.wistiaVsl, 'WISTIA_VSL_ELITE')],
    ]],
    ['Aperçus (exemples, rien n\'est enregistré)', [
      ['/admin/apercu/guide-community', 'Après paiement Community', 'Guide d\'accès : vidéo, Discord, Whop.', video(config.offres.community.wistiaGuide, 'WISTIA_GUIDE_COMMUNITY')],
      ['/admin/apercu/guide-elite', 'Après paiement Elite', 'Guide d\'accès Elite.', video(config.offres.elite.wistiaGuide, 'WISTIA_GUIDE_ELITE')],
      ['/admin/apercu/candidature-examen', 'Candidature en examen', 'Ce que voit le candidat après le formulaire 1.'],
      ['/admin/apercu/candidature-retenu', 'Candidat retenu', 'Formulaire 2 (vidéo).'],
      ['/admin/apercu/candidature-video', 'Vidéo reçue', 'En attente de la réponse finale.'],
      ['/admin/apercu/candidature-valide', 'Candidature validée', 'Choix mobile money ou carte.'],
      ['/admin/apercu/candidature-refuse', 'Candidature refusée', ''],
      ['/admin/apercu/paiement-elite', 'Paiement Elite (mobile money)', 'Page du lien personnel, avec « Payer plutôt par carte ».'],
    ]],
    ['Parcours Elite (tutos des étapes)', [
      ['/admin/a-traiter', 'À traiter', 'Envois des membres à valider, étapes à ouvrir, retards.'],
      ['/admin/membres', 'Fiches des membres Elite', 'Depuis Membres : le nom d\'un membre Elite ouvre sa fiche.'],
      ['/admin/a-traiter', 'Tuto de l\'étape 1', 'Affiché en haut de l\'étape 1 du membre.', video(config.offres.elite.wistiaEtape1, 'WISTIA_ETAPE_1')],
      ['/admin/a-traiter', 'Tuto de l\'étape 2', 'Affiché en haut de l\'étape 2.', video(config.offres.elite.wistiaEtape2, 'WISTIA_ETAPE_2')],
      ['/admin/a-traiter', 'Tuto de l\'étape 3', 'Affiché en haut de l\'étape 3.', video(config.offres.elite.wistiaEtape3, 'WISTIA_ETAPE_3')],
    ]],
    ['Membres et gestion', [
      ['/admin/apercu/coaching', 'Coachings d\'un membre', 'La grille de réservation, telle qu\'un membre Elite la voit (aperçu).'],
      ['/admin', 'Calendrier', ''],
      ['/admin/candidatures', 'Candidatures', ''],
      ['/admin/membres', 'Membres', ''],
    ]],
  ];
  const lignes = (liste) => liste.map(([lien, titre, desc, extra]) => `
    <li><div style="flex:1;min-width:0"><b>${echapper(titre)}</b>
      <div class="doux petit">${echapper(config.baseUrl.replace(/^https?:\/\//, ''))}${echapper(lien)}</div>
      ${desc ? `<div class="doux petit">${echapper(desc)}</div>` : ''}${extra ? `<div class="petit">${extra}</div>` : ''}</div>
      <a class="bouton secondaire" style="width:auto;min-height:38px;margin:0;padding:8px 16px;flex:none" href="${echapper(lien)}" target="_blank" rel="noopener">Ouvrir</a></li>`).join('');
  return pageEspace('Pages du site', `
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Pages du site</h1></div></div>
  ${groupes.map(([titre, liste]) => `<div class="carte"><h2>${echapper(titre)}</h2><ul class="liste">${lignes(liste)}</ul></div>`).join('')}`, espace, 'pages');
}

module.exports = { navEspace, pageEspace, pageAdminPages, pageConnexionRequise, pageConnexionEnvoyee, pageEliteCandidature, pageConfirmation, pageCandidature, pageAdminCandidatures, pageAdminCandidature, pageAdminMembres };
