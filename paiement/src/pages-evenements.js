'use strict';

// Événements (challenges) : la page d'un événement (élèves) et la création / liste (coach).
const { echapper, ICONE } = require('./pages');
const { page, STYLE_ETAPES, SCRIPT_ETAPES } = require('./pages-parcours');
const { BLOC_BADGES, STYLE_BADGES, SCRIPT_BADGES } = require('./detourage-badges');
const { pieceTrophee, TROPHEES, FAMILLES } = require('./trophees');
const { DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS, STATS, RANGS } = require('./evenements');

// La pièce d'un badge spécial : l'image envoyée par le coach, sinon une pièce dessinée du métal du rang.
function pieceBadge(b, { taille = 52 } = {}) {
  if (b.image) return `<img src="/fichiers/images/${echapper(b.image)}" alt="${echapper(b.titre || '')}" width="${taille}" height="${taille}" style="width:${taille}px;height:${taille}px;object-fit:contain;flex:none">`;
  const mots = String(b.titre || 'E').split(/\s+/).filter(Boolean);
  return pieceTrophee({ court: (mots.length > 1 ? mots[0][0] + mots[1][0] : mots[0].slice(0, 3)).toUpperCase(), metal: b.metal || 'or', titre: b.titre, famille: 'revenus' }, { taille });
}
const valeurStat = (st, v) => (st === 'revenus' ? `$${(Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')}`);

const dateFr = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dollars = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const ETATS = { brouillon: ['attente', 'Brouillon'], a_venir: ['attente', 'À venir'], en_cours: ['valide', 'En cours'], termine: ['corriger', 'Terminé'], retire: ['corriger', 'Retiré'] };
const STYLE_EVT = `<style>
  .ev-affiche { width:100%; border-radius:20px; display:block; margin:0 0 14px; }
  .ev-cond { display:grid; gap:8px; } .ev-cond > div { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:14px; border:1px solid #242424; }
  .ev-cond small { display:block; color:var(--doux); } .ev-cond .ok { margin-left:auto; font-weight:800; }
  .ev-rang { display:grid; gap:6px; } .ev-rang a { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:14px; background:#111; border:1px solid #222; color:#fff; text-decoration:none; }
  .ev-rang .n { width:26px; height:26px; border-radius:50%; border:1px solid #3a3a3a; display:grid; place-items:center; font-size:12px; font-weight:800; flex:none; }
  .ev-rang .av { width:30px; height:30px; border-radius:50%; background:#2a2a2a; overflow:hidden; display:grid; place-items:center; font-weight:800; flex:none; } .ev-rang .av img { width:100%; height:100%; object-fit:cover; }
  .ev-rang b.r { margin-left:auto; }
</style>`;

// Classement d'un événement : une liste par stat suivie (podium : or, argent, bronze).
function classementEvenement(classements = {}, moi = null, stats = ['revenus']) {
  const liste = (st) => {
    const l = classements[st] || [];
    if (!l.length) return '<p class="doux" style="margin:0">Pas encore d\'inscrit.</p>';
    return `<div class="ev-rang">${l.map((x) => `<a href="/classement/${encodeURIComponent(x.id)}"${x.id === moi ? ' style="border-color:#c8f23a"' : ''}><span class="n"${x.rang <= 3 && x.valeur > 0 ? ` style="background:${{ 1: '#e8b923', 2: '#c9ced6', 3: '#c07a3f' }[x.rang]};color:#000;border:0"` : ''}>${x.rang}</span>
    <span class="av">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
    <span>${echapper(x.nom)}</span><b class="r">${valeurStat(st, x.valeur)}</b></a>`).join('')}</div>`;
  };
  return stats.map((st) => `${stats.length > 1 ? `<h3 style="margin:14px 0 8px;font-size:15px">${echapper(STATS[st])}</h3>` : ''}${liste(st)}`).join('');
}

