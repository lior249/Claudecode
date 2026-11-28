'use strict';

// Événements (challenges) : la page d'un événement (élèves) et la création / liste (coach).
const { echapper, ICONE } = require('./pages');
const { page, STYLE_ETAPES, SCRIPT_ETAPES } = require('./pages-parcours');
const { BLOC_BADGES, STYLE_BADGES, SCRIPT_BADGES } = require('./detourage-badges');
const { pieceTrophee, TROPHEES, FAMILLES } = require('./trophees');
const { DEBUT_MIN, DEBUT_MAX, DUREE_MIN, DUREE_MAX, MAX_ACTIFS, STATS, RANGS, SANS_FIN, COULEURS, EFFETS } = require('./evenements');

// La pièce d'un badge spécial : l'image envoyée par le coach, sinon une pièce dessinée du métal du rang.
function pieceBadge(b, { taille = 52 } = {}) {
  if (b.image) return `<img src="/fichiers/images/${echapper(b.image)}" alt="${echapper(b.titre || '')}" width="${taille}" height="${taille}" style="width:${taille}px;height:${taille}px;object-fit:contain;flex:none">`;
  const mots = String(b.titre || 'E').split(/\s+/).filter(Boolean);
  return pieceTrophee({ court: (mots.length > 1 ? mots[0][0] + mots[1][0] : mots[0].slice(0, 3)).toUpperCase(), metal: b.metal || 'or', titre: b.titre, famille: 'revenus' }, { taille });
}
const valeurStat = (st, v) => (st === 'revenus' ? `$${(Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')}`);

