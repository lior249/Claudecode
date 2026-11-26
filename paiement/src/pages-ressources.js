'use strict';

// Pages Ressources (élèves et coach) : niches, méthodes pour 10K abonnés, tutoriels.
const { echapper } = require('./pages');
const { page, texteRiche } = require('./pages-parcours');
const { TYPES, PAYS, DRAPEAUX, POUR } = require('./ressources');
const { aliasCompte } = require('./tiktok');

const STYLE = `<style>
  .rs-onglets { display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; padding:4px; border-radius:999px; background:var(--surface-2,#151515); margin:0 0 14px; max-width:640px; }
  .rs-onglets a { padding:10px 6px; border-radius:999px; color:var(--doux); font-weight:700; font-size:13.5px; text-decoration:none; text-align:center; }
  .rs-onglets a[aria-current] { background:#fff; color:#000; }
  .rs-liste { display:grid; gap:10px; max-width:640px; }
  .rs-carte { display:block; position:relative; padding:14px 16px; border-radius:18px; background:#111; border:1px solid #232323; color:#fff; text-decoration:none; }
  .rs-carte h3 { margin:0 70px 4px 0; font-size:16px; } .rs-carte p { margin:0; color:#bdbdbd; font-size:14px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .rs-carte .rs-likes { position:absolute; top:14px; right:16px; font-weight:700; font-size:13.5px; color:#ff6b8b; }
  .rs-puces { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .rs-puce { font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; border:1px solid #333; color:#ddd; }
  .rs-puce.vert { border-color:#4a5a15; color:#c8f23a; } .rs-puce.orange { border-color:#6b4316; color:#ffb26b; } .rs-puce.rouge { border-color:#7a1d1d; color:#ff8f8f; }
  .rs-champ-liens a { display:block; color:#fff; overflow-wrap:anywhere; padding:3px 0; }
  .rs-pays { display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; }
  .rs-pays label { display:flex; gap:8px; align-items:center; padding:8px 10px; border:1px solid #2a2a2a; border-radius:12px; margin:0; font-weight:600; cursor:pointer; }
  .rs-pays input { width:18px; height:18px; margin:0; accent-color:#c8f23a; }
  .rs-aimer { display:inline-flex; align-items:center; gap:8px; width:auto !important; margin:0 !important; padding-left:20px; padding-right:20px; }
  .rs-aimer[data-aime] { background:#ff3b6b; color:#fff; border-color:#ff3b6b; }
  .rs-defs { display:grid; gap:12px; margin:0; } .rs-defs dt { color:var(--doux); font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; } .rs-defs dd { margin:2px 0 0; }
</style>`;

const nomCategorie = (type, c) => ((TYPES[type].categories.find(([k]) => k === c) || [])[1]) || '';
const nomPour = (c) => ((POUR.find(([k]) => k === c) || [])[1]) || '';
const rpm = (r) => (r.rpm_min === null && r.rpm_max === null ? '' : `RPM ${r.rpm_min !== null ? `$${r.rpm_min}` : '?'} – ${r.rpm_max !== null ? `$${r.rpm_max}` : '?'}`);
const drapeaux = (pays) => pays.map((p) => DRAPEAUX[p] || '').join(' ');
const titreDe = (r) => r.titre || `Méthode ${nomCategorie('methode', r.categorie).toLowerCase()}${r.pour ? ` · ${nomPour(r.pour)}` : ''}`;
const etatPuce = (r) => (r.etat === 'attente' ? '<span class="rs-puce orange">En attente du coach</span>' : r.etat === 'refuse' ? '<span class="rs-puce rouge">Refusée : à corriger</span>' : '');

function carte(r, aimees) {
  const puces = [nomCategorie(r.type, r.categorie), r.type === 'methode' && r.pour ? `Meilleure pour ${nomPour(r.pour)}` : '', r.type === 'niche' ? rpm(r) : '']
    .filter(Boolean).map((x) => `<span class="rs-puce">${echapper(x)}</span>`).join('');
  return `<a class="rs-carte" href="/ressources/${r.id}">
    <h3>${echapper(titreDe(r))}</h3><span class="rs-likes">${aimees.has(r.id) ? '♥' : '♡'} ${r.likes}</span>
    ${r.description ? `<p>${echapper(r.description.replace(/\*\*|__|\*/g, ''))}</p>` : ''}
    <div class="rs-puces">${puces}${r.type === 'niche' && r.pays.length ? `<span class="rs-puce">${drapeaux(r.pays)}</span>` : ''}${etatPuce(r)}</div></a>`;
}

