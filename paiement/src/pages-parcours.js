'use strict';

// Parcours de l'accompagnement Elite (livraison 1) : Mon parcours, les étapes 1 à 3, la fiche du membre,
// et côté coach : À traiter et la validation d'un envoi. Voir docs/ACCOMPAGNEMENT-ELITE.md.
const { ICONE, echapper, gabaritEspace, formatDate, blocVideo } = require('./pages');

const ETAPES = [
  { n: 1, titre: 'Prise en main', court: 'Prise en main' },
  { n: 2, titre: 'Coaching d\'entrée', court: 'Coaching' },
  { n: 3, titre: 'Validation du contenu', court: 'Contenu' },
  { n: 4, titre: 'Publication et suivi', court: 'Publication' },
  { n: 5, titre: 'GOAT', court: 'GOAT' },
];

const STYLE_PARCOURS = `<style>
  .etapes { display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin:4px 0 18px; padding:0; list-style:none; }
  .etapes li { display:grid; gap:6px; justify-items:center; text-align:center; font-size:11px; color:var(--gris); min-width:0; }
  .etapes .rond-etape { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; border:2px solid var(--bord-fort); font-weight:800; font-size:12px; color:var(--gris); background:var(--fond); }
  .etapes li[data-etat="fait"] { color:var(--doux); }
  .etapes li[data-etat="fait"] .rond-etape { border-color:var(--ok); background:var(--ok); color:#000; }
  .etapes li[data-etat="fait"] .rond-etape svg { width:16px; height:16px; stroke-width:3; }
  .etapes li[data-etat="encours"] { color:#fff; font-weight:700; }
  .etapes li[data-etat="encours"] .rond-etape { border-color:#fff; color:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.12); }
  .etapes span.nom { overflow-wrap:anywhere; line-height:1.25; }
  .delai { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px; font-size:12.5px; font-weight:700; border:1px solid var(--bord-fort); color:#fff; }
  .delai::before { content:""; width:7px; height:7px; border-radius:50%; background:currentColor; }
  .delai[data-niveau="urgent"] { color:#f1d38a; border-color:rgba(241,211,138,.45); }
  .delai[data-niveau="retard"] { color:var(--erreur); border-color:rgba(255,77,77,.5); }
  .delai[data-niveau="ok"] { color:var(--ok); border-color:rgba(61,220,132,.4); }
  .a-faire { border-color:#fff; }
  .a-faire h2 { font-size:19px; margin:8px 0 6px; }
  .envoi { display:grid; gap:12px; }
  .envoi-tete { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .envoi-tete h2 { margin:0; font-size:16px; }
  .etat { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; background:var(--surface-2); color:var(--doux); }
  .etat svg { width:14px; height:14px; stroke-width:3; }
  .etat[data-etat="valide"] { background:rgba(61,220,132,.14); color:var(--ok); }
  .etat[data-etat="attente"] { background:rgba(241,211,138,.12); color:#f1d38a; }
  .etat[data-etat="corriger"] { background:rgba(255,77,77,.12); color:var(--erreur); }
  .champ { display:grid; gap:6px; }
  .champ label { font-weight:600; font-size:14px; }
  .champ small { color:var(--doux); font-size:12px; }
  textarea { width:100%; min-height:110px; padding:12px 14px; border-radius:14px; border:1px solid var(--bord-fort); background:#000; color:#fff; font:14px/1.5 var(--police); resize:vertical; }
  .fichier { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px dashed var(--bord-fort); border-radius:14px; color:var(--doux); font-size:13px; }
  .fichier b { color:#fff; }
  .remarque { padding:14px; border-radius:14px; background:var(--surface-2); border:1px solid var(--bord); display:grid; gap:8px; }
  .remarque .qui { font-size:12px; color:var(--doux); }
  .remarque p { margin:0; }
  .remarque a { color:#fff; }
  .remarque img { width:100%; max-width:320px; border-radius:10px; border:1px solid var(--bord); }
  .remarque[data-type="corriger"] { border-color:rgba(255,77,77,.45); }
  .recap { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .recap div { padding:12px; border-radius:14px; background:var(--surface-2); }
  .recap b { display:block; font-size:20px; letter-spacing:-0.02em; }
  .recap span { color:var(--doux); font-size:12px; }
  .creneaux { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; }
  .creneaux label { display:grid; gap:2px; padding:10px 12px; border-radius:12px; border:1px solid var(--bord-fort); cursor:pointer; font-size:13px; }
  .creneaux input { position:absolute; opacity:0; pointer-events:none; }
  .creneaux label b { font-size:14px; }
  .creneaux label:has(input:checked) { background:#fff; color:#000; border-color:#fff; }
  .deux-boutons { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .deux-boutons .bouton { margin-top:0; }
  .bouton.vert { background:var(--ok); border-color:var(--ok); color:#000; }
  .ligne-envoi { display:flex; align-items:center; gap:14px; padding:14px 0; border-top:1px solid var(--bord); }
  .ligne-envoi:first-child { border-top:0; padding-top:4px; }
  .ligne-envoi .qui { flex:1; min-width:0; }
  .ligne-envoi .qui b { display:block; }
  .ligne-envoi .qui span { color:var(--doux); font-size:13px; }
  .ligne-envoi .bouton { width:auto; min-height:38px; margin:0; padding:8px 16px; }
  .note-ia { font-size:28px; font-weight:800; letter-spacing:-0.03em; }
  .note-ia small { font-size:14px; color:var(--doux); font-weight:600; }
  details.carte summary { cursor:pointer; font-weight:600; }
  @media (min-width: 960px) { .etapes li { font-size:12.5px; } .colonnes-2 { display:grid; grid-template-columns:minmax(0, 1fr) 360px; gap:24px; align-items:start; } }
</style>`;