function pageEvenement(config, { espace, e, etat, conditions = [], inscrit = false, classements = {}, nbInscrits = 0, moi = null, estCoach = false, message, erreur }) {
  const [classeEtat, libelleEtat] = ETATS[etat] || ETATS.a_venir;
  const peut = conditions.every((c) => c.ok);
  const badges = [1, 2, 3].map((r) => ({ image: e[`badge_${RANGS[r]}`], metal: RANGS[r], titre: e.badge_nom || e.titre, rang: r }));
  const recompense = `<div style="display:flex;gap:14px;align-items:flex-end;justify-content:center;margin:6px 0 2px">${[2, 1, 3].map((r) => `<div style="text-align:center">${pieceBadge(badges[r - 1], { taille: r === 1 ? 72 : 54 })}<div class="doux petit">${['', '1er', '2e', '3e'][r]}</div></div>`).join('')}</div>`;
  const statsTxt = e.stats.map((x) => STATS[x]).join(', ');
  const listeConditions = (bleu) => (conditions.length ? `<div class="ev-cond">${conditions.map((c) => `<div${bleu && c.ok ? ' style="border-color:#3b82f6;background:#0b1730"' : ''}>${pieceTrophee(c.trophee, { taille: 40, obtenu: c.ok })}
      <span><b>${echapper(c.trophee.titre)}</b><small>${echapper(c.trophee.but)} (ou mieux)</small></span>${estCoach ? '' : `<span class="ok" style="color:${c.ok ? '#3b82f6' : '#ff4d4d'}">${c.ok ? '✓' : '✗'}</span>`}</div>`).join('')}</div>`
    : '<p class="doux" style="margin:0">Ouvert à tous les élèves de l\'accompagnement.</p>');
  const regles = `<div class="carte"><h2>Pour gagner</h2><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
    <p class="doux petit" style="margin:8px 0 0">Classement${e.stats.length > 1 ? 's' : ''} : ${echapper(statsTxt)}, à partir de 0 le ${echapper(dateFr(e.debut))}. Les 3 premiers ${e.stats.length > 1 ? 'de chaque classement ' : ''}gagnent le badge.</p>${recompense}
    ${e.regles_validation ? `<h3 style="margin:14px 0 4px;font-size:15px">Validation des résultats</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_validation)}</p>` : ''}</div>`;
  // Rejoindre : 1. présentation lue et comprise ; 2. trophées demandés ; 3. règles pour gagner, puis « Je participe ».
  const rejoindre = estCoach || inscrit || etat === 'termine' ? '' : `${STYLE_ETAPES}<form class="carte assistant" method="post" action="/evenements/${e.id}/inscrire" data-depart="1">
    <div class="envoi-tete"><h2>Rejoindre le challenge</h2><div class="points-pages"><i></i><i></i><i></i></div></div>
    <div data-page="1"><h3>La présentation</h3><p style="margin:0">Lis bien la présentation ci-dessus : le défi, les dates et ce qui est suivi (${echapper(statsTxt)}).</p>
      <button class="bouton" type="button" data-aller="2" style="margin:0">J'ai lu, j'ai compris</button></div>
    <div data-page="2" hidden><h3>Pour participer, il te faut ces trophées</h3>${listeConditions(true)}
      ${peut ? '<button class="bouton" type="button" data-aller="3" style="margin:0">Continuer</button>'
    : '<button class="bouton" type="button" disabled style="margin:0;opacity:.4;cursor:not-allowed">Continuer</button><p style="margin:0;color:#ff4d4d;font-size:13.5px">Tu n\'as pas les prédispositions nécessaires pour participer à ce challenge.</p>'}
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="3" hidden><h3>Pour gagner</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
      ${e.regles_validation ? `<p class="doux" style="margin:0"><b>Validation des résultats :</b> ${echapper(e.regles_validation)}</p>` : ''}${recompense}
      <button class="bouton" type="submit" style="margin:0">Je participe</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div></form>`;
  return page(e.titre, `${STYLE_EVT}<a class="retour" href="/classement"><span aria-hidden="true">‹</span> Classement</a>
  ${e.affiche ? `<img class="ev-affiche" src="/fichiers/images/${echapper(e.affiche)}" alt="">` : ''}
  <div class="titre-page"><div><p class="etiquette">Événement</p><h1>${echapper(e.titre)}</h1></div><span class="etat" data-etat="${classeEtat}">${libelleEtat}</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte">${e.objectif ? `<p style="margin:0 0 8px;font-size:17px"><b>${echapper(e.objectif)}</b></p>` : ''}
    <p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
    <p class="doux petit" style="margin:10px 0 0">Du ${echapper(dateFr(e.debut))} au ${echapper(dateFr(e.fin))} · suivi : ${echapper(statsTxt)} · ${nbInscrits} participant${nbInscrits > 1 ? 's' : ''}</p></div>
  ${rejoindre}
  ${inscrit ? `<p class="message-ok">${ICONE.ok} Tu participes à ce challenge.</p>${etat === 'a_venir' ? `<form method="post" action="/evenements/${e.id}/desinscrire" style="margin:0 0 14px"><button class="bouton secondaire" type="submit" style="margin:0">Me désinscrire</button></form>` : ''}` : ''}
  ${inscrit || estCoach || etat === 'termine' ? `${regles}<div class="carte"><h2>Pour participer</h2>${listeConditions(false)}</div>` : ''}
  <div class="carte"><h2>Classement de l'événement</h2><p class="doux petit" style="margin:0 0 10px">Depuis le début de l'événement (tout le monde part de 0), d'après les updates du soir validées.</p>${classementEvenement(classements, moi, e.stats)}</div>`,
  espace, 'classement', null, SCRIPT_ETAPES);
}

