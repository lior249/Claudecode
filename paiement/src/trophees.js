'use strict';

// Trophées et signaux « banger » (étape 4).
//  - Trophées : gagnés sur les résultats validés par le coach (vidéos, updates du compte). Chacun une seule fois,
//    avec une fenêtre « pièce » à l'ouverture suivante de l'application, puis la salle des trophées.
//      Banger (une vidéo, vues en 24 h) : Bronze 10K, Argent 100K, Or 1M, Platine 5M.
//      Compte (vues au total)            : Bronze 100K, Argent 1M, Or 5M, Platine 15M.
//      Abonnés                           : Junior 1K, Sophomore 5K, Créateur 10K.
//      Revenus                           : Rookie 50 $ ($ bronze), Amateur 100 $ ($ argent), Pro 500 $ ($ or),
//                                          GOAT 1 000 $ sur 28 jours ($$ or), puis les clubs (couronne) : 1K5 platine, 5K or, 10K émeraude ;
//                                          à partir de 1 000 $, la pièce est un hexagone.
//      Régularité (updates d'affilée)    : Bronze 10 jours, Argent 30, Or 50, Platine 99.
//  Chaque trophée a son image (public/trophees/<image>.png) ; tant qu'elle n'est pas là, une pièce dessinée la remplace.
//  - Signaux « banger » (« Garde ce qui marche ») : dès que l'élève donne les résultats d'une vidéo, s'ils dépassent
//    10K vues, 5 % d'abonnés par rapport aux vues, 1 $ de RPM ou 50 $ de revenus. Chaque signal une seule fois ;
//    « Ne plus afficher ce message » les coupe tous.

const METAUX = {
  bronze: ['#6e3b17', '#c07a3f', '#ffd9b3'], argent: ['#6b7078', '#c9ced6', '#ffffff'],
  or: ['#8a6410', '#e8b923', '#fff4c2'], platine: ['#2f6f86', '#8fe3ff', '#f2fdff'], emeraude: ['#0b5a3a', '#2fcf86', '#d4ffe9'],
};
const NOM_METAL = { bronze: 'Bronze', argent: 'Argent', or: 'Or', platine: 'Platine', emeraude: 'Émeraude' };
const nombre = (n) => Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
const court = (n) => (n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}K`);
const TROPHEES = [
  ...[['bronze', 1e4], ['argent', 1e5], ['or', 1e6], ['platine', 5e6]].map(([m, s]) => ({ cle: `banger_${m}`, famille: 'banger', metal: m, seuil: s,
    titre: `Banger ${NOM_METAL[m]}`, image: `banger-${m}`, court: court(s), label: `Une de tes vidéos a fait ${nombre(s)} vues en 24 h`, but: `${nombre(s)} vues en 24 h sur une vidéo`, icone: '🎬' })),
  ...[['bronze', 1e5], ['argent', 1e6], ['or', 5e6], ['platine', 15e6]].map(([m, s]) => ({ cle: `compte_${m}`, famille: 'compte', metal: m, seuil: s,
    titre: `Compte ${NOM_METAL[m]}`, image: `compte-${m}`, court: court(s), label: `Ton compte a dépassé ${nombre(s)} vues au total`, but: `${nombre(s)} vues au total`, icone: '👁' })),
  ...[['junior', 'Junior', 1e3, 'bronze'], ['sophomore', 'Sophomore', 5e3, 'argent'], ['createur', 'Créateur', 1e4, 'or']].map(([c, t, s, m]) => ({ cle: `abonnes_${c}`, famille: 'abonnes', metal: m, seuil: s,
    titre: t, image: `abonnes-${m}`, court: court(s), label: `Tu viens d'obtenir ${nombre(s)} abonnés`, but: `${nombre(s)} abonnés`, icone: '👥' })),
  ...[['rookie', 'Rookie', 50, 'bronze', 1], ['amateur', 'Amateur', 100, 'argent', 1], ['pro', 'Pro', 500, 'or', 1], ['goat', 'GOAT', 1000, 'or', 2],
    ['1k5', '1K5 Club', 1500, 'platine', 2], ['5k', '5K Club', 5000, 'or', 3], ['10k', '10K Club', 10000, 'emeraude', 3]].map(([c, t, s, m, d]) => ({ cle: `revenus_${c}`, famille: 'revenus', metal: m, seuil: s,
    titre: t, image: c.endsWith('k') || c === '1k5' ? `club-${m}` : `revenus${d > 1 ? d : ''}-${m}`, forme: s >= 1000 ? 'hexagone' : 'cercle', court: c === 'goat' ? 'GOAT' : `$${s >= 1000 ? `${s / 1000}K` : s}`, icone: '💰',
    label: c === 'goat' ? 'Tu as gagné 1 000 $ sur les 28 derniers jours' : `Tu as gagné ${nombre(s)} $ au total`,
    but: c === 'goat' ? '1 000 $ sur 28 jours' : `${nombre(s)} $ au total` })),
  ...[['bronze', 10], ['argent', 30], ['or', 50], ['platine', 99]].map(([m, s]) => ({ cle: `regularite_${m}`, famille: 'regularite', metal: m, seuil: s,
    titre: `Régularité ${NOM_METAL[m]}`, image: `regularite-${m}`, court: `${s}J`, icone: '🔥',
    label: `Tu as envoyé ton update ${s} jours d'affilée`, but: `${s} jours d'affilée` })),
];
const FAMILLES = [['banger', 'Banger', 'Une vidéo, ses vues en 24 h'], ['compte', 'Compte', 'Les vues de ton compte au total'],
  ['abonnes', 'Abonnés', 'Tes abonnés'], ['revenus', 'Revenus', 'Ce que tu as gagné'], ['regularite', 'Régularité', 'Ta meilleure série d\'updates envoyées jour après jour']];
