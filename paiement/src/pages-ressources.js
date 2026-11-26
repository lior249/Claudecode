'use strict';

// Pages Ressources (élèves et coach) : niches, méthodes pour 10K abonnés, tutoriels et astuces.
// Liste façon Discord (miniature à gauche, titre en gras), fiche avec ses images, ses liens et ses étapes.
const { echapper } = require('./pages');
const { page, texteRiche } = require('./pages-parcours');
const { TYPES, PAYS, DRAPEAUX, POUR, MAX_IMAGES } = require('./ressources');
const { aliasCompte } = require('./tiktok');
const { ICONE } = require('./pages');

const STYLE = `<style>
  .rs-onglets { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; padding:4px; border-radius:999px; background:var(--surface-2,#151515); margin:0 0 14px; max-width:720px; }
  .rs-onglets a { padding:10px 6px; border-radius:999px; color:var(--doux); font-weight:700; font-size:13.5px; text-decoration:none; text-align:center; }
  .rs-onglets a[aria-current] { background:#fff; color:#000; }
  .rs-liste { display:grid; gap:8px; max-width:720px; }
  .rs-ligne { display:flex; gap:12px; align-items:center; padding:10px; border-radius:16px; background:#111; border:1px solid #232323; color:#fff; text-decoration:none; }
  .rs-ligne:hover { background:#161616; }
  .rs-mini { flex:none; width:84px; height:84px; border-radius:12px; background:#1c1c1c center/cover no-repeat; display:grid; place-items:center; font-size:30px; }
  .rs-texte { min-width:0; flex:1; display:grid; gap:3px; }
  .rs-texte b.rs-titre { font-size:15.5px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rs-texte p { margin:0; color:#a9a9a9; font-size:13.5px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .rs-likes { flex:none; align-self:flex-start; font-weight:700; font-size:13px; color:#ff6b8b; }
  .rs-puces { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; }
  .rs-puce { font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:999px; border:1px solid #333; color:#ddd; }
  .rs-puce.orange { border-color:#6b4316; color:#ffb26b; } .rs-puce.rouge { border-color:#7a1d1d; color:#ff8f8f; }
  .rs-galerie { display:grid; gap:8px; margin:0 0 14px; max-width:720px; }
  .rs-galerie .principale img { width:100%; max-height:420px; object-fit:contain; border-radius:16px; background:#111; display:block; }
  .rs-galerie .autres { display:flex; gap:8px; overflow-x:auto; } .rs-galerie .autres img { width:96px; height:96px; object-fit:cover; border-radius:12px; display:block; }
  .rs-champ-liens a { display:block; color:#fff; overflow-wrap:anywhere; padding:3px 0; }
  .rs-etapes { list-style:none; counter-reset:etape; padding:0; margin:0; display:grid; gap:10px; }
  .rs-etapes li { counter-increment:etape; display:grid; grid-template-columns:30px 1fr; gap:10px; align-items:start; }
  .rs-etapes li::before { content:counter(etape); width:30px; height:30px; border-radius:50%; background:#c8f23a; color:#000; font-weight:800; display:grid; place-items:center; }
  .rs-etapes a { color:#c8f23a; overflow-wrap:anywhere; }
  .rs-pays { display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; }
  .rs-pays label { display:flex; gap:8px; align-items:center; padding:8px 10px; border:1px solid #2a2a2a; border-radius:12px; margin:0; font-weight:600; cursor:pointer; }
  .rs-pays input { width:18px; height:18px; margin:0; accent-color:#c8f23a; }
  .rs-aimer { display:inline-flex; align-items:center; gap:8px; width:auto !important; margin:0 !important; padding-left:20px; padding-right:20px; }
  .rs-aimer[data-aime] { background:#ff3b6b; color:#fff; border-color:#ff3b6b; }
  .rs-defs { display:grid; gap:12px; margin:0; } .rs-defs dt { color:var(--doux); font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; } .rs-defs dd { margin:2px 0 0; }
  .rs-multi { display:grid; gap:8px; } .rs-multi .rs-ligne-champ { display:flex; gap:8px; }
  .rs-multi .rs-ligne-champ button { flex:none; width:44px; border-radius:12px; border:1px solid #333; background:transparent; color:#ff8f8f; font:600 18px var(--police); cursor:pointer; }
  .rs-ajouter { justify-self:start; width:auto !important; margin:0 !important; padding-left:16px; padding-right:16px; }
  .rs-etape-champ { display:grid; gap:6px; padding:12px; border:1px solid #262626; border-radius:14px; position:relative; }
  .rs-etape-champ b { font-size:13px; color:#c8f23a; } .rs-etape-champ button.retirer { position:absolute; top:8px; right:8px; border:0; background:transparent; color:#ff8f8f; font:600 18px var(--police); cursor:pointer; }
</style>`;