// ---------- Petits blocs réutilisés ----------
function frise(etapeActuelle) {
  return `<ol class="etapes" aria-label="Étapes de l'accompagnement">${ETAPES.map((e) => {
    const etat = e.n < etapeActuelle ? 'fait' : e.n === etapeActuelle ? 'encours' : 'attente';
    return `<li data-etat="${etat}"><span class="rond-etape">${etat === 'fait' ? ICONE.ok : e.n === 5 ? 'G' : e.n}</span><span class="nom">${echapper(e.court)}</span></li>`;
  }).join('')}</ol>`;
}

// Délai restant : « Il te reste 2 j 5 h », en jaune quand il reste moins d'un quart du temps, en rouge en retard.
function delai({ fin, duree }, maintenant = new Date()) {
  if (!fin) return '';
  const reste = new Date(fin) - maintenant;
  const h = Math.abs(reste) / 3600000;
  const texte = h >= 48 ? `${Math.floor(h / 24)} j ${Math.floor(h % 24)} h` : h >= 1 ? `${Math.floor(h)} h` : `${Math.max(1, Math.round(h * 60))} min`;
  const niveau = reste < 0 ? 'retard' : duree && reste < duree / 4 ? 'urgent' : 'normal';
  return `<span class="delai" data-niveau="${niveau}">${reste < 0 ? `En retard de ${texte}` : `Il te reste ${texte}`}</span>`;
}

const ETATS = {
  vide: ['vide', 'À envoyer'],
  attente: ['attente', 'En attente de validation'],
  corriger: ['corriger', 'À corriger'],
  valide: ['valide', 'Validé'],
};
const etat = (cle) => `<span class="etat" data-etat="${ETATS[cle][0]}">${cle === 'valide' ? ICONE.ok : ''}${ETATS[cle][1]}</span>`;

function remarque(r) {
  return `<div class="remarque"${r.type ? ` data-type="${echapper(r.type)}"` : ''}>
    <span class="qui">${echapper(r.auteur || 'Ton coach')} · ${echapper(formatDate(r.le))}</span>
    <p>${r.html || echapper(r.texte || '')}</p>
    ${(r.liens || []).map((l) => `<a href="${echapper(l.url)}" target="_blank" rel="noopener">${echapper(l.titre)}</a>`).join('')}
    ${(r.images || []).map((src) => `<img src="${echapper(src)}" alt="Image jointe par le coach" loading="lazy">`).join('')}
  </div>`;
}