const PAR_CLE = Object.fromEntries(TROPHEES.map((t) => [t.cle, t]));

const SIGNAUX = {
  vues: (v) => Number(v.res_vues) >= 10000 && `Elle a fait ${nombre(v.res_vues)} vues en 24 h.`,
  abonnes: (v) => Number(v.res_vues) >= 200 && Number(v.res_abonnes) >= 0.05 * Number(v.res_vues)
    && `Elle t'a fait gagner ${nombre(v.res_abonnes)} abonnés (${Math.round((v.res_abonnes / v.res_vues) * 100)} % des vues).`,
  rpm: (v) => Number(v.res_rpm) >= 1 && `Son RPM est de ${Number(v.res_rpm).toLocaleString('fr-FR')} $.`,
  revenus: (v) => Number(v.res_revenus) >= 50 && `Elle a rapporté ${Number(v.res_revenus).toLocaleString('fr-FR')} $.`,
};

// La plus longue série de jours consécutifs (AAAA-MM-JJ triés).
function meilleureSerie(jours) {
  let max = 0; let n = 0; let prec = null;
  for (const j of jours) {
    n = prec && Date.parse(`${j}T12:00:00Z`) - Date.parse(`${prec}T12:00:00Z`) === 864e5 ? n + 1 : 1;
    if (n > max) max = n;
    prec = j;
  }
  return max;
}

function creerTrophees({ db, suivi, parcours, maintenant = () => new Date() }) {
  const iso = () => maintenant().toISOString();
  const q = {
    de: db.prepare('SELECT * FROM trophees WHERE discord_id = ? ORDER BY obtenu_le DESC, rowid DESC'),
    ajouter: db.prepare('INSERT OR IGNORE INTO trophees (discord_id, cle, obtenu_le, publication_id) VALUES (?, ?, ?, ?)'),
    nonVus: db.prepare('SELECT * FROM trophees WHERE discord_id = ? AND vu_le IS NULL ORDER BY obtenu_le, rowid'),
    vu: db.prepare('UPDATE trophees SET vu_le = ? WHERE discord_id = ? AND cle = ? AND vu_le IS NULL'),
    meilleureVideo: db.prepare('SELECT id, ok_vues FROM publications WHERE discord_id = ? AND ok_vues IS NOT NULL ORDER BY ok_vues DESC LIMIT 1'),
    abonnes: db.prepare("SELECT MAX(abonnes) n FROM comptes_rendus WHERE discord_id = ? AND etat = 'valide'"),
    joursEnvoyes: db.prepare('SELECT jour FROM comptes_rendus WHERE discord_id = ? AND envoye_le IS NOT NULL ORDER BY jour'),
    resultats: db.prepare("SELECT * FROM publications WHERE discord_id = ? AND res_vues IS NOT NULL AND COALESCE(res_etat, '') <> 'corriger' ORDER BY id"),
    signaux: db.prepare('SELECT * FROM signaux_bangers WHERE discord_id = ?'),
    signal: db.prepare('INSERT OR IGNORE INTO signaux_bangers (discord_id, signal, publication_id, montre_le) VALUES (?, ?, ?, ?)'),
    signalVu: db.prepare('UPDATE signaux_bangers SET vu_le = ? WHERE discord_id = ? AND vu_le IS NULL'),
  };
  const enrichir = (r) => ({ ...PAR_CLE[r.cle], ...r });

  const api = {
    TROPHEES, FAMILLES, METAUX,
    // Mesures validées : meilleure vidéo, vues au total, abonnés, revenus au total et sur 28 jours.
    mesures(discordId) {
      const s = suivi.stats(discordId) || {};
      const video = q.meilleureVideo.get(discordId);
      return { banger: video ? Number(video.ok_vues) || 0 : 0, video: video ? video.id : null, compte: s.vuesTotal || 0,
        abonnes: Number((q.abonnes.get(discordId) || {}).n) || 0, revenus: s.revenusTotal || 0, revenus28: s.revenus28 || 0,
        regularite: meilleureSerie(q.joursEnvoyes.all(discordId).map((x) => x.jour)) };
    },
    // Ajoute les trophées atteints, pas encore obtenus. Renvoie les nouveaux.
    verifier(discordId) {
      if (!parcours.get(discordId)) return [];
      const m = api.mesures(discordId);
      const nouveaux = [];
      for (const t of TROPHEES) {
        const valeur = t.cle === 'revenus_goat' ? m.revenus28 : m[t.famille];
        if (valeur < t.seuil) continue;
        if (q.ajouter.run(discordId, t.cle, iso(), t.famille === 'banger' ? m.video : null).changes) nouveaux.push(PAR_CLE[t.cle]);
      }
      return nouveaux;
    },
    obtenus(discordId) { return q.de.all(discordId).filter((r) => PAR_CLE[r.cle]).map(enrichir); },
    dernier(discordId) { return api.obtenus(discordId)[0] || null; },
    // La salle des trophées : par famille, obtenus ou non.
    salle(discordId) {
      const obtenus = Object.fromEntries(api.obtenus(discordId).map((t) => [t.cle, t]));
      return FAMILLES.map(([cle, titre, texte]) => ({ cle, titre, texte, trophees: TROPHEES.filter((t) => t.famille === cle).map((t) => ({ ...t, obtenu: obtenus[t.cle] || null })) }));
    },
    nonVus(discordId) { return q.nonVus.all(discordId).filter((r) => PAR_CLE[r.cle]).map(enrichir); },
    marquerVus(discordId, cles = []) { for (const c of cles) q.vu.run(iso(), discordId, String(c)); },

    // Signaux « banger » : les nouveaux, d'après les résultats donnés par l'élève (une fois chacun).
    bangers(discordId) {
      const p = parcours.get(discordId);
      if (!p || p.bangers_off) return null;
      const deja = new Set(q.signaux.all(discordId).map((s) => s.signal));
      for (const v of q.resultats.all(discordId)) {
        for (const [signal, test] of Object.entries(SIGNAUX)) if (!deja.has(signal) && test(v)) { q.signal.run(discordId, signal, v.id, iso()); deja.add(signal); }
      }
      const ordre = Object.keys(SIGNAUX);
      const aVoir = q.signaux.all(discordId).filter((s) => !s.vu_le).sort((a, b) => ordre.indexOf(a.signal) - ordre.indexOf(b.signal));
      if (!aVoir.length) return null;
      const videos = Object.fromEntries(q.resultats.all(discordId).map((v) => [v.id, v]));
      const raisons = aVoir.map((s) => videos[s.publication_id] && SIGNAUX[s.signal](videos[s.publication_id])).filter(Boolean);
      const derniere = videos[Math.max(...aVoir.map((x) => x.publication_id))];
      return raisons.length ? { raisons, video: derniere ? { id: derniere.id, lien: derniere.lien, jour: derniere.jour } : null } : null;
    },
    bangersVus(discordId) { q.signalVu.run(iso(), discordId); },
    couperBangers(discordId) {
      q.signalVu.run(iso(), discordId);
      db.prepare('UPDATE parcours SET bangers_off = ? WHERE discord_id = ?').run(iso(), discordId);
    },
  };
  return api;
}

