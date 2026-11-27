'use strict';

// Page « Demander de l'aide » : une question par page (comme les étapes 3 et 4).
//   1. Le problème.  2. Vues / abonnés : les 3 points (Hook, Engagement, Watchtime) — leçons et vidéos relues —,
//   puis ce qui bloque selon lui, puis la vidéo concernée.  Compte bloqué : changer de compte.  3. L'explication et des captures.
const { echapper, ICONE } = require('./pages');
const { page, STYLE_ETAPES, SCRIPT_ETAPES } = require('./pages-parcours');
const { CATEGORIES, AXES } = require('./aide');

const STYLE_AIDE = `<style>
  .aide-choix { display:grid; gap:8px; } .aide-choix .bouton { margin:0; text-align:left; justify-content:flex-start; }
  .aide-axe { display:grid; grid-template-columns:1fr auto; gap:4px 10px; align-items:center; padding:12px 14px; border-radius:14px; border:1px solid #242424; background:#101010; }
  .aide-axe b { font-size:15px; } .aide-axe small { color:var(--doux); font-size:12.5px; grid-column:1 / -1; }
  .aide-axe a { color:#fff; font-weight:700; font-size:13px; text-decoration:none; border:1px solid #333; border-radius:999px; padding:6px 10px; white-space:nowrap; }
  .aide-ok { color:var(--ok); } .aide-non { color:#ff9a3c; }
</style>`;