// ---------- Menus ----------
function navParcours(espace = {}) {
  if (espace.estAdmin) {
    return [{ section: 'Gestion' },
      { cle: 'calendrier', libelle: 'Calendrier', lien: '/admin', icone: 'calendrier' },
      { cle: 'traiter', libelle: 'À traiter', lien: '/admin/a-traiter', icone: 'traiter', badge: espace.aTraiter || null },
      { cle: 'candidatures', libelle: 'Candidatures', lien: '/admin/candidatures', icone: 'candidatures' },
      { cle: 'membres', libelle: 'Membres', lien: '/admin/membres', icone: 'membres' },
      { cle: 'pages', libelle: 'Pages du site', lien: '/admin/pages', icone: 'pages' },
      { section: 'Overmaxx' }, { cle: 'site', libelle: 'Site public', lien: '/', icone: 'site', externe: true }];
  }
  return [{ section: 'Mon accompagnement' },
    { cle: 'parcours', libelle: 'Mon parcours', lien: '/parcours', icone: 'parcours' },
    { cle: 'fiche', libelle: 'Ma fiche', lien: '/fiche', icone: 'fiche' },
    { cle: 'coaching', libelle: 'Mes coachings', lien: '/coaching', icone: 'coaching' },
    { section: 'Overmaxx' }, { cle: 'site', libelle: 'Site public', lien: '/', icone: 'site', externe: true }];
}
const page = (titre, contenu, espace, actif) => gabaritEspace(titre, `${STYLE_PARCOURS}${contenu}`, {
  nav: navParcours(espace), actif,
  compte: espace.session ? { pseudo: espace.session.pseudo || '', role: espace.estAdmin ? 'Coach' : 'Elite' } : null,
});

// ---------- Membre : Mon parcours ----------
function pageParcours(config, { espace, jour, etape, aFaire, prochainCoaching, derniereRemarque, formation }) {
  return page('Mon parcours', `
  <div class="titre-page"><div><p class="etiquette">Overmaxx Elite · jour ${jour} sur 90</p><h1>Mon parcours</h1></div></div>
  ${frise(etape)}
  <div class="colonnes-2">
    <div>
      <div class="carte a-faire">
        <div class="envoi-tete"><p class="etiquette" style="margin:0">À faire maintenant · étape ${etape}</p>${delai(aFaire.delai || {})}</div>
        <h2>${echapper(aFaire.titre)}</h2>
        <p class="doux" style="margin:0">${echapper(aFaire.texte)}</p>
        <a class="bouton" href="${echapper(aFaire.lien)}">${echapper(aFaire.bouton)}</a>
      </div>
      ${derniereRemarque ? `<div class="carte"><div class="envoi-tete"><h2>Dernière remarque du coach</h2><a class="doux petit" href="/fiche#remarques">Toutes les remarques</a></div>
        ${remarque(derniereRemarque)}</div>` : ''}
    </div>
    <div>
      <div class="carte">
        <h2>Prochain coaching</h2>
        ${prochainCoaching ? `<p style="margin:0"><b>${echapper(prochainCoaching.quand)}</b></p><p class="doux petit" style="margin:4px 0 0">${echapper(prochainCoaching.note || '')}</p>`
          : '<p class="doux" style="margin:0">Aucun coaching réservé.</p>'}
        <a class="bouton secondaire" href="/coaching">Mes coachings</a>
      </div>
      <div class="carte">
        <h2>Formation sur Whop</h2>
        <div class="recap"><div><b>${formation.faites} / ${formation.total}</b><span>leçons terminées</span></div>
          <div><b>${echapper(formation.derniere || '—')}</b><span>dernière activité</span></div></div>
        <p class="doux petit" style="margin:10px 0 0">Mis à jour tout seul depuis Whop : rien à cocher.</p>
      </div>
    </div>
  </div>`, espace, 'parcours');
}

