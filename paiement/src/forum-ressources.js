'use strict';

// Le forum « ressources » du Discord : chaque ressource publique y a son post (double base avec la plateforme).
// Même présentation que les posts faits à la main : titre avec emoji, tags pour les catégories,
// « Thématique : … », pays recommandés en drapeaux, liens, puis les images en pièces jointes.

const { DRAPEAUX } = require('./ressources');
const { aliasCompte } = require('./tiktok');

// Les tags du forum (créés par Bob s'ils manquent).
const TAGS = [
  { name: '10k Abos', emoji: '🚀' }, // méthodes pour 10K abonnés
  { name: 'repost', emoji: '🔁' },   // niches L1 (repost amélioré)
  { name: 'Cmtry', emoji: '💡' },    // niches L2 (commentaire)
  { name: 'guide', emoji: '📘' },    // tutoriels et astuces
];
const NOM_FORUM = 'ressources';

function tagsDe(r) {
  if (r.type === 'methode') return ['10k Abos'];
  if (r.type === 'tutoriel') return ['guide'];
  if (r.categorie === 'L2') return ['Cmtry'];
  if (r.categorie === 'L1L2') return ['repost', 'Cmtry'];
  return ['repost'];
}
const TYPE_NICHE = { L1: 'Repost amélioré', L2: 'Commentaire', L1L2: 'Repost amélioré et commentaire' };
const TYPE_METHODE = { video: 'vidéo', carrousel: 'carrousel', cta: 'CTA' };
const TYPE_TUTO = { montage: 'Montage', ciblage: 'Ciblage', scripting: 'Scripting', astuce: 'Astuce', autre: 'Tuto' };

function titreDe(r) {
  let t;
  if (r.type === 'niche') t = `🚀 ${r.titre} (${TYPE_NICHE[r.categorie] || 'Niche'})`;
  else if (r.type === 'methode') t = `😈 (Méthode) 10k - ${r.titre || `Méthode ${TYPE_METHODE[r.categorie] || ''}`.trim()}`;
  else t = `💡 (${TYPE_TUTO[r.categorie] || 'Tuto'}) ${r.titre}`;
  return t.slice(0, 100);
}
const lien = (x) => (/tiktok\.com\/@/.test(x) ? `${aliasCompte(x)} : ${x}` : x);
const usd = (n) => `$${Number(n).toFixed(2)}`;

// Le texte du premier message (2 000 caractères au plus).
function contenuDe(r, { auteur = null, baseUrl = '' } = {}) {
  const l = [];
  if (r.type === 'niche') {
    l.push(`**Thématique : ${r.titre}**`);
    if (r.description) l.push(r.description);
    l.push('');
    l.push(`Type de contenu : ${TYPE_NICHE[r.categorie] || '—'}`);
    if (r.pays && r.pays.length) l.push(`Pays recommandés : ${r.pays.map((p) => DRAPEAUX[p] || p).join(' ')}`);
    if (r.rpm_min !== null || r.rpm_max !== null) l.push(`RPM : ${r.rpm_min !== null ? usd(r.rpm_min) : '?'} – ${r.rpm_max !== null ? usd(r.rpm_max) : '?'}`);
  } else if (r.type === 'methode') {
    l.push(`**${r.titre || 'Méthode 10K'}** · ${TYPE_METHODE[r.categorie] || ''}${r.pour ? ` · meilleure pour ${r.pour === 'L1L2' ? 'L1 et L2' : r.pour}` : ''}`);
    if (r.description) { l.push(''); l.push(r.description); }
  } else {
    l.push(`**${r.titre}**`);
    if (r.description) l.push(r.description);
    if (r.etapes && r.etapes.length) {
      l.push('');
      r.etapes.forEach((e, i) => l.push(`**Étape ${i + 1} :** ${e.texte || ''}${e.lien ? `\n${e.lien}` : ''}`));
    }
    if (r.lien) { l.push(''); l.push(r.lien); }
  }
  const bloc = (titre, liste) => { if (liste && liste.length) { l.push(''); l.push(`${titre} :`); for (const x of liste) l.push(lien(x)); } };
  bloc('Comptes exemples', r.exemples);
  if (r.type === 'niche') { bloc('Contre-exemples', r.contre_exemples); bloc('Comptes sources', r.sources); }
  l.push('');
  l.push(`${auteur ? `Proposée par ${auteur} · ` : ''}sur la plateforme : ${baseUrl}/ressources/${r.id}`);
  let texte = l.join('\n');
  if (texte.length > 2000) texte = `${texte.slice(0, 1990)}…`;
  return texte;
}

module.exports = { TAGS, NOM_FORUM, tagsDe, titreDe, contenuDe };
