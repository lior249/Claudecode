'use strict';

// Événements (challenges) : la page d'un événement (élèves) et la création / liste (coach).
const { echapper, ICONE } = require('./pages');
const { page } = require('./pages-parcours');
const { pieceTrophee, TROPHEES, FAMILLES } = require('./trophees');
const { DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS } = require('./evenements');

const dateFr = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dollars = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const ETATS = { a_venir: ['attente', 'À venir'], en_cours: ['valide', 'En cours'], termine: ['corriger', 'Terminé'], retire: ['corriger', 'Retiré'] };
const STYLE_EVT = `<style>
  .ev-affiche { width:100%; border-radius:20px; display:block; margin:0 0 14px; }
  .ev-cond { display:grid; gap:8px; } .ev-cond > div { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:14px; border:1px solid #242424; }
  .ev-cond small { display:block; color:var(--doux); } .ev-cond .ok { margin-left:auto; font-weight:800; }
  .ev-rang { display:grid; gap:6px; } .ev-rang a { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:14px; background:#111; border:1px solid #222; color:#fff; text-decoration:none; }
  .ev-rang .n { width:26px; height:26px; border-radius:50%; border:1px solid #3a3a3a; display:grid; place-items:center; font-size:12px; font-weight:800; flex:none; }
  .ev-rang .av { width:30px; height:30px; border-radius:50%; background:#2a2a2a; overflow:hidden; display:grid; place-items:center; font-weight:800; flex:none; } .ev-rang .av img { width:100%; height:100%; object-fit:cover; }
  .ev-rang b.r { margin-left:auto; }
</style>`;

// Classement d'un événement (inscrits, revenus générés pendant l'événement).
function classementEvenement(participants = [], moi = null) {
  if (!participants.length) return '<p class="doux" style="margin:0">Pas encore d\'inscrit.</p>';
  return `<div class="ev-rang">${participants.map((x, i) => `<a href="/classement/${encodeURIComponent(x.id)}"${x.id === moi ? ' style="border-color:#c8f23a"' : ''}><span class="n">${i + 1}</span>
    <span class="av">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
    <span>${echapper(x.nom)}</span><b class="r">${dollars(x.revenus)}</b></a>`).join('')}</div>`;
}

function pageEvenement(config, { espace, e, etat, conditions = [], inscrit = false, participants = [], moi = null, estCoach = false, message, erreur }) {
  const [classeEtat, libelleEtat] = ETATS[etat] || ETATS.a_venir;
  const peut = conditions.every((c) => c.ok);
  const action = estCoach ? '' : inscrit
    ? `<p class="message-ok" style="margin:0">${ICONE.ok} Tu es inscrit.</p>${etat === 'a_venir' ? `<form method="post" action="/evenements/${e.id}/desinscrire" style="margin:8px 0 0"><button class="bouton secondaire" type="submit" style="margin:0">Me désinscrire</button></form>` : ''}`
    : etat === 'termine' ? '' : peut ? `<form method="post" action="/evenements/${e.id}/inscrire" style="margin:0"><button class="bouton" type="submit" style="margin:0">Je participe</button></form>`
    : '<p class="doux" style="margin:0">Il te manque un trophée pour participer : regarde les conditions ci-dessus.</p>';
  return page(e.titre, `${STYLE_EVT}<a class="retour" href="/classement"><span aria-hidden="true">‹</span> Classement</a>
  ${e.affiche ? `<img class="ev-affiche" src="/fichiers/images/${echapper(e.affiche)}" alt="">` : ''}
  <div class="titre-page"><div><p class="etiquette">Événement</p><h1>${echapper(e.titre)}</h1></div><span class="etat" data-etat="${classeEtat}">${libelleEtat}</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte">${e.objectif ? `<p style="margin:0 0 8px;font-size:17px"><b>${echapper(e.objectif)}</b></p>` : ''}
    <p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
    <p class="doux petit" style="margin:10px 0 0">Du ${echapper(dateFr(e.debut))} au ${echapper(dateFr(e.fin))} · ${participants.length} participant${participants.length > 1 ? 's' : ''}</p></div>
  <div class="carte"><h2>Pour participer</h2>${conditions.length ? `<div class="ev-cond">${conditions.map((c) => `<div>${pieceTrophee(c.trophee, { taille: 40, obtenu: c.ok })}
      <span><b>${echapper(c.trophee.titre)}</b><small>${echapper(c.trophee.but)} (ou mieux)</small></span>${estCoach ? '' : `<span class="ok" style="color:${c.ok ? 'var(--ok)' : '#ff9a3c'}">${c.ok ? '✓' : '✗'}</span>`}</div>`).join('')}</div>`
    : '<p class="doux" style="margin:0">Ouvert à tous les élèves de l\'accompagnement.</p>'}
    <div style="margin-top:12px">${action}</div></div>
  <div class="carte"><h2>Classement de l'événement</h2><p class="doux petit" style="margin:0 0 10px">Revenus générés pendant l'événement (updates validées).</p>${classementEvenement(participants, moi)}</div>`, espace, 'classement');
}