// ---------- Membre : étape 1 ----------
function blocExercice(ex) {
  const corps = ex.etat === 'vide' ? `
    <div class="champ"><label for="video-${ex.niveau}">Ta vidéo</label>
      <label class="fichier" for="video-${ex.niveau}">${ICONE.plus}<span><b>Choisir la vidéo</b><br>MP4, MOV ou WEBM · 150 Mo maximum</span></label>
      <input id="video-${ex.niveau}" type="file" accept="video/*" hidden></div>
    <div class="champ"><label for="note-${ex.niveau}">Note donnée par l'IA</label><input id="note-${ex.niveau}" type="number" min="0" max="100" placeholder="ex. 84"><small>Sur 100, telle que l'IA te l'a donnée.</small></div>
    <div class="champ"><label for="retour-${ex.niveau}">Retour de l'IA</label><textarea id="retour-${ex.niveau}" placeholder="Colle ici tout le retour de l'IA."></textarea></div>
    <button class="bouton" type="button">Envoyer l'exercice ${ex.niveau}</button>`
    : `<div class="recap"><div><b>${echapper(ex.note)} / 100</b><span>note de l'IA</span></div><div><b>${echapper(ex.envoyeLe || '')}</b><span>envoyé</span></div></div>
       ${ex.remarque ? remarque(ex.remarque) : ''}`;
  return `<div class="carte envoi"><div class="envoi-tete"><h2>Exercice ${ex.niveau}</h2>${etat(ex.etat)}</div>${corps}</div>`;
}

function pageEtape1(config, { espace, delai: d, modules, exercices }) {
  return page('Étape 1 · Prise en main', `
  <div class="titre-page"><div><p class="etiquette">Étape 1 sur 4</p><h1>Prise en main</h1></div>${delai(d)}</div>
  ${frise(1)}
  ${blocVideo(config.offres.elite.wistiaEtape1 || '', 'Étape 1 : ce que tu dois faire')}
  <div class="carte">
    <h2>Ce que tu dois faire (3 jours)</h2>
    <ol class="frise">
      <li data-etat="${modules.faites >= modules.total ? 'fait' : 'encours'}"><span class="point"></span><div class="titre">Regarde la première partie des modules</div>
        <div class="desc">${modules.faites} / ${modules.total} leçons terminées sur Whop (mis à jour tout seul).</div></li>
      <li data-etat="encours"><span class="point"></span><div class="titre">Fais les exercices L1 et L2</div>
        <div class="desc">Fais noter chaque vidéo par l'IA avec le prompt du module, puis garde sa note et son retour.</div></li>
      <li data-etat="attente"><span class="point"></span><div class="titre">Envoie tes deux exercices ici</div><div class="desc">Ton coach les regarde et valide ton étape.</div></li>
    </ol>
  </div>
  <div class="grille-cartes">${exercices.map(blocExercice).join('')}</div>`, espace, 'parcours');
}