function pageAide(config, { espace, parcours: p, axes = [], videos = [], formation = {}, envoyees = [], fait, erreur }) {
  if (fait) {
    return page('Demander de l\'aide', `<div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Demande envoyée</h1></div></div>
    <div class="carte"><p style="margin:0;font-size:17px"><b>Ton coach a reçu ta demande.</b></p>
      <p class="doux" style="margin:8px 0 0">Il te répond dans tes Remarques, et Bob te prévient dès que c'est fait.</p>
      <a class="bouton" href="/remarques">Mes remarques</a><a class="bouton secondaire" href="/profil">Mon profil</a></div>`, espace, 'aide');
  }
  const vusTous = axes.every((a) => a.vu);
  const ligneAxe = (a) => `<div class="aide-axe"><b>${echapper(a.nom)}</b>${formation[a.cle] ? `<a href="${echapper(formation[a.cle])}" target="_blank" rel="noopener">▶ Leçon</a>` : '<span></span>'}
    <small><span class="${a.vu ? 'aide-ok' : 'aide-non'}">${a.vu ? '✓ Leçon regardée' : '✗ Leçon pas regardée'}</span> · ${a.video ? `vidéo relue : ${echapper(a.video.libelle)}` : 'pas de vidéo envoyée à relire'}</small></div>`;
  const choix = Object.entries(CATEGORIES).map(([cle, c]) => `<button class="bouton secondaire" type="button" data-valeur="categorie=${cle}"
      data-aller="${c.perf ? 'axes' : cle === 'compte' ? 'compte' : 'details'}">${echapper(c.titre)}</button>`).join('');
  const compteValide = Boolean(p.compte_valide_le);
  return page('Demander de l\'aide', `${STYLE_ETAPES}${STYLE_AIDE}
  <div class="titre-page"><div><p class="etiquette">Mon accompagnement</p><h1>Demander de l'aide</h1></div></div>
  ${erreur ? `<p class="erreur-form">${echapper(erreur)}</p>` : ''}
  <form class="carte assistant" method="post" action="/aide" data-depart="1">
    <input type="hidden" name="categorie" value=""><input type="hidden" name="axe" value="">
    <div data-page="1"><h3>Qu'est-ce qui se passe ?</h3>
      <p class="doux" style="margin:0">Choisis ce qui ressemble le plus à ton problème. Ton coach le voit avant ta prochaine séance de coaching.</p>
      <div class="aide-choix">${choix}</div></div>

    <div data-page="axes" hidden><h3>D'abord, les 3 points qui font une vidéo</h3>
      <p class="doux" style="margin:0">Ton coach va regarder où tu en es sur ces 3 points : c'est là que se cachent la plupart des problèmes de vues et d'abonnés.</p>
      <div style="display:grid;gap:8px">${axes.map(ligneAxe).join('')}</div>
      ${vusTous ? '' : '<p class="avert"><b>Conseil :</b> regarde les leçons qui te manquent avant d\'envoyer ta demande. Souvent, la réponse y est déjà. Tu peux quand même continuer.</p>'}
      <button class="bouton" type="button" data-aller="point" style="margin:0">Continuer</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>

    <div data-page="point" hidden><h3>Selon toi, qu'est-ce qui bloque ?</h3>
      <div class="aide-choix">${Object.entries(AXES).map(([cle, t]) => `<button class="bouton secondaire" type="button" data-valeur="axe=${cle}" data-aller="video">${cle === 'inconnu' ? 'Je ne sais pas' : echapper(t)}</button>`).join('')}</div>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>

    <div data-page="video" hidden><h3>Quelle vidéo ?</h3>
      <p class="doux" style="margin:0">Celle qui montre le mieux ton problème (facultatif).</p>
      ${videos.length ? `<select name="video"><option value="">Aucune en particulier</option>${videos.map((v) => `<option value="${echapper(v.lien)}">${echapper(v.jour)}${v.res_vues != null ? ` · ${Number(v.res_vues).toLocaleString('fr-FR')} vues` : ''} · ${echapper(v.lien.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</option>`).join('')}</select>`
        : '<input name="video" type="url" placeholder="Lien de la vidéo TikTok (facultatif)">'}
      <button class="bouton" type="button" data-aller="details" style="margin:0">Suivant</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>

    <div data-page="compte" hidden><h3>Ton compte semble bloqué</h3>
      <p class="doux" style="margin:0">Un compte bloqué entre 0 et 200 vues, ou qui ne sort plus du tout, est souvent en shadowban. Ton coach peut t'autoriser à changer de compte.</p>
      ${compteValide ? `<a class="lien-formation" href="/parcours/etape-4#compte">↻ <span>Demander à changer de compte</span><span style="margin-left:auto;color:var(--doux)">›</span></a>` : ''}
      <button class="bouton" type="button" data-aller="details" style="margin:0">Expliquer mon problème au coach</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>

    <div data-page="details" hidden><h3>Explique ton problème</h3>
      <textarea name="texte" maxlength="3000" required minlength="10" placeholder="Ce qui se passe, depuis quand, ce que tu as déjà essayé…"></textarea>
      <div data-images="/api/parcours/image"><label class="fichier">${ICONE.plus}<span><b>Joindre des captures</b><br>Statistiques, message d'erreur… (facultatif)</span><input type="file" accept="image/*" multiple hidden></label>
        <input type="hidden" name="images" value=""><div class="apercus" style="margin-top:8px"></div></div>
      <button class="bouton" type="submit" style="margin:0">Envoyer à mon coach</button>
      <button class="retour-page" type="button" data-retour>‹ Retour</button></div>
  </form>
  ${envoyees.length ? `<div class="carte"><h2>Mes dernières demandes</h2>${envoyees.slice(0, 5).map((m) => `<div class="doux petit" style="border-left:2px solid #333;padding-left:10px;margin-top:8px">
    <span>${echapper(new Date(m.cree_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }))} · ${m.traite_le ? 'répondu' : m.lu_le ? 'lu par le coach' : 'envoyée'}</span>
    <p style="margin:2px 0 0;color:#ddd">${echapper(String(m.sujet || '').replace(/^Demande d'aide · /, ''))}</p></div>`).join('')}</div>` : ''}`, espace, 'aide', null, SCRIPT_ETAPES);
}

module.exports = { pageAide };
