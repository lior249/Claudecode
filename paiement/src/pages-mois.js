'use strict';

// Page « Updates du mois » (du 28 au 5) : l'update du mois (revenus) puis le plus gros résultat du mois.
const { echapper, ICONE } = require('./pages');
const { page, STYLE_ETAPES, SCRIPT_ETAPES } = require('./pages-parcours');
const { MODELES, QUESTIONS_REVENUS } = require('./updates-mois');

const zoneImages = (texte) => `<div data-images="/api/parcours/image"><label class="fichier">${ICONE.plus}<span><b>Ajouter des images</b><br>${texte}</span><input type="file" accept="image/*" multiple hidden></label>
  <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>`;
const STYLE_MOIS = `<style>.mois-modeles { display:grid; gap:8px; } .mois-modeles label { display:flex; gap:10px; align-items:center; padding:12px 14px; border-radius:14px; border:1px solid #2a2a2a; cursor:pointer; }
  .mois-modeles input { width:auto; flex:none; margin:0; accent-color:#c8f23a; } .mois-modeles label { justify-content:flex-start; text-align:left; font-size:14px; margin:0; }
  .mois-modeles label:has(input:checked) { border-color:#c8f23a; background:#141a05; } .mois-modeles label[data-off] { opacity:.4; cursor:not-allowed; }
  .mois-fait p { margin:6px 0 0; white-space:pre-line; }</style>`;