// ---------- Membre : étape 2 ----------
function pageEtape2(config, { espace, delai: d, creneaux = [], reserve }) {
  const choix = reserve ? `
    <div class="carte">
      <div class="envoi-tete"><h2>Ton coaching d'entrée</h2>${etat('valide')}</div>
      <p style="margin:0"><b>${echapper(reserve.quand)}</b></p>
      <p class="doux petit" style="margin:4px 0 0">Tu peux le reporter jusqu'à 30 minutes avant.</p>
    </div>
    <div class="carte"><h2>Prépare ton coaching</h2><ul class="liste">
      <li>${ICONE.ok}<span>Tes deux exercices de l'étape 1, et les remarques de ton coach.</span></li>
      <li>${ICONE.ok}<span>Ton pays cible.</span></li>
      <li>${ICONE.ok}<span>Tes disponibilités de la semaine, pour réserver tes coachings ensemble.</span></li>
    </ul><p class="doux petit" style="margin:10px 0 0">Pendant ce coaching : choix de ta niche, ton compte monétisé, ta connexion, et tes coachings de la semaine.</p></div>`
    : `<div class="carte">
      <h2>Choisis ton coaching d'entrée</h2>
      <p class="doux">Un seul coaching, de 30 minutes. Heures affichées à ton heure (${echapper(espace.fuseau || 'heure de ton téléphone')}).</p>
      <div class="creneaux">${creneaux.map((c, i) => `<label><input type="radio" name="entree" value="${i}"${i === 0 ? ' checked' : ''}><b>${echapper(c.jour)}</b>${echapper(c.heure)}</label>`).join('')}</div>
      <button class="bouton" type="button">Réserver ce coaching</button>
    </div>`;
  return page('Étape 2 · Coaching d\'entrée', `
  <div class="titre-page"><div><p class="etiquette">Étape 2 sur 4</p><h1>Coaching d'entrée</h1></div>${reserve ? '' : delai(d)}</div>
  ${frise(2)}
  ${blocVideo(config.offres.elite.wistiaEtape2 || '', 'Étape 2 : ton coaching d\'entrée')}
  ${choix}`, espace, 'parcours');
}

// ---------- Membre : étape 3 ----------
function blocVideoEtape3(v) {
  const corps = v.etat === 'vide' ? `
    <label class="fichier" for="v${v.n}">${ICONE.plus}<span><b>Choisir la vidéo ${v.n}</b><br>150 Mo maximum</span></label>
    <input id="v${v.n}" type="file" accept="video/*" hidden>
    <button class="bouton" type="button">Envoyer la vidéo ${v.n}</button>`
    : v.etat === 'corriger' ? `${remarque({ ...v.remarque, type: 'corriger' })}
    ${v.delai ? `<div>${delai(v.delai)}</div>` : ''}
    <label class="fichier" for="v${v.n}">${ICONE.plus}<span><b>Envoyer la nouvelle version</b><br>Elle remplace l'ancienne.</span></label>
    <input id="v${v.n}" type="file" accept="video/*" hidden>`
    : `<p class="doux petit" style="margin:0">Envoyée ${echapper(v.envoyeLe || '')}</p>${v.remarque ? remarque(v.remarque) : ''}`;
  return `<div class="carte envoi"><div class="envoi-tete"><h2>Vidéo ${v.n}</h2>${etat(v.etat)}</div>${corps}</div>`;
}

function pageEtape3(config, { espace, delai: d, videos, coachings }) {
  const valides = videos.filter((v) => v.etat === 'valide').length;
  return page('Étape 3 · Validation du contenu', `
  <div class="titre-page"><div><p class="etiquette">Étape 3 sur 4</p><h1>Validation du contenu</h1></div>${delai(d)}</div>
  ${frise(3)}
  ${blocVideo(config.offres.elite.wistiaEtape3 || '', 'Étape 3 : tes 3 vidéos')}
  <div class="carte">
    <div class="envoi-tete"><h2>Tes 3 vidéos, avant de publier</h2><span class="etat" data-etat="${valides === 3 ? 'valide' : 'attente'}">${valides} / 3 validées</span></div>
    <p class="doux" style="margin:8px 0 0">Ne publie rien pour l'instant. Quand tes 3 vidéos auront la coche verte, tu seras autorisé à publier.</p>
  </div>
  <div class="grille-cartes">${videos.map(blocVideoEtape3).join('')}</div>
  <div class="carte">
    <div class="envoi-tete"><h2>Mes coachings de la semaine</h2>${coachings.reserves >= coachings.minimum ? `<span class="etat" data-etat="valide">${ICONE.ok}Réservés</span>` : '<span class="etat" data-etat="corriger">À réserver</span>'}</div>
    <p class="doux" style="margin:8px 0 0">${coachings.reserves} réservé(s) · minimum ${coachings.minimum}, maximum ${coachings.maximum} par semaine.</p>
    <a class="bouton secondaire" href="/coaching">Mes coachings</a>
  </div>`, espace, 'parcours');
}