// ---------- Coach ----------
const STYLE_COACH_EV = `<style>
  .ev-section { margin:4px 0 0; padding-top:12px; border-top:1px solid #222; } .ev-section h3 { margin:0 0 4px; font-size:16px; }
  .ev-famille { display:grid; gap:6px; } .ev-famille b { font-size:14px; }
  .ev-choix { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; } .ev-choix::-webkit-scrollbar { display:none; }
  .ev-choix label { flex:none; display:grid; place-items:center; gap:2px; width:78px; padding:6px 4px; border-radius:12px; border:1px solid #2a2a2a; cursor:pointer; text-align:center; font-size:11px; margin:0; }
  .ev-choix label:has(input:checked) { border-color:#c8f23a; background:#141a05; } .ev-choix input { position:absolute; opacity:0; pointer-events:none; }
  .ev-ligne { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-radius:14px; background:#111; border:1px solid #222; color:#fff; text-decoration:none; }
</style>`;
// La liste : les 3 derniers événements (brouillons compris), ou tous.
function pageEvenementsCoach(config, { espace, evenements = [], total = 0, tous = false, etats = {}, nbInscrits = {}, message, erreur }) {
  const ligne = (e) => { const [c, l] = ETATS[etats[e.id]] || ETATS.a_venir;
    return `<a class="ev-ligne" href="${etats[e.id] === 'brouillon' ? `/admin/evenements/${e.id}` : `/evenements/${e.id}`}"><span><b>${echapper(e.titre)}</b><br>
      <span class="doux petit">${etats[e.id] === 'brouillon' ? 'Dates à choisir à la publication' : `Du ${echapper(e.debut)} au ${echapper(e.fin)} · ${nbInscrits[e.id] || 0} inscrit(s)`}</span></span><span class="etat" data-etat="${c}">${l}</span></a>`; };
  return page('Événements', `${STYLE_COACH_EV}<a class="retour" href="${tous ? '/admin/evenements' : '/admin/gestion'}"><span aria-hidden="true">‹</span> ${tous ? 'Événements' : 'Gestion'}</a>
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>${tous ? 'Tous les événements' : 'Événements'}</h1></div><span class="doux petit">${evenements.filter((e) => ['a_venir', 'en_cours'].includes(etats[e.id])).length} / ${MAX_ACTIFS} à venir ou en cours</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  ${tous ? '' : '<a class="bouton" href="/admin/evenements/nouveau" style="margin:0 0 16px">+ Créer un événement</a>'}
  <div style="display:grid;gap:8px">${evenements.map(ligne).join('') || '<p class="vide-traiter">Aucun événement pour le moment.</p>'}</div>
  ${!tous && total > evenements.length ? `<a class="bouton secondaire" href="/admin/evenements?tous=1" style="margin-top:12px">Voir tous les événements (${total})</a>` : ''}`, espace, 'gestion');
}