function pageMois(config, { espace, mois, libelle, etat, revenusCalcules = null, message, erreur }) {
  if (!mois) {
    return page('Updates du mois', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Updates du mois</h1></div></div>
      <div class="carte"><p style="margin:0">Les updates du mois s'ouvrent le <b>28</b> et restent ouvertes jusqu'au <b>5</b> du mois suivant.</p>
      <p class="doux" style="margin:8px 0 0">Tu y partages ce que tu as généré et ton plus gros résultat : ils sont publiés dans #testimonials pour motiver les autres.</p></div>`, espace, 'parcours');
  }
  const r = etat.revenus; const g = etat.resultat;
  if (etat.passe) {
    return page('Updates du mois', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Updates du mois</h1></div><span class="doux petit">${echapper(libelle)}</span></div>
      ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}
      <div class="carte"><div class="envoi-tete"><h2>Pas d'update ce mois-ci</h2><span class="etat" data-etat="valide">${ICONE.ok}C'est noté</span></div>
      <p style="margin:8px 0 0">Rien n'est publié et Bob ne te le rappelle plus ce mois-ci.</p>
      <p class="doux" style="margin:6px 0 0">Concentre-toi sur tes vidéos : le mois prochain, tu auras peut-être ton premier résultat à partager.</p></div>`, espace, 'parcours');
  }
  const passer = `<form method="post" action="/parcours/mois/passer" style="margin:0"
      onsubmit="return confirm('Pas d\\'update ce mois-ci ? Rien ne sera publié et Bob ne te le rappellera plus jusqu\\'au mois prochain.')">
      <button class="bouton secondaire" type="submit" style="margin:0">Je n'ai pas encore de résultat : pas d'update ce mois-ci</button>
      <p class="doux petit" style="margin:6px 0 0">Tu viens de rejoindre l'accompagnement, ou tu n'as rien à partager ce mois-ci ? Pas de souci.</p></form>`;
  const carteRevenus = r ? `<div class="carte mois-fait"><div class="envoi-tete"><h2>Update du mois</h2><span class="etat" data-etat="valide">${ICONE.ok}Envoyée</span></div>
      ${r.a_gagne ? `<p><b>$${Number(r.montant).toLocaleString('en-US', { maximumFractionDigits: 2 })}</b> générés en ${echapper(libelle)}.</p>` : '<p class="doux">Pas de revenus ce mois-ci : rien à publier.</p>'}</div>`
    : `${STYLE_ETAPES}<form class="carte assistant" method="post" action="/parcours/mois/revenus" data-depart="1">
      <div class="envoi-tete"><h2>Update du mois</h2><span class="doux petit">${echapper(libelle)}</span></div>
      <div data-page="1"><h3>As-tu fait de l'argent sur TikTok ce mois-ci ?</h3>
        <div class="choix2"><button class="bouton secondaire" type="submit" name="a_gagne" value="0" formnovalidate>Non</button><button class="bouton" type="button" data-aller="2">Oui</button></div></div>
      <div data-page="2" hidden><h3>Combien as-tu généré au total ce mois-ci ?</h3>
        <div class="champ"><label for="montant">En dollars</label><input id="montant" name="montant" inputmode="decimal" placeholder="ex. 1250" value="${revenusCalcules ? echapper(String(revenusCalcules)) : ''}"></div>
        ${revenusCalcules ? `<p class="doux petit" style="margin:0">D'après tes updates : $${echapper(Number(revenusCalcules).toLocaleString('en-US', { maximumFractionDigits: 2 }))}. Corrige si besoin.</p>` : ''}
        ${zoneImages('La capture de tes revenus du mois (conseillé)')}
        <button class="bouton" type="button" data-aller="3" style="margin:0">Suivant</button>
        <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
      <div data-page="3" hidden><h3>Raconte en quelques mots</h3>
        ${QUESTIONS_REVENUS.map(([cle, q]) => `<div class="champ"><label for="q-${cle}">${echapper(q)}</label><textarea id="q-${cle}" name="${cle}" maxlength="1200" required></textarea></div>`).join('')}
        <input type="hidden" name="a_gagne" value="1">
        <button class="bouton" type="submit" style="margin:0">Publier mon update</button>
        <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
    </form>`;
  const carteResultat = g ? `<div class="carte mois-fait"><div class="envoi-tete"><h2>Plus gros résultat du mois</h2><span class="etat" data-etat="valide">${ICONE.ok}Envoyé</span></div>
      <p><b>${echapper(MODELES[g.modele] ? MODELES[g.modele].phrase(g.valeur) : g.valeur)}</b></p></div>`
    : !r ? '<div class="carte"><h2>Plus gros résultat du mois</h2><p class="doux" style="margin:6px 0 0">Fais d\'abord ton update du mois juste au-dessus.</p></div>'
    : `<form class="carte" method="post" action="/parcours/mois/resultat" style="display:grid;gap:12px">
      <div class="envoi-tete"><h2>Plus gros résultat du mois</h2><span class="doux petit">${echapper(libelle)}</span></div>
      <p class="doux" style="margin:0">Le résultat dont tu es le plus fier ce mois-ci, pour motiver les autres.</p>
      <div class="mois-modeles">${Object.entries(MODELES).map(([cle, m], i) => {
        const off = m.argent && !r.a_gagne;
        return `<label${off ? ' data-off title="Pas de revenus ce mois-ci"' : ''}><input type="radio" name="modele" value="${cle}"${off ? ' disabled' : ''}${i === 0 ? ' required' : ''}>${echapper(m.libelle)}</label>`;
      }).join('')}</div>
      <div class="champ"><label for="valeur">Le nombre (ou ton résultat, pour « Autre »)</label><input id="valeur" name="valeur" maxlength="200" required placeholder="ex. 1 000 000"></div>
      <div class="champ"><label for="ressenti">Ce que tu as ressenti</label><textarea id="ressenti" name="ressenti" maxlength="1500" required placeholder="Ce que tu as trouvé incroyable, ce qui a marché…"></textarea></div>
      ${zoneImages('Captures de ce résultat')}
      <button class="bouton" type="submit" style="margin:0">Publier mon résultat</button></form>`;
  return page('Updates du mois', `${STYLE_MOIS}<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Updates du mois</h1></div><span class="doux petit">${echapper(libelle)}</span></div>
  ${message ? `<p class="message-ok">${echapper(message)}</p>` : ''}${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <p class="doux" style="margin:0 0 12px">Du 28 au 5 : partage ce que tu as généré et ton plus gros résultat. Bob les publie dans #testimonials.</p>
  ${carteRevenus}${carteResultat}
  ${g ? '' : `<div class="carte">${passer}</div>`}`, espace, 'parcours', null, SCRIPT_ETAPES);
}

module.exports = { pageMois };