// ---------- La fiche (membre ou coach) ----------
function pageFiche(config, { espace, vueCoach, membre, etapes, remarques = [], toutes }) {
  const visibles = toutes ? remarques : remarques.slice(0, 1);
  return page(vueCoach ? `Fiche de ${membre.pseudo}` : 'Ma fiche', `
  <div class="titre-page"><div><p class="etiquette">${vueCoach ? 'Fiche Elite' : 'Overmaxx Elite'}</p><h1>${echapper(vueCoach ? membre.nom : 'Ma fiche')}</h1></div>
    ${vueCoach ? '<a class="bouton" style="width:auto;margin:0" href="#remarque">Écrire une remarque</a>' : ''}</div>
  ${frise(membre.etape)}
  <div class="colonnes-2">
    <div>
      ${vueCoach ? `<div class="carte" id="remarque"><h2>Nouvelle remarque</h2>
        <textarea placeholder="Ta remarque. Les liens (https://…) deviennent cliquables."></textarea>
        <label class="fichier" style="margin-top:10px">${ICONE.plus}<span><b>Ajouter des images</b><br>Captures, exemples…</span></label>
        <button class="bouton" type="button">Publier la remarque</button>
        <p class="doux petit" style="margin:10px 0 0">${echapper(membre.pseudo)} la voit sur sa fiche, et Bob le prévient.</p></div>` : ''}
      <div class="carte" id="remarques">
        <div class="envoi-tete"><h2>Remarques du coach</h2><span class="doux petit">${remarques.length} au total</span></div>
        <div style="display:grid;gap:10px;margin-top:12px">${visibles.map(remarque).join('') || '<p class="doux" style="margin:0">Pas encore de remarque.</p>'}</div>
        ${!toutes && remarques.length > 1 ? `<a class="bouton secondaire" href="?toutes=1#remarques">Tout afficher (${remarques.length})</a>` : ''}
      </div>
    </div>
    <div>
      <div class="carte"><h2>Identité</h2><dl class="details">
        <div><dt>Discord</dt><dd>${echapper(membre.pseudo)}</dd></div>
        <div><dt>Entrée</dt><dd>${echapper(membre.entree)}</dd></div>
        <div><dt>Fin des 90 jours</dt><dd>${echapper(membre.fin)}</dd></div>
        <div><dt>Niveau</dt><dd>${echapper(membre.niveau || '—')}</dd></div>
      </dl></div>
      <div class="carte"><h2>Compte TikTok</h2><dl class="details">
        <div><dt>Compte</dt><dd>${echapper(membre.compte || 'à l\'étape 2')}</dd></div>
        <div><dt>Niche</dt><dd>${echapper(membre.niche || '—')}</dd></div>
        <div><dt>Pays cible</dt><dd>${echapper(membre.pays || '—')}</dd></div>
      </dl>${vueCoach ? '<a class="bouton secondaire" href="#">Modifier</a>' : ''}</div>
      <div class="carte"><h2>Parcours</h2><dl class="details">${etapes.map((e) => `<div><dt>${echapper(e.titre)}</dt><dd>${echapper(e.le || '—')}</dd></div>`).join('')}</dl>
        ${vueCoach ? '<a class="bouton secondaire" href="#">Ouvrir l\'étape suivante</a>' : ''}</div>
      <div class="carte"><h2>Statistiques</h2><p class="doux" style="margin:0">Elles s'afficheront à partir de l'étape 4, avec ses comptes rendus.</p></div>
    </div>
  </div>`, espace, vueCoach ? 'membres' : 'fiche');
}