// Créer : 1. l'événement, 2. les règles (stats, pour gagner, validation, conditions), 3. la récompense. Enregistré en brouillon.
function pageNouvelEvenement(config, { espace, erreur }) {
  const choixConditions = FAMILLES.map(([fam, titre]) => `<div class="ev-famille"><b>${echapper(titre)} <span class="doux petit" data-choisi="${fam}">· aucun</span></b>
    <div class="ev-choix"><label><input type="radio" name="cond_${fam}" value="" checked><span style="display:grid;place-items:center;width:44px;height:44px;font-weight:800;color:#666">—</span>Aucun</label>
      ${TROPHEES.filter((t) => t.famille === fam).map((t) => `<label><input type="radio" name="cond_${fam}" value="${t.cle}" data-titre="${echapper(t.titre)}">${pieceTrophee(t, { taille: 44 })}${echapper(t.titre)}</label>`).join('')}</div></div>`).join('');
  return page('Nouvel événement', `${STYLE_COACH_EV}${STYLE_BADGES}<a class="retour" href="/admin/evenements"><span aria-hidden="true">‹</span> Événements</a>
  <div class="titre-page"><div><p class="etiquette">Événements</p><h1>Nouvel événement</h1></div></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <form class="carte" method="post" action="/admin/evenements" style="display:grid;grid-template-columns:minmax(0, 1fr);gap:12px">
    <h3 style="margin:0;font-size:16px">1. L'événement</h3>
    <div class="champ"><label for="ev-titre">Nom</label><input id="ev-titre" name="titre" maxlength="80" required placeholder="ex. Overmaxx 1000"></div>
    <div class="champ"><label for="ev-objectif">Le défi, en une phrase</label><input id="ev-objectif" name="objectif" maxlength="200" placeholder="ex. Le premier à générer $1 000"></div>
    <div class="champ"><label for="ev-desc">Description</label><textarea id="ev-desc" name="description" maxlength="3000" required placeholder="Le principe, les règles, les récompenses…"></textarea></div>
    <div class="champ"><label>Bannière (le défilé en haut des pages)</label><div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>Ajouter la bannière</b><br>Format large, ex. 1200 × 400</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="banniere" value=""><div class="apercus" style="margin-top:8px"></div></div></div>
    <div class="champ"><label>Affiche (la page de l'événement)</label><div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>Ajouter l'affiche</b><br>Format portrait ou carré</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="affiche" value=""><div class="apercus" style="margin-top:8px"></div></div></div>
    <div class="champ"><label for="ev-couleur">Couleur dominante</label><input id="ev-couleur" name="couleur" type="color" value="#e8174f" style="width:64px;height:44px;padding:2px"></div>
    <div class="ev-section"><h3>2. Les règles</h3></div>
    <div><b style="font-size:14px">Ce qui est suivi</b><p class="doux petit" style="margin:2px 0 8px">Une stat (monostat) ou plusieurs (un classement et un podium par stat). Les 3 : challenge global, ses rappels remplacent les rappels habituels des inscrits.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${Object.entries(STATS).map(([k, l], i) => `<label style="display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid #2a2a2a;margin:0;font-weight:600"><input type="checkbox" name="stats" value="${k}"${i === 0 ? ' checked' : ''} style="width:auto;margin:0">${echapper(l)}</label>`).join('')}</div></div>
    <div class="champ"><label for="ev-points">Pour gagner (attribution des points)</label><textarea id="ev-points" name="regles_points" maxlength="2000" required placeholder="ex. Celui qui génère le plus d'argent entre le début et la fin gagne."></textarea></div>
    <div class="champ"><label for="ev-valid">Validation des résultats (facultatif)</label><textarea id="ev-valid" name="regles_validation" maxlength="2000" placeholder="ex. Seuls les résultats validés par le coach comptent ; capture obligatoire à chaque update."></textarea></div>
    <div><b style="font-size:14px">Conditions de participation</b><p class="doux petit" style="margin:2px 0 8px">Pour chaque famille, le trophée minimum pour participer (ou aucun).</p><div style="display:grid;gap:12px">${choixConditions}</div></div>
    <div class="ev-section"><h3>3. La récompense</h3><p class="doux petit" style="margin:0">Le podium de chaque stat reçoit le badge : or, argent, bronze.</p></div>
    <div class="champ"><label for="ev-badge">Nom du badge</label><input id="ev-badge" name="badge_nom" maxlength="60" placeholder="ex. Overmaxx 1000"></div>
    ${BLOC_BADGES(ICONE)}
    <button class="bouton" type="submit" style="margin:0">Enregistrer en brouillon</button>
    <p class="doux petit" style="margin:-4px 0 0">Tu choisiras les dates (début dans ${DEBUT_MIN} à ${DEBUT_MAX} jours, durée ${DUREE_MIN} à ${DUREE_MAX} jours) au moment de le publier.</p>
  </form>`, espace, 'gestion', null, `${SCRIPT_BADGES}
  document.querySelectorAll('input[type=radio][name^="cond_"]').forEach(function (r) { r.addEventListener('change', function () {
    var s = document.querySelector('[data-choisi="' + r.name.slice(5) + '"]'); if (s) s.textContent = r.value ? '· ' + r.getAttribute('data-titre') + ' minimum' : '· aucun'; }); });`);
}