// Coach : créer un événement et voir ceux en cours.
function pageEvenementsCoach(config, { espace, evenements = [], etats = {}, nbInscrits = {}, bornes, message, erreur }) {
  const choixConditions = FAMILLES.map(([fam, titre]) => `<details class="carte" style="margin:0"><summary style="cursor:pointer;font-weight:700">${echapper(titre)} <span class="doux petit" data-choisi="${fam}">· aucun</span></summary>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(96px, 1fr));gap:8px;margin-top:10px">
      <label style="display:grid;place-items:center;gap:4px;padding:8px;border-radius:12px;border:1px solid #2a2a2a;cursor:pointer;text-align:center;margin:0"><input type="radio" name="cond_${fam}" value="" checked style="width:auto;margin:0">Aucun</label>
      ${TROPHEES.filter((t) => t.famille === fam).map((t) => `<label style="display:grid;place-items:center;gap:4px;padding:8px;border-radius:12px;border:1px solid #2a2a2a;cursor:pointer;text-align:center;font-size:12px;margin:0">
        <input type="radio" name="cond_${fam}" value="${t.cle}" data-titre="${echapper(t.titre)}" style="width:auto;margin:0">${pieceTrophee(t, { taille: 44 })}<b>${echapper(t.titre)}</b></label>`).join('')}
    </div></details>`).join('');
  return page('Événements', `<a class="retour" href="/admin/gestion"><span aria-hidden="true">‹</span> Gestion</a>
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>Événements</h1></div><span class="doux petit">${evenements.filter((e) => ['a_venir', 'en_cours'].includes(etats[e.id])).length} / ${MAX_ACTIFS} à venir ou en cours</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <form class="carte" method="post" action="/admin/evenements" style="display:grid;gap:12px">
    <h2 style="margin:0">Nouvel événement</h2>
    <div class="champ"><label for="ev-titre">Nom</label><input id="ev-titre" name="titre" maxlength="80" required placeholder="ex. Overmaxx 1000"></div>
    <div class="champ"><label for="ev-objectif">Le défi, en une phrase</label><input id="ev-objectif" name="objectif" maxlength="200" placeholder="ex. Le premier à générer $1 000"></div>
    <div class="champ"><label for="ev-desc">Description</label><textarea id="ev-desc" name="description" maxlength="3000" required placeholder="Le principe, les règles, les récompenses…"></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="champ"><label for="ev-debut">Début</label><input id="ev-debut" name="debut" type="date" required min="${bornes.debutMin}" max="${bornes.debutMax}" value="${bornes.debutMin}"></div>
      <div class="champ"><label for="ev-fin">Fin</label><input id="ev-fin" name="fin" type="date" required></div></div>
    <p class="doux petit" style="margin:-4px 0 0">Début dans ${DEBUT_MIN} à ${DEBUT_MAX} jours (le temps de s'y préparer). Durée : ${DUREE_MIN} à ${DUREE_MAX} jours.</p>
    <div class="champ"><label>Bannière (le défilé en haut des pages)</label><div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>Ajouter la bannière</b><br>Format large, ex. 1200 × 400</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="banniere" value=""><div class="apercus" style="margin-top:8px"></div></div></div>
    <div class="champ"><label>Affiche (la page de l'événement)</label><div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>Ajouter l'affiche</b><br>Format portrait ou carré</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="affiche" value=""><div class="apercus" style="margin-top:8px"></div></div></div>
    <div class="champ"><label for="ev-couleur">Couleur dominante</label><input id="ev-couleur" name="couleur" type="color" value="#e8174f" style="width:64px;height:44px;padding:2px"></div>
    <div><h3 style="margin:0 0 4px;font-size:15px">Conditions de participation</h3><p class="doux petit" style="margin:0 0 8px">Pour chaque famille, le trophée minimum (ou aucun).</p><div style="display:grid;gap:8px">${choixConditions}</div></div>
    <button class="bouton" type="submit" style="margin:0">Créer l'événement</button>
  </form>
  <h2 style="font-size:16px;margin:20px 0 10px">Événements</h2>
  <div style="display:grid;gap:8px">${evenements.map((e) => { const [c, l] = ETATS[etats[e.id]] || ETATS.a_venir; return `<div class="carte" style="margin:0"><div class="envoi-tete"><a href="/evenements/${e.id}" style="color:#fff"><b>${echapper(e.titre)}</b></a><span class="etat" data-etat="${c}">${l}</span></div>
    <p class="doux petit" style="margin:4px 0 0">Du ${echapper(e.debut)} au ${echapper(e.fin)} · ${nbInscrits[e.id] || 0} inscrit(s)</p>
    ${['a_venir', 'en_cours'].includes(etats[e.id]) ? `<form method="post" action="/admin/evenements/${e.id}/retirer" style="margin:8px 0 0"><button class="bouton secondaire" type="submit" style="margin:0">Retirer</button></form>` : ''}</div>`; }).join('') || '<p class="vide-traiter">Aucun événement pour le moment.</p>'}</div>`,
  espace, 'gestion', null, `document.querySelectorAll('input[type=radio][name^="cond_"]').forEach(function (r) { r.addEventListener('change', function () {
    var s = document.querySelector('[data-choisi="' + r.name.slice(5) + '"]'); if (s) s.textContent = r.value ? '· ' + r.getAttribute('data-titre') + ' minimum' : '· aucun'; }); });`);
}

module.exports = { pageEvenement, pageEvenementsCoach, classementEvenement };