// ---------- Coach : À traiter ----------
function pageATraiter(config, { espace, groupes }) {
  return page('À traiter', `
  <div class="titre-page"><div><p class="etiquette">Gestion</p><h1>À traiter</h1></div><span class="doux petit">${groupes.reduce((n, g) => n + g.lignes.length, 0)} en attente</span></div>
  ${groupes.map((g) => `<div class="carte"><h2>${echapper(g.titre)}</h2>
    ${g.lignes.map((l) => `<div class="ligne-envoi"><div class="qui"><b>${echapper(l.membre)}</b><span>${echapper(l.quoi)} · ${echapper(l.depuis)}</span></div>
      ${l.retard ? '<span class="etat" data-etat="corriger">En retard</span>' : ''}<a class="bouton secondaire" href="${echapper(l.lien)}">Ouvrir</a></div>`).join('')
      || '<p class="doux" style="margin:0">Rien à traiter.</p>'}</div>`).join('')}`, espace, 'traiter');
}

// ---------- Coach : valider un envoi ----------
function pageEnvoi(config, { espace, envoi, membre }) {
  const etape1 = envoi.etape === 1;
  return page(`Envoi de ${membre.pseudo}`, `
  <div class="titre-page"><div><p class="etiquette">${echapper(membre.nom)} · étape ${envoi.etape}</p><h1>${echapper(envoi.titre)}</h1></div>${etat(envoi.etat)}</div>
  <div class="colonnes-2">
    <div>
      <div class="video" style="display:grid;place-items:center;color:var(--doux)">${ICONE.lecture}</div>
      ${envoi.note !== undefined ? `<div class="carte"><div class="envoi-tete"><h2>Note de l'IA</h2><span class="note-ia">${echapper(envoi.note)}<small> / 100</small></span></div>
        <details style="margin-top:10px"><summary>Retour de l'IA (copié par ${echapper(membre.pseudo)})</summary><p class="doux" style="white-space:pre-line">${echapper(envoi.retourIA || '')}</p></details></div>` : ''}
    </div>
    <div>
      <div class="carte">
        <h2>Ta décision</h2>
        ${etape1 ? `<div class="champ"><label for="niveau">Niveau</label>
          <select id="niveau" style="width:100%;padding:12px;border-radius:14px;background:#000;color:#fff;border:1px solid var(--bord-fort)">
            <option${envoi.niveauPropose === 'L2' ? ' selected' : ''}>L2</option><option${envoi.niveauPropose === 'L1' ? ' selected' : ''}>L1</option></select>
          <small>Proposé : ${echapper(envoi.niveauPropose)} (les deux notes ${envoi.niveauPropose === 'L2' ? 'sont' : 'ne sont pas toutes'} à 80 ou plus).</small></div>` : ''}
        <div class="champ" style="margin-top:12px"><label for="retour">${etape1 ? 'Tes remarques (facultatif)' : 'Ton retour complet'}</label>
          <textarea id="retour" placeholder="${etape1 ? 'Ce qu\'il peut améliorer.' : 'Ce qui va, ce qui ne va pas, et quoi changer.'}"></textarea></div>
        <label class="fichier" style="margin-top:10px">${ICONE.plus}<span><b>Joindre des images</b></span></label>
        ${etape1 ? '<button class="bouton vert" type="button">Valider</button><p class="doux petit" style="margin:10px 0 0">À l\'étape 1, les exercices ne se refont pas : tu ajoutes tes remarques et tu valides.</p>'
          : '<div class="deux-boutons" style="margin-top:16px"><button class="bouton secondaire" type="button">Demander des modifications</button><button class="bouton vert" type="button">Valider</button></div><p class="doux petit" style="margin:10px 0 0">Modifications : il a 24 h pour renvoyer, Bob le prévient. Validé : plus rien ne se modifie.</p>'}
      </div>
      <div class="carte"><h2>${echapper(membre.pseudo)}</h2><p class="doux petit" style="margin:0">Étape ${membre.etape} · ${echapper(membre.resume || '')}</p><a class="bouton secondaire" href="#">Voir sa fiche</a></div>
    </div>
  </div>`, espace, 'traiter');
}

module.exports = { ETAPES, pageParcours, pageEtape1, pageEtape2, pageEtape3, pageFiche, pageATraiter, pageEnvoi, delai, frise };