// Un brouillon : tout ce qui a été préparé, puis la publication (dates) ou la suppression.
function pageBrouillon(config, { espace, e, bornes, conditions = [], erreur }) {
  const badges = [1, 2, 3].map((r) => ({ image: e[`badge_${RANGS[r]}`], metal: RANGS[r], titre: e.badge_nom || e.titre }));
  return page(e.titre, `${STYLE_EVT}<a class="retour" href="/admin/evenements"><span aria-hidden="true">‹</span> Événements</a>
  ${e.affiche ? `<img class="ev-affiche" src="/fichiers/images/${echapper(e.affiche)}" alt="">` : ''}
  <div class="titre-page"><div><p class="etiquette">Brouillon</p><h1>${echapper(e.titre)}</h1></div><span class="etat" data-etat="attente">Brouillon</span></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte">${e.objectif ? `<p style="margin:0 0 8px;font-size:17px"><b>${echapper(e.objectif)}</b></p>` : ''}<p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
    <p class="doux petit" style="margin:10px 0 0">Suivi : ${echapper(e.stats.map((x) => STATS[x]).join(', '))}</p></div>
  <div class="carte"><h2>Pour gagner</h2><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
    ${e.regles_validation ? `<h3 style="margin:12px 0 4px;font-size:15px">Validation des résultats</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_validation)}</p>` : ''}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:12px">${badges.map((b) => pieceBadge(b, { taille: 56 })).join('')}</div></div>
  <div class="carte"><h2>Pour participer</h2>${conditions.length ? `<div class="ev-cond">${conditions.map((c) => `<div>${pieceTrophee(c.trophee, { taille: 40 })}<span><b>${echapper(c.trophee.titre)}</b><small>${echapper(c.trophee.but)} (ou mieux)</small></span></div>`).join('')}</div>` : '<p class="doux" style="margin:0">Ouvert à tous.</p>'}</div>
  <form class="carte" method="post" action="/admin/evenements/${e.id}/publier" style="display:grid;grid-template-columns:minmax(0, 1fr);gap:10px">
    <h2 style="margin:0">Publier</h2>
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:10px">
      <div class="champ"><label for="ev-debut">Début</label><input id="ev-debut" name="debut" type="date" required min="${bornes.debutMin}" max="${bornes.debutMax}" value="${bornes.debutMin}"></div>
      <div class="champ"><label for="ev-fin">Fin</label><input id="ev-fin" name="fin" type="date" required></div></div>
    <p class="doux petit" style="margin:0">Début dans ${DEBUT_MIN} à ${DEBUT_MAX} jours (le temps de s'y préparer). Durée : ${DUREE_MIN} à ${DUREE_MAX} jours. La bannière défile dès la publication.</p>
    <button class="bouton" type="submit" style="margin:0">Publier l'événement</button></form>
  <form method="post" action="/admin/evenements/${e.id}/supprimer"><button class="bouton secondaire" type="submit" style="margin:0" onclick="return confirm('Supprimer ce brouillon ?')">Supprimer le brouillon</button></form>`, espace, 'gestion');
}

module.exports = { pageNouvelEvenement, pageBrouillon, pageEvenement, pageEvenementsCoach, classementEvenement, pieceBadge, valeurStat };
