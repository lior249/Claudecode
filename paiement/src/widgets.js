'use strict';

// Widgets iPhone (application gratuite Scriptable) : le site donne les chiffres (JSON, lien personnel et secret),
// le script les dessine. Un paramètre (texte) choisit le widget ; sinon, selon la taille (carré ou horizontal).
//   Élève : revenus (courbe façon Whop), classement (avec ses voisins), flamme, objectif, coaching ;
//           horizontal par défaut : revenus + classement.
//   Coach : traiter, coaching, challenge ; horizontal par défaut : « Ma journée ».

// Le script à coller dans Scriptable (l'adresse personnelle y est déjà).
function scriptWidget(url, { coach = false } = {}) {
  return `// Overmaxx : widget ${coach ? 'coach' : 'élève'} (Scriptable). Paramètre du widget (facultatif) :
// ${coach ? 'traiter, coaching, challenge, journee' : 'revenus, classement, flamme, objectif, coaching, duo'}
const URL_DONNEES = ${JSON.stringify(url)};
const LIME = new Color('#c8f23a'), FOND = new Color('#0b0b0b'), DOUX = new Color('#9a9a9a'), BLANC = Color.white(), ROUGE = new Color('#ff5a5a');
const famille = config.widgetFamily || 'small';
const param = String(args.widgetParameter || '').trim().toLowerCase();
let d;
try { d = await new Request(URL_DONNEES).loadJSON(); } catch (e) { d = { erreur: 'Pas de connexion' }; }
const w = new ListWidget(); w.backgroundColor = FOND; w.setPadding(14, 14, 14, 14);
const txt = (pile, t, taille, couleur, gras) => { const x = pile.addText(String(t)); x.font = gras ? Font.heavySystemFont(taille) : Font.mediumSystemFont(taille); x.textColor = couleur || BLANC; x.lineLimit = 1; x.minimumScaleFactor = 0.6; return x; };
const dollars = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const entete = (pile, t) => { txt(pile, 'OVERMAXX®', 11, DOUX, true); txt(pile, t, 12, DOUX); };
function courbe(valeurs, largeur, hauteur) {
  const c = new DrawContext(); c.size = new Size(largeur, hauteur); c.opaque = false; c.respectScreenScale = true;
  const v = valeurs.length > 1 ? valeurs : [0, 0]; const min = Math.min(...v), max = Math.max(...v), et = (max - min) || 1;
  const pts = v.map((y, i) => new Point(i * largeur / (v.length - 1), hauteur - 4 - ((y - min) / et) * (hauteur - 10)));
  const aire = new Path(); aire.move(new Point(0, hauteur)); pts.forEach((p) => aire.addLine(p)); aire.addLine(new Point(largeur, hauteur)); aire.closeSubpath();
  c.addPath(aire); c.setFillColor(new Color('#c8f23a', 0.18)); c.fillPath();
  const l = new Path(); l.move(pts[0]); pts.slice(1).forEach((p) => l.addLine(p)); c.addPath(l); c.setStrokeColor(LIME); c.setLineWidth(3); c.strokePath();
  return c.getImage();
}
function revenus(pile, large) {
  const r = d.revenus || {}; entete(pile, 'Revenus · 4 dernières semaines'); pile.addSpacer(4);
  txt(pile, dollars(r.total), 30, BLANC, true);
  const v = Number(r.variation || 0); txt(pile, (v >= 0 ? '+' : '') + v + ' %', 16, v >= 0 ? LIME : ROUGE, true);
  pile.addSpacer(); const im = pile.addImage(courbe(r.serie || [], large ? 300 : 300, 70)); im.resizable = true; im.imageSize = new Size(large ? 150 : 130, 40);
}
function classement(pile) {
  const c = d.classement || {}; entete(pile, 'Classement'); pile.addSpacer(6);
  (c.voisins || []).forEach((x) => {
    const l = pile.addStack(); l.centerAlignContent(); l.setPadding(3, 6, 3, 6); l.cornerRadius = 8;
    if (x.moi) l.backgroundColor = new Color('#c8f23a', 0.18);
    txt(l, '#' + x.rang, 12, x.moi ? LIME : DOUX, true); l.addSpacer(6); txt(l, x.moi ? 'Toi' : x.nom, 13, BLANC, x.moi); l.addSpacer(); txt(l, dollars(x.revenus), 12, x.moi ? LIME : DOUX, true);
    pile.addSpacer(3);
  });
  if (!(c.voisins || []).length) txt(pile, 'Pas encore classé', 13, DOUX);
}
function grosChiffre(pile, titre, valeur, sous, couleur) { entete(pile, titre); pile.addSpacer(); txt(pile, valeur, 34, couleur || BLANC, true); if (sous) txt(pile, sous, 13, DOUX); }
function coaching(pile) {
  const s = d.coaching; entete(pile, 'Prochain coaching'); pile.addSpacer();
  if (!s) { txt(pile, 'Aucun', 26, DOUX, true); return; }
  const date = new Date(s.debut); const df = new DateFormatter(); df.dateFormat = 'EEE d MMM · HH:mm'; df.locale = 'fr_FR';
  txt(pile, df.string(date), 15, BLANC, true); if (s.nom) txt(pile, s.nom, 14, DOUX);
  const t = pile.addDate(date); t.applyRelativeStyle(); t.font = Font.heavySystemFont(20); t.textColor = LIME;
}
function journee(pile) {
  entete(pile, 'Ma journée'); pile.addSpacer(4);
  txt(pile, (d.traiter || 0) + ' à traiter', 20, (d.traiter || 0) ? LIME : BLANC, true);
  txt(pile, (d.coachingsJour || []).length + ' coaching(s) aujourd\\'hui', 13, DOUX);
  (d.coachingsJour || []).slice(0, 3).forEach((x) => txt(pile, x.heure + ' · ' + x.nom, 13, BLANC));
}
function challenge(pile) {
  const c = d.challenge; entete(pile, 'Challenge'); pile.addSpacer();
  if (!c) { txt(pile, 'Aucun en cours', 18, DOUX, true); return; }
  txt(pile, c.titre, 18, BLANC, true); txt(pile, c.inscrits + ' inscrit(s)', 13, DOUX);
  if (c.cible) { txt(pile, c.libelle, 11, DOUX); const t = pile.addDate(new Date(c.cible)); t.applyTimerStyle(); t.font = Font.heavySystemFont(18); t.textColor = LIME; }
}
if (d.erreur) { txt(w, 'Overmaxx', 13, DOUX, true); txt(w, d.erreur, 14, BLANC); }
else {
  const choix = param || (famille === 'small' ? (d.coach ? 'traiter' : 'revenus') : (d.coach ? 'journee' : 'duo'));
  const rendu = {
    revenus: (p) => revenus(p, famille !== 'small'), classement, coaching, journee, challenge,
    flamme: (p) => grosChiffre(p, 'Ma flamme', '🔥 ' + (d.flamme || 0), d.updateFaite ? '✅ Update du jour faite' : '⏳ Update du jour à faire', LIME),
    objectif: (p) => { const o = d.objectif; entete(p, 'Prochain objectif'); p.addSpacer(); if (!o) { txt(p, 'Tous atteints 🏆', 18, LIME, true); return; } txt(p, o.libelle, 18, BLANC, true); txt(p, o.pct + ' %', 30, LIME, true); },
    traiter: (p) => grosChiffre(p, 'À traiter', String(d.traiter || 0), (d.coachingsJour || []).length + ' coaching(s) aujourd\\'hui', (d.traiter || 0) ? LIME : BLANC),
  };
  if (choix === 'duo' && famille !== 'small') {
    const h = w.addStack(); const g = h.addStack(); g.layoutVertically(); revenus(g, false); h.addSpacer(14);
    const dr = h.addStack(); dr.layoutVertically(); classement(dr);
  } else { const p = w.addStack(); p.layoutVertically(); (rendu[choix] || rendu.revenus)(p); }
}
w.url = ${JSON.stringify(url.replace(/\/api\/widget.*$/, '/app'))};
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
`;
}

module.exports = { scriptWidget };