const nomCategorie = (type, c) => ((TYPES[type].categories.find(([k]) => k === c) || [])[1]) || '';
const nomPour = (c) => ((POUR.find(([k]) => k === c) || [])[1]) || '';
const usd = (n) => (n === null || n === undefined ? '?' : `$${Number(n).toFixed(2)}`);
const plageRpm = (r) => (r.rpm_min === null && r.rpm_max === null ? '' : `${usd(r.rpm_min)} – ${usd(r.rpm_max)}`);
const rpm = (r) => (plageRpm(r) ? `RPM ${plageRpm(r)}` : '');
const drapeaux = (pays) => pays.map((p) => DRAPEAUX[p] || '').join(' ');
const titreDe = (r) => r.titre || `Méthode ${nomCategorie('methode', r.categorie).toLowerCase()}${r.pour ? ` · ${nomPour(r.pour)}` : ''}`;
const etatPuce = (r) => (r.etat === 'attente' ? '<span class="rs-puce orange">En attente du coach</span>' : r.etat === 'refuse' ? '<span class="rs-puce rouge">Refusée : à corriger</span>' : '');
const EMOJI = { niche: '🎯', methode: '🚀', tutoriel: '💡' };
const img = (n) => `/fichiers/images/${encodeURIComponent(n)}`;

// Une ressource dans la liste : miniature (sa première image), titre en gras, aperçu, puces.
function ligne(r, aimees) {
  const puces = [nomCategorie(r.type, r.categorie), r.type === 'methode' && r.pour ? `Meilleure pour ${nomPour(r.pour)}` : '', r.type === 'niche' ? rpm(r) : '',
    r.type === 'tutoriel' && r.etapes.length ? `${r.etapes.length} étape${r.etapes.length > 1 ? 's' : ''}` : '']
    .filter(Boolean).map((x) => `<span class="rs-puce">${echapper(x)}</span>`).join('');
  return `<a class="rs-ligne" href="/ressources/${r.id}">
    <span class="rs-mini"${r.images[0] ? ` style="background-image:url('${img(r.images[0])}')"` : ''}>${r.images[0] ? '' : EMOJI[r.type]}</span>
    <span class="rs-texte"><b class="rs-titre">${echapper(titreDe(r))}</b>
      ${r.description ? `<p>${echapper(r.description.replace(/\*\*|__|\*/g, ''))}</p>` : ''}
      <span class="rs-puces">${puces}${r.type === 'niche' && r.pays.length ? `<span class="rs-puce">${drapeaux(r.pays)}</span>` : ''}${etatPuce(r)}</span></span>
    <span class="rs-likes">${aimees.has(r.id) ? '♥' : '♡'} ${r.likes}</span></a>`;
}

function pageRessources(config, { espace, type, liste, aimees, coach, message }) {
  const t = TYPES[type];
  const onglets = `<nav class="rs-onglets" aria-label="Ressources">${Object.entries(TYPES).map(([k, v]) => `<a href="/ressources?type=${k}"${k === type ? ' aria-current="page"' : ''}>${v.nom}</a>`).join('')}</nav>`;
  return page('Ressources', `${STYLE}
  <div class="titre-page"><div><p class="etiquette">${coach ? 'Gestion' : 'Mon accompagnement'}</p><h1>Ressources</h1></div><span class="doux petit">${liste.filter((r) => r.etat === 'public').length} ${t.nom.toLowerCase()}</span></div>
  ${onglets}
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}
  <a class="bouton" href="/ressources/nouvelle?type=${type}" style="max-width:720px;margin:0 0 14px">+ ${coach ? 'Ajouter' : 'Proposer'} ${t.un}</a>
  ${coach ? '<a class="bouton secondaire" href="/admin/ressources/import" style="max-width:720px;margin:-4px 0 14px">📥 Importer un ancien forum Discord</a>' : ''}
  ${coach ? '' : '<p class="doux petit" style="max-width:720px;margin:-6px 0 14px">Ta proposition est relue par le coach avant d\'être visible par tous. Tu peux la modifier tant qu\'elle n\'est pas validée.</p>'}
  <div class="rs-liste">${liste.map((r) => ligne(r, aimees)).join('') || '<p class="vide-traiter">Rien pour le moment.</p>'}</div>`, espace, 'ressources');
}