const dateFr = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
// « Du lundi 7 décembre (15:00 GMT) au … » ou « À partir du … jusqu'à ce que les gagnants atteignent le palier ».
const periode = (e) => `${e.fin === SANS_FIN ? 'À partir du' : 'Du'} ${dateFr(e.debut)}${e.heure ? ` (${e.heure} GMT)` : ''}${e.fin === SANS_FIN ? ', jusqu\'à ce que les gagnants atteignent le palier' : ` au ${dateFr(e.fin)}`}`;
const palierTxt = (st, v) => (st === 'revenus' ? `$${(Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `${Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} ${st === 'vues' ? 'vues' : 'abonnés'}`);
const rangsDe = (e) => [1, 2, 3].slice(0, Math.min(3, Math.max(1, Number(e.gagnants) || 3)));
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
  .ev-cond details { padding:8px 10px; border-radius:14px; border:1px solid #242424; } .ev-cond summary { display:flex; align-items:center; gap:10px; cursor:pointer; list-style:none; }
  .ev-cond summary::-webkit-details-marker { display:none; }
  .ev-participants { display:flex; flex-wrap:wrap; gap:10px; } .ev-participants a { display:grid; justify-items:center; gap:3px; width:56px; color:#fff; text-decoration:none; }
  .ev-participants .av { width:44px; height:44px; border-radius:50%; background:#2a2a2a; overflow:hidden; display:grid; place-items:center; font-weight:800; }
  .ev-participants .av img { width:100%; height:100%; object-fit:cover; } .ev-participants small { font-size:11px; max-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--doux); }
  dialog.ev-rejoindre { width:min(460px, calc(100vw - 24px)); }
  .ev-hero { position:relative; margin:0 0 10px; padding:16px 16px 22px; border-radius:22px; text-align:center; overflow:hidden;
    background:radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--halo) 70%, transparent) 0%, color-mix(in srgb, var(--halo) 18%, transparent) 32%, transparent 60%), linear-gradient(180deg, var(--fondu) 0%, var(--fond) 100%); }
  .ev-hero-compte { margin:0; text-align:left; font-size:14px; font-weight:600; color:#fff; }
  .ev-hero[data-effet="fondu"] { background:linear-gradient(180deg, var(--halo) 0%, color-mix(in srgb, var(--halo) 40%, var(--fond)) 30%, var(--fond) 70%); }
  .ev-hero-compte, .ev-hero-et, .ev-hero h1 { position:relative; z-index:1; } .ev-hero-badge .evc-rayons { width:360px; height:360px; margin:-180px 0 0 -180px; }
  .ev-hero-badge { position:relative; height:150px; display:grid; place-items:center; margin:6px 0 4px; } .ev-hero-badge img, .ev-hero-badge svg { position:relative; }
  .ev-hero-badge img { height:150px; width:auto; max-width:80%; object-fit:contain; filter:drop-shadow(0 10px 24px rgba(0,0,0,.6)); }
  .ev-hero-et { margin:0; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--texte); opacity:.85; }
  .ev-hero h1 { margin:2px 0 0; font-size:clamp(28px, 8vw, 42px); letter-spacing:-0.03em; line-height:1.05; color:var(--texte); } dialog.ev-rejoindre .assistant { display:grid; gap:12px; }
</style>`;

// Classement d'un événement : une liste par stat suivie (podium : or, argent, bronze).
function classementEvenement(classements = {}, moi = null, stats = ['revenus'], paliers = {}) {
  const liste = (st) => {
    const l = classements[st] || [];
    if (!l.length) return '<p class="doux" style="margin:0">Pas encore d\'inscrit.</p>';
    return `<div class="ev-rang">${l.map((x) => `<a href="/classement/${encodeURIComponent(x.id)}"${x.id === moi ? ' style="border-color:#c8f23a"' : ''}><span class="n"${x.rang <= 3 && x.valeur > 0 ? ` style="background:${{ 1: '#e8b923', 2: '#c9ced6', 3: '#c07a3f' }[x.rang]};color:#000;border:0"` : ''}>${x.rang}</span>
    <span class="av">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span>
    <span>${echapper(x.nom)}</span><b class="r">${valeurStat(st, x.valeur)}</b></a>`).join('')}</div>`;
  };
  return stats.map((st) => `${stats.length > 1 || paliers[st] ? `<h3 style="margin:14px 0 8px;font-size:15px">${echapper(STATS[st])}${paliers[st] ? ` <span class="doux petit">· palier ${echapper(palierTxt(st, paliers[st]))}</span>` : ''}</h3>` : ''}${liste(st)}`).join('');
}

// La page d'un événement : présentation, participants, classement. S'inscrire se fait dans une fenêtre (3 étapes) ;
// la fermer sans s'inscrire fait quitter la page. ?participer=1 (depuis la carte du challenge) l'ouvre tout de suite.
// La fiche en tête de la page : compte à rebours, le badge sur son halo, le nom (couleurs du challenge).
function enTete(e, compte) {
  const c = { ...COULEURS, ...(e.couleurs || {}) };
  const et = e.badge_or || e.badge_argent || e.badge_bronze;
  const badge = et ? `<img src="/fichiers/images/${echapper(et)}" alt="">` : pieceBadge({ metal: 'or', titre: e.badge_nom || e.titre }, { taille: 120 });
  return `<section class="ev-hero" data-effet="${c.effet === 'fondu' ? 'fondu' : 'halo'}" style="${Object.keys(COULEURS).filter((k) => k !== 'effet').map((k) => `--${k}:${echapper(c[k])}`).join(';')};--c:${echapper(c.halo)}">
    ${compte ? `<p class="ev-hero-compte">${echapper(compte)}</p>` : ''}
    <div class="ev-hero-badge"><span class="evc-rayons" aria-hidden="true"></span>${badge}</div>
    <p class="ev-hero-et">Événement</p><h1>${echapper(e.titre)}</h1></section>`;
}
function pageEvenement(config, { espace, e, etat, conditions = [], inscrit = false, classements = {}, nbInscrits = 0, participants = [], moi = null, estCoach = false, ouvrir = false, compte = '', message, erreur }) {
  const [classeEtat, libelleEtat] = ETATS[etat] || ETATS.a_venir;
  const peut = conditions.every((c) => c.ok);
  const rangs = rangsDe(e);
  const badges = rangs.map((r) => ({ image: e[`badge_${RANGS[r]}`], metal: RANGS[r], titre: e.badge_nom || e.titre, rang: r }));
  const ordre = rangs.length === 3 ? [2, 1, 3] : rangs;
  const recompense = `<div style="display:flex;gap:14px;align-items:flex-end;justify-content:center;margin:6px 0 2px">${ordre.map((r) => `<div style="text-align:center">${pieceBadge(badges[r - 1], { taille: r === 1 ? 72 : 54 })}<div class="doux petit">${['', '1er', '2e', '3e'][r]}</div></div>`).join('')}</div>`;
  const statsTxt = e.stats.map((x) => `${STATS[x]}${e.paliers && e.paliers[x] ? ` (${palierTxt(x, e.paliers[x])})` : ''}`).join(', ');
  const listeConditions = (bleu) => (conditions.length ? `<div class="ev-cond">${conditions.map((c) => `<details${bleu && c.ok ? ' style="border-color:#3b82f6;background:#0b1730"' : ''}><summary>${pieceTrophee(c.trophee, { taille: 40, obtenu: c.ok })}
      <span><b>${echapper(c.trophee.titre)}</b><small>${echapper(c.trophee.but)} (ou mieux)</small></span>${estCoach ? '' : `<span class="ok" style="color:${c.ok ? '#3b82f6' : '#ff4d4d'}">${c.ok ? '✓' : '✗'}</span>`}</summary>
      <p class="doux petit" style="margin:8px 0 0">${c.ok ? 'Tu l\'as déjà.' : `Pour l'obtenir : ${echapper(c.trophee.label || c.trophee.but)}.`} <a href="/trophees">Voir la Trophy room ›</a></p></details>`).join('')}</div>`
    : '<p class="doux" style="margin:0">Ouvert à tous les élèves de l\'accompagnement.</p>');
  const regles = `<div class="carte"><h2>Pour gagner</h2><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
    <p class="doux petit" style="margin:8px 0 0">Suivi : ${echapper(statsTxt)}, à partir de 0 au début du challenge.</p>${recompense}
    ${e.regles_validation ? `<h3 style="margin:14px 0 4px;font-size:15px">Validation des résultats</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_validation)}</p>` : ''}</div>`;
  const peutRejoindre = !estCoach && !inscrit && etat !== 'termine';
  // Rejoindre (fenêtre) : 1. présentation ; 2. trophées demandés (sinon : pas qualifié) ; 3. règles, puis « Je participe ».
  const rejoindre = !peutRejoindre ? '' : `${STYLE_ETAPES}<dialog class="fenetre ev-rejoindre" id="ev-rejoindre"><button class="fermer" type="button" aria-label="Fermer">×</button>
    <form class="assistant" method="post" action="/evenements/${e.id}/inscrire" data-depart="1">
    <div class="envoi-tete"><h2>Rejoindre le challenge</h2><div class="points-pages"><i></i><i></i><i></i></div></div>
    <div data-page="1"><h3>${echapper(e.titre)}</h3>${e.objectif ? `<p style="margin:0"><b>${echapper(e.objectif)}</b></p>` : ''}<p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
      <p class="doux petit" style="margin:0">${echapper(periode(e))} · suivi : ${echapper(statsTxt)}</p>
      <button class="bouton" type="button" data-aller="2" style="margin:0">J'ai lu, j'ai compris</button></div>
    <div data-page="2" hidden><h3>${peut ? 'Pour participer, il te faut ces trophées' : 'Tu n\'es pas qualifié pour ce challenge'}</h3>
      ${peut ? '' : '<p style="margin:0;color:#ff4d4d;font-size:13.5px">Reviens quand tu auras rempli les conditions suivantes (touche un trophée pour voir comment l\'obtenir).</p>'}
      ${listeConditions(true)}
      ${peut ? '<button class="bouton" type="button" data-aller="3" style="margin:0">Continuer</button>'
    : '<button class="bouton" type="button" disabled style="margin:0;opacity:.4;cursor:not-allowed">Continuer</button><p style="margin:0;color:#ff4d4d;font-size:13.5px">Tu n\'as pas les prédispositions nécessaires pour participer à ce challenge.</p>'}
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    <div data-page="3" hidden><h3>Pour gagner</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
      ${e.regles_validation ? `<p class="doux" style="margin:0"><b>Validation des résultats :</b> ${echapper(e.regles_validation)}</p>` : ''}${recompense}
      <button class="bouton" type="submit" style="margin:0">Je participe</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div></form></dialog>
    <button class="bouton" type="button" data-ouvrir-rejoindre style="margin:0 0 14px">Participer</button>`;
  const listeParticipants = participants.length ? `<div class="ev-participants">${participants.map((x) => `<a href="/classement/${encodeURIComponent(x.id)}" title="${echapper(x.nom)}"><span class="av">${x.avatar ? `<img src="${echapper(x.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : echapper((x.nom || '?').charAt(0).toUpperCase())}</span><small>${echapper(x.nom)}</small></a>`).join('')}</div>`
    : '<p class="doux" style="margin:0">Personne n\'est encore inscrit : sois le premier.</p>';
  const script = !peutRejoindre ? SCRIPT_ETAPES : `${SCRIPT_ETAPES}
  (function () {
    var d = document.getElementById('ev-rejoindre'); if (!d) return;
    var envoye = false;
    d.querySelector('form').addEventListener('submit', function () { envoye = true; });
    d.querySelector('.fermer').onclick = function () { d.close(); };
    // Fermée sans s'inscrire : on quitte la page de l'événement.
    d.addEventListener('close', function () { if (envoye) return; if (history.length > 1 && document.referrer && document.referrer.indexOf(location.host) > -1) history.back(); else location.href = '/classement'; });
    document.querySelectorAll('[data-ouvrir-rejoindre]').forEach(function (b) { b.onclick = function () { d.showModal(); }; });
    ${ouvrir ? 'd.showModal();' : ''}
  })();`;
  return page(e.titre, `${STYLE_EVT}<a class="retour" href="/classement"><span aria-hidden="true">‹</span> Classement</a>
  ${enTete(e, compte)}
  <p style="margin:0 0 12px;text-align:center"><span class="etat" data-etat="${classeEtat}">${libelleEtat}</span></p>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte">${e.objectif ? `<p style="margin:0 0 8px;font-size:17px"><b>${echapper(e.objectif)}</b></p>` : ''}
    <p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
    <p class="doux petit" style="margin:10px 0 0">${echapper(periode(e))} · suivi : ${echapper(statsTxt)}</p></div>
  ${rejoindre}
  ${inscrit ? `<p class="message-ok">${ICONE.ok} Tu participes à ce challenge.</p>${etat === 'a_venir' ? `<form method="post" action="/evenements/${e.id}/desinscrire" style="margin:0 0 14px"><button class="bouton secondaire" type="submit" style="margin:0">Me désinscrire</button></form>` : ''}` : ''}
  <div class="carte"><h2>Participants (${nbInscrits})</h2>${listeParticipants}</div>
  ${inscrit || estCoach || etat === 'termine' ? `${regles}<div class="carte"><h2>Pour participer</h2>${listeConditions(false)}</div>` : ''}
  ${estCoach ? `<form class="carte" method="post" action="/admin/evenements/${e.id}/banniere" style="display:grid;gap:10px"><h2 style="margin:0">Bannière (facultative)</h2>
    <div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>${e.banniere ? 'Changer la bannière' : 'Ajouter une bannière'}</b><br>Format large, ex. 1200 × 400 (sinon : la couleur du challenge)</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="banniere" value=""><div class="apercus" style="margin-top:8px"></div></div>
    <button class="bouton secondaire" type="submit" style="margin:0">Enregistrer la bannière</button></form>` : ''}
  <div class="carte"><h2>Classement de l'événement</h2><p class="doux petit" style="margin:0 0 10px">Depuis le début de l'événement (tout le monde part de 0), d'après les updates du soir validées.</p>${classementEvenement(classements, moi, e.stats, e.paliers || {})}</div>`,
  espace, 'classement', null, script);
}