function pageRessources(config, { espace, type, liste, aimees, coach, message }) {
  const t = TYPES[type];
  const onglets = `<nav class="rs-onglets" aria-label="Ressources">${Object.entries(TYPES).map(([k, v]) => `<a href="/ressources?type=${k}"${k === type ? ' aria-current="page"' : ''}>${v.nom}</a>`).join('')}</nav>`;
  const ajouter = coach ? `Ajouter ${t.un}` : type === 'tutoriel' ? '' : `Proposer ${t.un}`;
  return page('Ressources', `${STYLE}
  <div class="titre-page"><div><p class="etiquette">${coach ? 'Gestion' : 'Mon accompagnement'}</p><h1>Ressources</h1></div><span class="doux petit">${liste.filter((r) => r.etat === 'public').length} ${t.nom.toLowerCase()}</span></div>
  ${onglets}
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}
  ${ajouter ? `<a class="bouton" href="/ressources/nouvelle?type=${type}" style="max-width:640px;margin:0 0 14px">+ ${ajouter}</a>` : ''}
  ${!coach && ajouter ? '<p class="doux petit" style="max-width:640px;margin:-6px 0 14px">Ta proposition est relue par le coach avant d\'être visible par tous. Tu peux la modifier tant qu\'elle n\'est pas validée.</p>' : ''}
  <div class="rs-liste">${liste.map((r) => carte(r, aimees)).join('') || '<p class="vide-traiter">Rien pour le moment.</p>'}</div>`, espace, 'ressources');
}

const liensListe = (titre, l) => (l.length ? `<div><dt>${titre}</dt><dd class="rs-champ-liens">${l.map((x) => `<a href="${echapper(x)}" target="_blank" rel="noopener">${echapper(/tiktok\.com\/@/.test(x) ? aliasCompte(x) : x)}</a>`).join('')}</dd></div>` : '');

function pageRessource(config, { espace, r, aime, coach, peutModifier, auteur, message, erreur }) {
  const t = TYPES[r.type];
  const defs = [
    r.description ? `<div><dt>${r.type === 'niche' ? 'Sujet' : 'Explication'}</dt><dd>${texteRiche(r.description)}</dd></div>` : '',
    `<div><dt>${r.type === 'niche' ? 'Type de contenu' : 'Type'}</dt><dd>${echapper(nomCategorie(r.type, r.categorie))}</dd></div>`,
    r.type === 'methode' ? `<div><dt>Meilleure pour</dt><dd>${r.pour ? echapper(nomPour(r.pour)) : '<span class="doux">Pas encore décidé par le coach</span>'}</dd></div>` : '',
    r.type === 'niche' && r.pays.length ? `<div><dt>Pays recommandés</dt><dd>${r.pays.map((p) => `${DRAPEAUX[p] || ''} ${echapper(p)}`).join(' · ')}</dd></div>` : '',
    r.type === 'niche' && rpm(r) ? `<div><dt>RPM</dt><dd>${echapper(rpm(r))}</dd></div>` : '',
    r.lien ? `<div><dt>Lien</dt><dd class="rs-champ-liens"><a href="${echapper(r.lien)}" target="_blank" rel="noopener">${echapper(r.lien)}</a></dd></div>` : '',
    liensListe('Comptes exemples', r.exemples),
    r.type === 'niche' ? liensListe('Contre-exemples (à ne pas faire)', r.contre_exemples) : '',
    r.type === 'niche' ? liensListe('Comptes sources (L1)', r.sources) : '',
  ].join('');
  return page(titreDe(r), `${STYLE}
  <a class="retour" href="/ressources?type=${r.type}"><span aria-hidden="true">‹</span> ${t.nom}</a>
  <div class="titre-page"><div><p class="etiquette">${echapper(t.nom)}${auteur ? ` · proposée par ${echapper(auteur)}` : ''}</p><h1>${echapper(titreDe(r))}</h1></div>${etatPuce(r)}</div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${r.etat === 'refuse' && r.motif ? `<div class="carte" style="max-width:640px;border-color:#7a1d1d"><b>Motif du coach</b><p style="margin:6px 0 0">${texteRiche(r.motif)}</p></div>` : ''}
  <div class="carte" style="max-width:640px"><dl class="rs-defs">${defs}</dl>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${r.etat === 'public' ? `<form method="post" action="/ressources/${r.id}/aimer" style="margin:0"><button class="bouton secondaire rs-aimer" type="submit"${aime ? ' data-aime' : ''}>${aime ? '♥' : '♡'} ${r.likes}</button></form>` : ''}
      ${peutModifier ? `<a class="bouton secondaire" href="/ressources/${r.id}/modifier" style="width:auto;margin:0;padding-left:20px;padding-right:20px">Modifier</a>` : ''}
    </div></div>
  ${coach && r.etat === 'attente' ? `<form class="carte" method="post" action="/admin/ressources/${r.id}/decision" style="display:grid;gap:10px;max-width:640px">
    <h2 style="margin:0">Ta décision</h2>
    <p class="doux petit" style="margin:0">Valider la rend visible par tous les élèves. Tu peux d'abord la modifier (par exemple « meilleure pour L1 / L2 »).</p>
    <textarea name="motif" placeholder="Si tu refuses : ce qu'il doit corriger."></textarea>
    <div class="deux-boutons"><button class="bouton secondaire" type="submit" name="decision" value="refuser">Refuser</button><button class="bouton vert" type="submit" name="decision" value="valider">Valider</button></div></form>` : ''}
  ${!coach ? `<details class="carte" style="max-width:640px"><summary style="cursor:pointer;font-weight:700">✉️ Une remarque sur cette ressource ?</summary>
    <form method="post" action="/ressources/${r.id}/remarque" style="display:grid;gap:10px;margin-top:10px">
      <textarea name="texte" maxlength="2000" required placeholder="Un lien mort, une info à corriger, une question… Le coach la reçoit."></textarea>
      <button class="bouton" type="submit" style="margin:0">Envoyer au coach</button></form></details>` : ''}`, espace, 'ressources');
}