const liensListe = (titre, l) => (l.length ? `<div><dt>${titre}</dt><dd class="rs-champ-liens">${l.map((x) => `<a href="${echapper(x)}" target="_blank" rel="noopener">${echapper(/tiktok\.com\/@/.test(x) ? aliasCompte(x) : x)}</a>`).join('')}</dd></div>` : '');

function pageRessource(config, { espace, r, aime, coach, peutModifier, auteur, message, erreur }) {
  const t = TYPES[r.type];
  const galerie = r.images.length ? `<div class="rs-galerie">
    <a class="principale" href="${img(r.images[0])}" target="_blank" rel="noopener"><img src="${img(r.images[0])}" alt="Exemple : ${echapper(titreDe(r))}"></a>
    ${r.images.length > 1 ? `<div class="autres">${r.images.slice(1).map((n) => `<a href="${img(n)}" target="_blank" rel="noopener"><img src="${img(n)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}</div>` : '';
  const defs = [
    r.description ? `<div><dt>${r.type === 'niche' ? 'Sujet' : 'Explication'}</dt><dd>${texteRiche(r.description)}</dd></div>` : '',
    `<div><dt>${r.type === 'niche' ? 'Type de contenu' : 'Type'}</dt><dd>${echapper(nomCategorie(r.type, r.categorie))}</dd></div>`,
    r.type === 'methode' ? `<div><dt>Meilleure pour</dt><dd>${r.pour ? echapper(nomPour(r.pour)) : '<span class="doux">Pas encore décidé par le coach</span>'}</dd></div>` : '',
    r.type === 'niche' && r.pays.length ? `<div><dt>Pays recommandés</dt><dd>${r.pays.map((p) => `${DRAPEAUX[p] || ''} ${echapper(p)}`).join(' · ')}</dd></div>` : '',
    r.type === 'niche' && plageRpm(r) ? `<div><dt>RPM</dt><dd>${echapper(plageRpm(r))}</dd></div>` : '',
    r.etapes.length ? `<div><dt>Étapes</dt><dd><ol class="rs-etapes" style="margin-top:8px">${r.etapes.map((e) => `<li><div>${e.texte ? texteRiche(e.texte) : ''}${e.lien ? `${e.texte ? '<br>' : ''}<a href="${echapper(e.lien)}" target="_blank" rel="noopener">${echapper(e.lien)}</a>` : ''}</div></li>`).join('')}</ol></dd></div>` : '',
    r.lien ? `<div><dt>Lien</dt><dd class="rs-champ-liens"><a href="${echapper(r.lien)}" target="_blank" rel="noopener">${echapper(r.lien)}</a></dd></div>` : '',
    liensListe('Comptes exemples', r.exemples),
    r.type === 'niche' ? liensListe('Contre-exemples (à ne pas faire)', r.contre_exemples) : '',
    r.type === 'niche' ? liensListe('Comptes sources (L1)', r.sources) : '',
  ].join('');
  return page(titreDe(r), `${STYLE}
  <a class="retour" href="/ressources?type=${r.type}"><span aria-hidden="true">‹</span> ${t.nom}</a>
  <div class="titre-page"><div><p class="etiquette">${echapper(t.nom)}${auteur ? ` · proposée par ${echapper(auteur)}` : ''}</p><h1>${echapper(titreDe(r))}</h1></div>${etatPuce(r)}</div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${r.etat === 'refuse' && r.motif ? `<div class="carte" style="max-width:720px;border-color:#7a1d1d"><b>Motif du coach</b><p style="margin:6px 0 0">${texteRiche(r.motif)}</p></div>` : ''}
  ${galerie}
  <div class="carte" style="max-width:720px"><dl class="rs-defs">${defs}</dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${r.etat === 'public' ? `<form method="post" action="/ressources/${r.id}/aimer" style="margin:0"><button class="bouton secondaire rs-aimer" type="submit"${aime ? ' data-aime' : ''}>${aime ? '♥' : '♡'} ${r.likes}</button></form>` : ''}
      ${peutModifier ? `<a class="bouton secondaire" href="/ressources/${r.id}/modifier" style="width:auto;margin:0;padding-left:20px;padding-right:20px">Modifier</a>` : ''}
    </div></div>
  ${coach && r.etat === 'attente' ? `<form class="carte" method="post" action="/admin/ressources/${r.id}/decision" style="display:grid;gap:10px;max-width:720px">
    <h2 style="margin:0">Ta décision</h2>
    <p class="doux petit" style="margin:0">Valider la rend visible par tous les élèves. Tu peux d'abord la modifier (par exemple « meilleure pour L1 / L2 »).</p>
    <textarea name="motif" placeholder="Si tu refuses : ce qu'il doit corriger."></textarea>
    <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="refuser">Refuser</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div></form>` : ''}
  ${!coach ? `<details class="carte" style="max-width:720px"><summary style="cursor:pointer;font-weight:700">✉️ Une remarque sur cette ressource ?</summary>
    <form method="post" action="/ressources/${r.id}/remarque" style="display:grid;gap:10px;margin-top:10px">
      <textarea name="texte" maxlength="2000" required placeholder="Un lien mort, une info à corriger, une question… Le coach la reçoit."></textarea>
      <button class="bouton" type="submit" style="margin:0">Envoyer au coach</button></form></details>` : ''}`, espace, 'ressources');
}

// Liens ajoutés un par un : « + Ajouter un lien » ouvre un champ ; × le retire.
function champLiens(nom, label, valeurs, aide) {
  const ligneChamp = (v) => `<div class="rs-ligne-champ"><input name="${nom}" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" value="${echapper(v)}" placeholder="https://www.tiktok.com/@compte"><button type="button" data-retirer aria-label="Retirer ce lien">×</button></div>`;
  return `<div class="champ"><label>${label}</label>${aide ? `<small style="margin:0 0 6px">${aide}</small>` : ''}
    <div class="rs-multi" data-multi="${nom}">${valeurs.map(ligneChamp).join('')}
      <button class="bouton secondaire rs-ajouter" type="button" data-ajouter>+ Ajouter un lien</button></div>
    <template data-modele="${nom}">${ligneChamp('')}</template></div>`;
}
function champEtapes(etapes) {
  const bloc = (e) => `<div class="rs-etape-champ"><b>Étape</b><button type="button" class="retirer" data-retirer aria-label="Retirer cette étape">×</button>
    <textarea name="etape_texte" rows="2" placeholder="Ce qu'il faut faire, ex. Regarde ce tuto et applique-le sur ta prochaine vidéo.">${echapper(e.texte || '')}</textarea>
    <input name="etape_lien" inputmode="url" autocapitalize="none" value="${echapper(e.lien || '')}" placeholder="Lien du tuto (facultatif) : https://…"></div>`;
  return `<div class="champ"><label>Étapes</label><small style="margin:0 0 6px">Dans l'ordre : chaque étape a son explication et, si besoin, le lien du tuto à suivre.</small>
    <div class="rs-multi" data-multi="etapes">${(etapes.length ? etapes : [{}]).map(bloc).join('')}
      <button class="bouton secondaire rs-ajouter" type="button" data-ajouter>+ Ajouter une étape</button></div>
    <template data-modele="etapes">${bloc({})}</template></div>`;
}
const SCRIPT_FORM = `(function () {
  document.querySelectorAll('[data-multi]').forEach(function (z) {
    var modele = document.querySelector('template[data-modele="' + z.getAttribute('data-multi') + '"]'), ajouter = z.querySelector('[data-ajouter]');
    function brancher(el) { var b = el.querySelector('[data-retirer]'); if (b) b.onclick = function () { el.remove(); }; }
    Array.prototype.forEach.call(z.children, function (el) { if (el !== ajouter) brancher(el); });
    ajouter.onclick = function () {
      var el = modele.content.firstElementChild.cloneNode(true); z.insertBefore(el, ajouter); brancher(el);
      var champ = el.querySelector('input, textarea'); if (champ) champ.focus();
    };
  });
  // Étapes numérotées dans l'ordre.
  var form = document.querySelector('form[data-ressource]');
  if (form) form.addEventListener('submit', function () {
    form.querySelectorAll('.rs-multi input[name]').forEach(function (i) { if (!i.value.trim() && i.name !== 'etape_lien') i.disabled = true; });
  });
})();`;

function pageFormRessource(config, { espace, type, r = null, coach, erreur, valeurs = {} }) {
  const t = TYPES[type];
  const val = (k, def = '') => (valeurs[k] !== undefined ? valeurs[k] : r && r[k] !== null && r[k] !== undefined ? r[k] : def);
  const v = (k) => echapper([].concat(val(k)).join('\n'));
  const liste = (k) => [].concat(val(k, [])).flatMap((x) => String(x).split('\n')).map((x) => x.trim()).filter(Boolean);
  const choisi = (k, x) => [].concat(val(k, [])).flatMap((y) => String(y).split(',')).includes(x);
  const radios = (nom, options) => `<div class="rs-pays">${options.map(([c, l]) => `<label><input type="radio" name="${nom}" value="${c}"${choisi(nom, c) ? ' checked' : ''}> ${echapper(l)}</label>`).join('')}</div>`;
  const images = valeurs.images !== undefined ? String(valeurs.images).split(',').filter(Boolean) : r ? r.images : [];
  const etapes = valeurs.etape_texte !== undefined
    ? [].concat(valeurs.etape_texte).map((x, i) => ({ texte: x, lien: [].concat(valeurs.etape_lien || [])[i] || '' })) : r ? r.etapes : [];
  const action = r ? `/ressources/${r.id}/modifier` : `/ressources/nouvelle?type=${type}`;
  const verbe = r ? 'Modifier' : coach ? 'Ajouter' : 'Proposer';
  return page(`${verbe} ${t.un}`, `${STYLE}
  <a class="retour" href="${r ? `/ressources/${r.id}` : `/ressources?type=${type}`}"><span aria-hidden="true">‹</span> ${r ? 'Retour' : t.nom}</a>
  <div class="titre-page"><div><p class="etiquette">${t.nom}</p><h1>${verbe} ${t.un}</h1></div></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <form class="carte" method="post" action="${action}" data-ressource style="display:grid;gap:14px;max-width:720px">
    <input type="hidden" name="type" value="${type}">
    <div class="champ"><label for="titre">${type === 'niche' ? 'Nom de la niche' : type === 'methode' ? 'Nom (facultatif)' : 'Titre'}</label>
      <input id="titre" name="titre" maxlength="100" value="${v('titre')}"${type === 'methode' ? '' : ' required'} placeholder="${type === 'niche' ? 'ex. Faits historiques' : type === 'methode' ? 'Tu peux le laisser vide' : 'ex. Couper au bon moment'}"></div>
    <div class="champ"><label>Images (${MAX_IMAGES} au plus)</label><small style="margin:0 0 6px">La première est la miniature : une capture d'un compte exemple, pour qu'on s'y retrouve. Les autres montrent à quoi ressemble le contenu.</small>
      <div data-images="${coach ? '/admin/images' : '/api/parcours/image'}" data-max="${MAX_IMAGES}">
        <label class="fichier">${ICONE.plus}<span><b>Ajouter des images</b><br>Captures d'écran</span><input type="file" accept="image/*" multiple hidden></label>
        <input type="hidden" name="images" value="${echapper(images.join(','))}"><div class="apercus" style="margin-top:10px"></div></div></div>
    <div class="champ"><label for="description">${type === 'niche' ? 'Sujet' : 'Explication'}</label>
      <textarea id="description" name="description" maxlength="3000"${type === 'niche' ? ' required' : ''} placeholder="${type === 'niche' ? 'De quoi parlent les vidéos de cette niche ?' : type === 'tutoriel' ? 'L\'astuce en quelques mots : à quoi elle sert.' : 'Comment ça marche.'}">${v('description')}</textarea></div>
    <div class="champ"><label>${type === 'niche' ? 'Type de contenu' : 'Type'}</label>${radios('categorie', t.categories)}</div>
    ${type === 'methode' && coach ? `<div class="champ"><label>Meilleure pour</label>${radios('pour', POUR)}<small>Toi seul le décides.</small></div>` : ''}
    ${type === 'niche' ? `<div class="champ"><label>Pays recommandés</label><div class="rs-pays">${PAYS.map((p) => `<label><input type="checkbox" name="pays" value="${echapper(p)}"${choisi('pays', p) ? ' checked' : ''}> ${DRAPEAUX[p]} ${echapper(p)}</label>`).join('')}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="champ"><label for="rpm_min">RPM minimum ($)</label><input id="rpm_min" name="rpm_min" inputmode="decimal" value="${v('rpm_min')}" placeholder="ex. 0.40"></div>
      <div class="champ"><label for="rpm_max">RPM maximum ($)</label><input id="rpm_max" name="rpm_max" inputmode="decimal" value="${v('rpm_max')}" placeholder="ex. 1.20"></div></div>` : ''}
    ${type === 'tutoriel' ? champEtapes(etapes) : ''}
    ${champLiens('exemples', 'Comptes exemples', liste('exemples'), type === 'tutoriel' ? 'Facultatif.' : '')}
    ${type === 'niche' ? `${champLiens('contre_exemples', 'Contre-exemples', liste('contre_exemples'), 'Des comptes qui font ce qu\'il ne faut pas faire.')}
      ${champLiens('sources', 'Comptes sources (pour le L1)', liste('sources'), 'Les comptes d\'où viennent les vidéos à reposter en mieux.')}` : ''}
    <button class="bouton" type="submit" style="margin:0">${r ? 'Enregistrer' : coach ? 'Publier' : 'Envoyer au coach'}</button>
  </form>`, espace, 'ressources', null, SCRIPT_FORM);
}

// Importer un ancien forum Discord (coach).
function pageImport(config, { espace, invite, lance, erreur }) {
  return page('Importer un forum', `${STYLE}
  <a class="retour" href="/ressources"><span aria-hidden="true">‹</span> Ressources</a>
  <div class="titre-page"><div><p class="etiquette">Ressources</p><h1>Importer un ancien forum</h1></div></div>
  ${lance ? '<p class="message-ok">Import lancé : Bob lit le forum, copie les images, puis poste chaque ressource dans le nouveau forum. Il t\'envoie le bilan quand c\'est fini.</p>' : ''}
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte" style="max-width:720px;display:grid;gap:10px">
    <h2 style="margin:0">1. Invite Bob sur l'ancien serveur</h2>
    <p class="doux" style="margin:0">Il lui faut seulement « Voir les salons » et « Lire l'historique des messages ».</p>
    ${invite ? `<a class="bouton" href="${echapper(invite)}" target="_blank" rel="noopener" style="margin:0">Inviter Bob</a>
      <p class="doux petit" style="margin:0;overflow-wrap:anywhere">${echapper(invite)}</p>` : '<p class="erreur-form" style="margin:0">L\'identifiant de Bob (DISCORD_CLIENT_ID) n\'est pas réglé.</p>'}
    <p class="doux petit" style="margin:0">Si le forum est privé, donne aussi à Bob l'accès à ce forum (Paramètres du salon › Permissions).</p></div>
  <form class="carte" method="post" action="/admin/ressources/import" style="max-width:720px;display:grid;gap:10px">
    <h2 style="margin:0">2. Colle le lien du forum</h2>
    <p class="doux" style="margin:0">Sur Discord : clic droit (ou appui long) sur le forum › <b>Copier le lien</b>.</p>
    <input name="lien" required inputmode="url" placeholder="https://discord.com/channels/…/…">
    <p class="doux petit" style="margin:0">Chaque post devient une ressource publique : 10k Abos → méthode, repost → niche L1, Cmtry → niche L2, le reste → tutoriel.
      « Thématique : … » donne le nom, les drapeaux les pays, les liens TikTok les comptes. Un post déjà importé ne l'est pas deux fois.</p>
    <button class="bouton" type="submit" style="margin:0">Importer</button></form>`, espace, 'ressources');
}

module.exports = { pageImport, pageRessources, pageRessource, pageFormRessource, titreDe };