// ---------- Coach ----------
const STYLE_COACH_EV = `<style>
  .ev-section { margin:4px 0 0; padding-top:12px; border-top:1px solid #222; } .ev-section h3 { margin:0 0 4px; font-size:16px; }
  .ev-famille { display:grid; gap:6px; } .ev-famille b { font-size:14px; }
  .ev-choix { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; } .ev-choix::-webkit-scrollbar { display:none; }
  .ev-choix label { flex:none; display:grid; place-items:center; gap:2px; width:78px; padding:6px 4px; border-radius:12px; border:1px solid #2a2a2a; cursor:pointer; text-align:center; font-size:11px; margin:0; }
  .ev-choix label:has(input:checked) { border-color:#c8f23a; background:#141a05; } .ev-choix input { position:absolute; opacity:0; pointer-events:none; }
  .ev-couleurs { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:6px; } .ev-couleurs label { display:grid; justify-items:center; gap:4px; font-size:11px; margin:0; text-align:center; }
  .ev-couleurs input { width:100%; height:38px; padding:2px; border-radius:10px; }
  .ev-apercu { margin-top:10px; height:clamp(132px, 34vw, 170px); }
  .ev-ligne { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-radius:14px; background:#111; border:1px solid #222; color:#fff; text-decoration:none; }
</style>`;
// La liste : les 3 derniers événements (brouillons compris), ou tous.
function pageEvenementsCoach(config, { espace, evenements = [], total = 0, tous = false, etats = {}, nbInscrits = {}, message, erreur }) {
  const ligne = (e) => { const [c, l] = ETATS[etats[e.id]] || ETATS.a_venir;
    return `<a class="ev-ligne" href="${etats[e.id] === 'brouillon' ? `/admin/evenements/${e.id}` : `/evenements/${e.id}`}"><span><b>${echapper(e.titre)}</b><br>
      <span class="doux petit">${etats[e.id] === 'brouillon' ? (e.attente_jours != null ? `Début ${e.attente_jours} j après la mise en ligne · ${e.duree_jours ? `${e.duree_jours} j` : 'durée indéfinie'}` : 'Dates à choisir à la mise en ligne') : `${e.fin === SANS_FIN ? `Depuis le ${echapper(e.debut)} · durée indéfinie` : `Du ${echapper(e.debut)} au ${echapper(e.fin)}`} · ${nbInscrits[e.id] || 0} inscrit(s)`}</span></span><span class="etat" data-etat="${c}">${l}</span></a>`; };
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
    <div class="champ"><label>Bannière (facultative : tu pourras l'ajouter après)</label><div data-images="/admin/images" data-une><label class="fichier">${ICONE.plus}<span><b>Ajouter une bannière</b><br>Format large, ex. 1200 × 400. Sans bannière : la couleur du challenge.</span><input type="file" accept="image/*" hidden></label>
      <input type="hidden" name="banniere" value=""><div class="apercus" style="margin-top:8px"></div></div></div>
    <div class="champ"><label>Couleurs de la bannière (générée avec le badge)</label>
      <div class="ev-couleurs">${[['texte', 'Texte'], ['fond', 'Fond'], ['fondu', 'Fondu'], ['halo', 'Halo du badge'], ['bouton', 'Bouton']].map(([k, l]) => `<label><input type="color" name="c_${k}" value="${COULEURS[k]}">${l}</label>`).join('')}</div>
      <div class="champ" style="margin-top:8px"><label for="ev-effet">Effet derrière le badge (carte et page du challenge)</label><select id="ev-effet" name="effet">${Object.entries(EFFETS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <small>Avec la couleur « Halo du badge » comme couleur d'accent.</small></div>
      <div class="ev-apercu" aria-label="Aperçu de la bannière"></div>
      <small>L'aperçu se met à jour avec le nom, les couleurs et le badge or (partie 4).</small></div>
    <div class="ev-section"><h3>2. Les délais</h3><p class="doux petit" style="margin:0">Des nombres de jours, pas des dates : elles se calculent au moment de la mise en ligne.</p></div>
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:10px">
      <div class="champ"><label for="ev-attente">Attente avant le début</label><input id="ev-attente" name="attente_jours" type="number" min="${DEBUT_MIN}" max="${DEBUT_MAX}" value="7" required><small>${DEBUT_MIN} à ${DEBUT_MAX} jours : le temps de réunir les trophées demandés et de s'inscrire.</small></div>
      <div class="champ"><label for="ev-heure">Heure de début (facultatif)</label><input id="ev-heure" name="heure" type="time"><small>GMT. Vide : l'heure de la mise en ligne.</small></div></div>
    <div class="champ"><label for="ev-duree">Durée du challenge</label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input id="ev-duree" name="duree_jours" type="number" min="${DUREE_MIN}" max="${DUREE_MAX}" value="14" style="max-width:120px"><span class="doux">jours</span>
        <label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:600"><input type="checkbox" name="duree_indefinie" value="1" style="width:auto;margin:0"> Indéfinie</label></div>
      <small>${DUREE_MIN} à ${DUREE_MAX} jours, ou indéfinie : jusqu'à ce que tous les gagnants aient atteint le palier.</small></div>
    <div class="ev-section"><h3>3. La course</h3><p class="doux petit" style="margin:0">Pour chaque stat suivie, un palier : les premiers à l'atteindre gagnent. Une course par stat.</p></div>
    <div><b style="font-size:14px">Ce qui est suivi, et le palier à atteindre</b><p class="doux petit" style="margin:2px 0 8px">Les 3 stats : challenge global, ses rappels remplacent les rappels habituels des inscrits.</p>
      <div style="display:grid;gap:8px">${Object.entries(STATS).map(([k, l], i) => `<div class="ev-stat" style="display:grid;grid-template-columns:auto minmax(0, 1fr);gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid #2a2a2a">
        <label style="display:flex;gap:8px;align-items:center;margin:0;font-weight:600;min-width:130px"><input type="checkbox" name="stats" value="${k}"${i === 0 ? ' checked' : ''} style="width:auto;margin:0">${echapper(l)}</label>
        <input name="palier_${k}" inputmode="decimal" placeholder="${{ revenus: 'Palier en $, ex. 1000', vues: 'Palier, ex. 1000000', abonnes: 'Palier, ex. 10000' }[k]}"${i === 0 ? '' : ' disabled'}></div>`).join('')}</div></div>
    <div class="champ"><label for="ev-gagnants">Nombre de gagnants (par stat)</label><select id="ev-gagnants" name="gagnants"><option value="1">1 : le premier seulement (badge or)</option><option value="2">2 : or et argent</option><option value="3" selected>3 : or, argent, bronze</option></select></div>
    <div class="champ"><label for="ev-points">Pour gagner (facultatif)</label><textarea id="ev-points" name="regles_points" maxlength="2000" placeholder="Vide : « Les 3 premiers à atteindre … gagnent le badge. »"></textarea></div>
    <div class="champ"><label for="ev-valid">Validation des résultats (facultatif)</label><textarea id="ev-valid" name="regles_validation" maxlength="2000" placeholder="ex. Seuls les résultats validés par le coach comptent ; capture obligatoire à chaque update."></textarea></div>
    <div><b style="font-size:14px">Conditions de participation</b><p class="doux petit" style="margin:2px 0 8px">Pour chaque famille, le trophée minimum pour participer (ou aucun).</p><div style="display:grid;gap:12px">${choixConditions}</div></div>
    <div class="ev-section"><h3>4. La récompense</h3><p class="doux petit" style="margin:0">Un badge par gagnant : or (1er), argent (2e), bronze (3e), selon le nombre de gagnants. Le badge du plus haut niveau sert d'étendard (bannière, carte, page).</p></div>
    <div class="champ"><label for="ev-badge">Nom du badge</label><input id="ev-badge" name="badge_nom" maxlength="60" placeholder="ex. Overmaxx 1000"></div>
    ${BLOC_BADGES(ICONE)}
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:8px">
      <button class="bouton secondaire" type="submit" name="action" value="brouillon" formnovalidate style="margin:0">Mettre en brouillon</button>
      <button class="bouton" type="submit" name="action" value="publier" style="margin:0">Mettre en ligne</button></div>
    <p class="doux petit" style="margin:-4px 0 0">En ligne : le challenge commence dans le nombre de jours choisi. En brouillon : rien n'est visible, tu le mets en ligne quand tu veux.</p>
  </form>`, espace, 'gestion', null, `${SCRIPT_BADGES}
  (function () {
    var f = document.querySelector('form[action="/admin/evenements"]'); if (!f) return;
    // Palier : actif seulement pour les stats suivies.
    f.querySelectorAll('input[name="stats"]').forEach(function (c) { function maj() { var p = f.querySelector('[name="palier_' + c.value + '"]'); p.disabled = !c.checked; p.required = c.checked; } c.addEventListener('change', maj); maj(); });
    // Durée indéfinie : plus de nombre de jours.
    var ind = f.querySelector('[name="duree_indefinie"]'), dur = f.querySelector('[name="duree_jours"]');
    function majDuree() { dur.disabled = ind.checked; dur.required = !ind.checked; } ind.addEventListener('change', majDuree); majDuree();
    // Aperçu de la bannière : nom, couleurs, badge or.
    var ap = f.querySelector('.ev-apercu');
    function apercu() {
      var c = {}; ['texte', 'fond', 'fondu', 'halo', 'bouton'].forEach(function (k) { c[k] = f.querySelector('[name="c_' + k + '"]').value; });
      var img = f.querySelector('[data-apercu="or"] img');
      var t = (f.querySelector('[name="titre"]').value || 'Nom du challenge').replace(/[<>&]/g, '');
      ap.innerHTML = '<div class="evt evt-gen" style="height:100%;--texte:' + c.texte + ';--fond:' + c.fond + ';--fondu:' + c.fondu + ';--halo:' + c.halo + ';--bouton:' + c.bouton + '">'
        + '<span class="evt-g-texte"><small>Événement</small><b>' + t + '</b><span class="evt-compte">Les inscriptions se terminent dans ' + (f.querySelector('[name="attente_jours"]').value || 7) + ' jours</span><em>Afficher</em></span>'
        + '<span class="evt-g-badge">' + (img ? '<img src="' + img.src + '" alt="">' : '<span class="evc-hexa">' + t.split(/\\s+/).map(function (m) { return m[0] || ''; }).join('').slice(0, 3).toUpperCase() + '</span>') + '</span></div>';
    }
    f.addEventListener('input', apercu); f.addEventListener('change', apercu);
    new MutationObserver(apercu).observe(f.querySelector('.badges-slots') || f, { childList: true, subtree: true });
    apercu();
    // Nombre de gagnants : autant de badges.
    var g = f.querySelector('[name="gagnants"]');
    function majBadges() { var n = +g.value; ['or', 'argent', 'bronze'].forEach(function (m, i) { var s = f.querySelector('.badge-slot[data-metal="' + m + '"]'); if (s) s.hidden = i >= n; }); }
    g.addEventListener('change', majBadges); majBadges();
  })();
  document.querySelectorAll('input[type=radio][name^="cond_"]').forEach(function (r) { r.addEventListener('change', function () {
    var s = document.querySelector('[data-choisi="' + r.name.slice(5) + '"]'); if (s) s.textContent = r.value ? '· ' + r.getAttribute('data-titre') + ' minimum' : '· aucun'; }); });`);
}

// Un brouillon : tout ce qui a été préparé, puis la publication (dates) ou la suppression.
function pageBrouillon(config, { espace, e, bornes, conditions = [], erreur }) {
  const badges = rangsDe(e).map((r) => ({ image: e[`badge_${RANGS[r]}`], metal: RANGS[r], titre: e.badge_nom || e.titre }));
  const parDelais = e.attente_jours != null;
  return page(e.titre, `${STYLE_EVT}<a class="retour" href="/admin/evenements"><span aria-hidden="true">‹</span> Événements</a>
  ${e.affiche ? `<img class="ev-affiche" src="/fichiers/images/${echapper(e.affiche)}" alt="">` : ''}
  <div class="titre-page"><div><p class="etiquette">Brouillon</p><h1>${echapper(e.titre)}</h1></div><span class="etat" data-etat="attente">Brouillon</span></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <div class="carte">${e.objectif ? `<p style="margin:0 0 8px;font-size:17px"><b>${echapper(e.objectif)}</b></p>` : ''}<p style="margin:0;white-space:pre-line">${echapper(e.description)}</p>
    <p class="doux petit" style="margin:10px 0 0">Suivi : ${echapper(e.stats.map((x) => `${STATS[x]}${e.paliers && e.paliers[x] ? ` (palier ${palierTxt(x, e.paliers[x])})` : ''}`).join(', '))}
      · ${rangsDe(e).length} gagnant(s) par stat${parDelais ? ` · début ${e.attente_jours} jour(s) après la mise en ligne${e.heure ? ` à ${echapper(e.heure)} GMT` : ''} · ${e.duree_jours ? `${e.duree_jours} jour(s)` : 'durée indéfinie'}` : ''}</p></div>
  <div class="carte"><h2>Pour gagner</h2><p style="margin:0;white-space:pre-line">${echapper(e.regles_points || '')}</p>
    ${e.regles_validation ? `<h3 style="margin:12px 0 4px;font-size:15px">Validation des résultats</h3><p style="margin:0;white-space:pre-line">${echapper(e.regles_validation)}</p>` : ''}
    <div style="display:flex;gap:12px;justify-content:center;margin-top:12px">${badges.map((b) => pieceBadge(b, { taille: 56 })).join('')}</div></div>
  <div class="carte"><h2>Pour participer</h2>${conditions.length ? `<div class="ev-cond">${conditions.map((c) => `<div>${pieceTrophee(c.trophee, { taille: 40 })}<span><b>${echapper(c.trophee.titre)}</b><small>${echapper(c.trophee.but)} (ou mieux)</small></span></div>`).join('')}</div>` : '<p class="doux" style="margin:0">Ouvert à tous.</p>'}</div>
  ${parDelais ? `<form class="carte" method="post" action="/admin/evenements/${e.id}/publier" style="display:grid;gap:10px">
    <h2 style="margin:0">Mettre en ligne</h2>
    <p class="doux petit" style="margin:0">Le challenge commencera ${e.attente_jours} jour(s) après la mise en ligne${e.heure ? `, à ${echapper(e.heure)} GMT` : ''}, et durera ${e.duree_jours ? `${e.duree_jours} jour(s)` : 'jusqu\'à ce que tous les gagnants aient atteint le palier'}.</p>
    <button class="bouton" type="submit" style="margin:0">Mettre en ligne</button></form>` : `<form class="carte" method="post" action="/admin/evenements/${e.id}/publier" style="display:grid;grid-template-columns:minmax(0, 1fr);gap:10px">
    <h2 style="margin:0">Publier</h2>
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:10px">
      <div class="champ"><label for="ev-debut">Début</label><input id="ev-debut" name="debut" type="date" required min="${bornes.debutMin}" max="${bornes.debutMax}" value="${bornes.debutMin}"></div>
      <div class="champ"><label for="ev-fin">Fin</label><input id="ev-fin" name="fin" type="date" required></div></div>
    <p class="doux petit" style="margin:0">Début dans ${DEBUT_MIN} à ${DEBUT_MAX} jours (le temps de s'y préparer). Durée : ${DUREE_MIN} à ${DUREE_MAX} jours. La bannière défile dès la publication.</p>
    <button class="bouton" type="submit" style="margin:0">Publier l'événement</button></form>`}
  <form method="post" action="/admin/evenements/${e.id}/supprimer"><button class="bouton secondaire" type="submit" style="margin:0" onclick="return confirm('Supprimer ce brouillon ?')">Supprimer le brouillon</button></form>`, espace, 'gestion');
}

module.exports = { pageNouvelEvenement, pageBrouillon, pageEvenement, pageEvenementsCoach, classementEvenement, pieceBadge, valeurStat, palierTxt };