function pageFormRessource(config, { espace, type, r = null, coach, erreur, valeurs = {} }) {
  const t = TYPES[type];
  const v = (k, def = '') => echapper(valeurs[k] !== undefined ? valeurs[k] : r && r[k] !== null && r[k] !== undefined ? (Array.isArray(r[k]) ? r[k].join('\n') : r[k]) : def);
  const choisi = (k, val) => (valeurs[k] !== undefined ? [].concat(valeurs[k]).includes(val) : r ? [].concat(r[k] || []).includes(val) : false);
  const radios = (nom, options) => `<div class="rs-pays">${options.map(([c, l]) => `<label><input type="radio" name="${nom}" value="${c}"${choisi(nom, c) ? ' checked' : ''}> ${echapper(l)}</label>`).join('')}</div>`;
  const zone = (nom, label, aide) => `<div class="champ"><label for="${nom}">${label}</label><textarea id="${nom}" name="${nom}" rows="3" placeholder="Un lien par ligne : https://www.tiktok.com/@compte">${v(nom)}</textarea>${aide ? `<small>${aide}</small>` : ''}</div>`;
  const action = r ? `/ressources/${r.id}/modifier` : `/ressources/nouvelle?type=${type}`;
  const verbe = r ? 'Modifier' : coach ? 'Ajouter' : 'Proposer';
  return page(`${verbe} ${t.un}`, `${STYLE}
  <a class="retour" href="${r ? `/ressources/${r.id}` : `/ressources?type=${type}`}"><span aria-hidden="true">‹</span> ${r ? 'Retour' : t.nom}</a>
  <div class="titre-page"><div><p class="etiquette">${t.nom}</p><h1>${verbe} ${t.un}</h1></div></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <form class="carte" method="post" action="${action}" style="display:grid;gap:14px;max-width:640px">
    <input type="hidden" name="type" value="${type}">
    <div class="champ"><label for="titre">${type === 'niche' ? 'Nom de la niche' : type === 'methode' ? 'Nom (facultatif)' : 'Titre'}</label>
      <input id="titre" name="titre" maxlength="100" value="${v('titre')}"${type === 'methode' ? '' : ' required'} placeholder="${type === 'niche' ? 'ex. Faits historiques' : type === 'methode' ? 'Tu peux le laisser vide' : 'ex. Couper au bon moment'}"></div>
    <div class="champ"><label for="description">${type === 'niche' ? 'Sujet' : 'Explication'}</label>
      <textarea id="description" name="description" maxlength="3000"${type === 'niche' ? ' required' : ''} placeholder="${type === 'niche' ? 'De quoi parlent les vidéos de cette niche ?' : 'Comment ça marche, étape par étape.'}">${v('description')}</textarea></div>
    <div class="champ"><label>${type === 'niche' ? 'Type de contenu' : 'Type'}</label>${radios('categorie', t.categories)}</div>
    ${type === 'methode' && coach ? `<div class="champ"><label>Meilleure pour</label>${radios('pour', POUR)}<small>Toi seul le décides.</small></div>` : ''}
    ${type === 'niche' ? `<div class="champ"><label>Pays recommandés</label><div class="rs-pays">${PAYS.map((p) => `<label><input type="checkbox" name="pays" value="${echapper(p)}"${choisi('pays', p) ? ' checked' : ''}> ${DRAPEAUX[p]} ${echapper(p)}</label>`).join('')}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="champ"><label for="rpm_min">RPM minimum ($)</label><input id="rpm_min" name="rpm_min" inputmode="decimal" value="${v('rpm_min')}" placeholder="ex. 0.40"></div>
      <div class="champ"><label for="rpm_max">RPM maximum ($)</label><input id="rpm_max" name="rpm_max" inputmode="decimal" value="${v('rpm_max')}" placeholder="ex. 1.20"></div></div>` : ''}
    ${type === 'tutoriel' ? `<div class="champ"><label for="lien">Lien (vidéo, page…)</label><input id="lien" name="lien" inputmode="url" value="${v('lien')}" placeholder="https://…"></div>` : ''}
    ${zone('exemples', 'Comptes exemples', type === 'tutoriel' ? 'Facultatif.' : '')}
    ${type === 'niche' ? `${zone('contre_exemples', 'Contre-exemples', 'Des comptes qui font ce qu\'il ne faut pas faire.')}${zone('sources', 'Comptes sources (pour le L1)', 'Les comptes d\'où viennent les vidéos à reposter en mieux.')}` : ''}
    <button class="bouton" type="submit" style="margin:0">${r ? 'Enregistrer' : coach ? 'Publier' : 'Envoyer au coach'}</button>
  </form>`, espace, 'ressources');
}

module.exports = { pageRessources, pageRessource, pageFormRessource, titreDe };
