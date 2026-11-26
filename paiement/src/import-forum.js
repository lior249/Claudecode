'use strict';

// Import d'un ancien forum Discord (posts de niches, méthodes, tutoriels faits à la main) vers les Ressources.
// Chaque post devient une ressource publique, à partir de son titre, ses tags, son texte et ses images.
//   - tag « 10k » ou titre « (Méthode) »  → méthode 10K ;
//   - tag « Cmtry » / « comment »          → niche L2 ;
//   - tag « repost » ou titre « Niche »    → niche L1 ;
//   - tag « guide » / « tuto » / autre     → tutoriel.
// « Thématique : … » donne le nom de la niche ; les drapeaux, les pays ; les liens TikTok, les comptes
// (ceux après « Comptes sources » vont dans les sources).

const { PAYS } = require('./ressources');
const { lienCompte } = require('./tiktok');

const DRAPEAUX_PAYS = { '🇩🇪': 'Allemagne', '🇫🇷': 'France', '🇬🇧': 'Angleterre', '🇺🇸': 'États-Unis', '🇧🇷': 'Brésil', '🇲🇽': 'Mexique', '🇰🇷': 'Corée du Sud', '🇯🇵': 'Japon' };
const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Nom du post sans emoji ni « (Repost amélioré) », « (Méthode) 10k - », « Niche ! »…
function nomPropre(nom) {
  return String(nom || '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '')
    .replace(/\((m[ée]thode|niche)\)\s*/gi, '').replace(/^\s*10k\s*-\s*/i, '').replace(/\(repost am[ée]lior[ée]\)|\(commentaire\)|\(cmtry\)/gi, '')
    .replace(/^\s*niche\s*!?\s*/i, '').replace(/\s+/g, ' ').trim();
}

function typeDe(nomFil, tags) {
  const t = tags.map(sansAccents).join(' ');
  const n = sansAccents(nomFil);
  if (/10k|methode/.test(t) || /\(methode\)|^\W*methode/.test(n)) return { type: 'methode', categorie: 'video' };
  if (/cmtry|comment/.test(t) || /comment/.test(n)) return { type: 'niche', categorie: 'L2' };
  if (/repost/.test(t) || /niche|repost/.test(n)) return { type: 'niche', categorie: 'L1' };
  return { type: 'tutoriel', categorie: /montage/.test(t + n) ? 'montage' : /ciblage/.test(t + n) ? 'ciblage' : /script|prompt/.test(t + n) ? 'scripting' : /astuce/.test(t + n) ? 'astuce' : 'autre' };
}

// { nomFil, tags: [noms], contenu } → { type, champs } (champs : comme le formulaire des ressources), ou null si vide.
function analyserPost({ nomFil, tags = [], contenu = '' }) {
  const { type, categorie } = typeDe(nomFil, tags);
  const texte = String(contenu || '');
  const thematique = (texte.match(/th[ée]matique\s*:\s*([^\n]+)/i) || [])[1];
  let titre = (thematique || nomPropre(nomFil) || '').trim().slice(0, 100);
  if (titre) titre = titre.charAt(0).toUpperCase() + titre.slice(1);
  const pays = [...new Set([...texte].reduce((acc, c, i, arr) => { const d = c + (arr[i + 1] || ''); if (DRAPEAUX_PAYS[d]) acc.push(DRAPEAUX_PAYS[d]); return acc; }, []))].filter((p) => PAYS.includes(p));
  // Liens TikTok : avant « Comptes sources » = exemples ; après = sources.
  const coupe = texte.search(/comptes?\s+sources?/i);
  const liensDe = (t) => [...new Set((t.match(/https?:\/\/[^\s<>)]+/g) || []).map((x) => lienCompte(x)).filter((x) => x && /tiktok\.com\/@/.test(x)))];
  const sources = coupe >= 0 ? liensDe(texte.slice(coupe)) : [];
  const exemples = liensDe(coupe >= 0 ? texte.slice(0, coupe) : texte).filter((x) => !sources.includes(x));
  const description = texte.replace(/th[ée]matique\s*:\s*[^\n]+\n?/i, '').trim().slice(0, 3000) || null;
  if (!titre && !description) return null;
  const champs = { titre: titre || (type === 'methode' ? '' : 'Sans titre'), description: description || titre || null, categorie,
    pays, exemples: exemples.join('\n'), sources: sources.join('\n'), etape_texte: [], etape_lien: [] };
  return { type, champs };
}

module.exports = { analyserPost, nomPropre, typeDe };
