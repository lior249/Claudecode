'use strict';

// « Demander de l'aide / déclarer un problème » (élèves de l'accompagnement).
// La demande arrive chez le coach comme un message d'élève (À traiter, Bob), avec un résumé fait pour lui :
// le problème, ce qui bloque selon l'élève, la vidéo concernée, et où il en est sur les 3 points
// (Hook, Engagement, Watchtime : leçon regardée ? vidéo envoyée à relire ?).

const CATEGORIES = {
  vues: { titre: 'Mes vidéos ne font pas assez de vues', court: 'Vues', perf: true },
  abonnes: { titre: 'Je ne gagne pas assez d\'abonnés', court: 'Abonnés', perf: true },
  compte: { titre: 'Mon compte est bloqué (shadowban, 0 vue)', court: 'Compte bloqué' },
  revenus: { titre: 'Monétisation ou revenus', court: 'Revenus' },
  technique: { titre: 'Un problème avec l\'application ou Bob', court: 'Technique' },
  autre: { titre: 'Autre chose', court: 'Autre' },
};
const AXES = { hook: 'Le hook', engagement: 'L\'engagement', watchtime: 'Le watchtime', inconnu: 'Il ne sait pas' };
const NOMS_AXES = { hook: 'Hook', engagement: 'Engagement', watchtime: 'Watchtime' };
const ETATS = { attente: 'en attente', valide: 'prête à publier', corriger: 'à retravailler' };

// Où en est l'élève sur les 3 points : leçons regardées, vidéos envoyées à relire (la plus récente par point).
function etatAxes(p, soumissions = []) {
  let vus = [];
  try { vus = JSON.parse((p && p.tutos_vus) || '[]'); } catch { vus = []; }
  return Object.keys(NOMS_AXES).map((cle) => {
    const v = soumissions.filter((s) => s.axe === cle && s.etat !== 'brouillon').sort((a, b) => String(b.envoye_le || '').localeCompare(String(a.envoye_le || '')))[0];
    return { cle, nom: NOMS_AXES[cle], vu: vus.includes(cle), video: v ? { etat: v.etat, libelle: ETATS[v.etat] || v.etat } : null };
  });
}

// Le message pour le coach. Renvoie { sujet, texte } ou { erreur }.
function composer({ categorie, axe, video, texte }, axes = []) {
  const c = CATEGORIES[categorie];
  if (!c) return { erreur: 'Choisis ton problème.' };
  const mot = String(texte || '').trim();
  if (mot.length < 10) return { erreur: 'Explique ton problème en quelques mots.' };
  const lignes = [`Problème : ${c.titre}`];
  if (c.perf) {
    if (AXES[axe]) lignes.push(`Ce qui bloque, selon lui : ${AXES[axe]}`);
    const lien = String(video || '').trim().slice(0, 300);
    if (lien) lignes.push(`Vidéo : ${lien}`);
  }
  if (c.perf || categorie === 'compte') {
    lignes.push(`Leçons regardées : ${axes.map((a) => `${a.nom} ${a.vu ? '✓' : '✗'}`).join(' · ')}`);
    lignes.push(`Vidéos relues : ${axes.map((a) => `${a.nom} ${a.video ? `(${a.video.libelle})` : '—'}`).join(' · ')}`);
  }
  return { sujet: `Demande d'aide · ${c.court}`, texte: `${lignes.join('\n')}\n\n${mot.slice(0, 3000)}` };
}

module.exports = { CATEGORIES, AXES, NOMS_AXES, etatAxes, composer };