module.exports = { creerTrophees, TROPHEES, FAMILLES, METAUX, SIGNAUX, meilleureSerie };

// La pièce d'un trophée (SVG) : métal en dégradé, anneau, la valeur au centre. Grisée si pas encore obtenue.
let nPiece = 0;
const DOSSIER_IMAGES = require('path').join(__dirname, '..', 'public', 'trophees');
function imageDe(t) {
  if (!t.image) return null;
  try { return require('fs').existsSync(require('path').join(DOSSIER_IMAGES, `${t.image}.png`)) ? `/static/trophees/${t.image}.png` : null; } catch { return null; }
}
function pieceTrophee(t, { taille = 64, obtenu = true } = {}) {
  const src = imageDe(t);
  if (src) return `<img class="piece-trophee" src="${src}" alt="${String(t.titre || '').replace(/"/g, '&quot;')}" width="${taille}" height="${taille}" loading="lazy" style="width:${taille}px;height:${taille}px;flex:none;object-fit:contain${obtenu ? '' : ';filter:grayscale(1) brightness(.45);opacity:.7'}">`;
  const [m1, m2, m3] = obtenu ? METAUX[t.metal] : ['#2a2a2a', '#3a3a3a', '#555'];
  const id = `pt${(nPiece += 1)}`;
  const texte = String(t.court || '');
  const fs = texte.length > 4 ? 15 : texte.length > 3 ? 17 : 20;
  return `<svg class="piece-trophee" width="${taille}" height="${taille}" style="width:${taille}px;height:${taille}px;flex:none;stroke:none;fill:none" viewBox="0 0 64 64" role="img" aria-label="${t.titre}"><defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m3}"/><stop offset=".45" stop-color="${m2}"/><stop offset="1" stop-color="${m1}"/></linearGradient></defs>
    ${t.forme === 'hexagone' ? `<polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="url(#${id})" stroke="${m1}" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="none" stroke="${m3}" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"/>`
    : `<circle cx="32" cy="32" r="30" fill="url(#${id})" stroke="${m1}" stroke-width="2"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="${m3}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="${t.famille === 'revenus' ? '0' : '3 3'}"/>`}
    <text x="32" y="${32 + fs * 0.36}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="${obtenu ? m1 : '#777'}">${texte.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;
}
module.exports.pieceTrophee = pieceTrophee;
