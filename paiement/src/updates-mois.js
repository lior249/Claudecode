'use strict';

// Updates de fin de mois (élèves à l'étape 4 et plus), du 28 au 5 du mois suivant, rappelées chaque jour tant qu'elles manquent :
//  1. « Update du mois » (revenus) : « As-tu fait de l'argent sur TikTok ce mois-ci ? »
//       oui → le total du mois, une capture, et 3 questions (comment ça a commencé, ton conseil, ton prochain objectif) ;
//       non → rien à publier, l'update compte comme faite.
//  2. « Plus gros résultat du mois » : un modèle (vues sur une vidéo, abonnés gagnés en une vidéo, revenus d'une vidéo —
//     désactivé sans revenus ce mois-ci —, ou autre), la valeur, son ressenti et des images.
// Bob publie chacune dans le forum « Testimonials » : un post par résultat (titre, texte, images).

const QUESTIONS_REVENUS = [
  ['debut', 'Comment ça a commencé pour toi ?'],
  ['conseil', 'Qu\'est-ce que tu dirais à quelqu\'un qui veut obtenir des résultats pareils ?'],
  ['objectif', 'Quel est ton prochain objectif pour progresser encore ?'],
];
const MODELES = {
  vues: { libelle: 'J\'ai fait … vues sur une seule vidéo', phrase: (v) => `${v} vues sur une seule vidéo`, unite: 'vues' },
  abonnes: { libelle: 'J\'ai gagné … abonnés en une seule vidéo', phrase: (v) => `${v} abonnés gagnés en une seule vidéo`, unite: 'abonnés' },
  revenus: { libelle: 'J\'ai fait … $ de revenus en une seule vidéo', phrase: (v) => `$${v} de revenus en une seule vidéo`, unite: '$', argent: true },
  autre: { libelle: 'Autre chose (je l\'écris)', phrase: (v) => v, unite: '' },
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const moisLisible = (m) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// Le mois dont on fait l'update, selon le jour local : du 28 au 31 → ce mois-ci ; du 1er au 5 → le mois d'avant ; sinon aucun.
function moisDeLUpdate(jour) {
  const j = Number(String(jour).slice(8, 10));
  if (j >= 28) return String(jour).slice(0, 7);
  if (j <= 5) {
    const a = Number(jour.slice(0, 4)); const m = Number(jour.slice(5, 7));
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  }
  return null;
}
const nombre = (v) => {
  const n = Number(String(v ?? '').replace(/[\s  $,]/g, '').replace(/(\d)\.(\d{3})\b/g, '$1$2'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function creerUpdatesMois({ db, maintenant = () => new Date() }) {
  db.exec(`CREATE TABLE IF NOT EXISTS updates_mois (
    id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT NOT NULL, mois TEXT NOT NULL, type TEXT NOT NULL,
    a_gagne INTEGER, montant REAL, modele TEXT, valeur TEXT, reponses TEXT, images TEXT, cree_le TEXT NOT NULL, discord_post TEXT,
    UNIQUE (discord_id, mois, type))`);
  const q = {
    de: db.prepare('SELECT * FROM updates_mois WHERE discord_id = ? AND mois = ? AND type = ?'),
    ajouter: db.prepare(`INSERT INTO updates_mois (discord_id, mois, type, a_gagne, montant, modele, valeur, reponses, images, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(discord_id, mois, type) DO NOTHING`),
    poste: db.prepare('UPDATE updates_mois SET discord_post = ? WHERE id = ?'),
  };
  const lire = (r) => (r ? { ...r, reponses: JSON.parse(r.reponses || '{}'), images: JSON.parse(r.images || '[]') } : null);
  const api = {
    QUESTIONS_REVENUS, MODELES, moisLisible, moisDeLUpdate,
    etat(discordId, mois) {
      const revenus = lire(q.de.get(discordId, mois, 'revenus'));
      const resultat = lire(q.de.get(discordId, mois, 'resultat'));
      return { mois, revenus, resultat, aGagne: revenus ? Boolean(revenus.a_gagne) : null, fini: Boolean(revenus && resultat) };
    },
    // Ce qui manque aujourd'hui (jour local du membre), dans l'ordre. [] hors de la fenêtre du 28 au 5.
    aFaire(discordId, jour) {
      const mois = moisDeLUpdate(jour);
      if (!mois) return [];
      const e = api.etat(discordId, mois);
      const l = [];
      if (!e.revenus) l.push({ type: 'revenus', mois, titre: `Fais ton update du mois (${moisLisible(mois)})` });
      if (!e.resultat) l.push({ type: 'resultat', mois, titre: `Partage ton plus gros résultat de ${MOIS[Number(mois.slice(5, 7)) - 1]}` });
      return l;
    },
    // Update du mois (revenus). aGagne false : rien à publier.
    enregistrerRevenus(discordId, mois, { aGagne, montant, reponses = {}, images = [] }) {
      if (q.de.get(discordId, mois, 'revenus')) return { erreur: 'Ton update du mois est déjà envoyée.' };
      if (aGagne) {
        const m = nombre(montant);
        if (m === null || m <= 0) return { erreur: 'Écris combien tu as généré ce mois-ci (en dollars).' };
        const r = {};
        for (const [cle, question] of QUESTIONS_REVENUS) {
          const t = String(reponses[cle] || '').trim().slice(0, 1200);
          if (t.length < 3) return { erreur: `Réponds à la question : « ${question} »` };
          r[cle] = t;
        }
        q.ajouter.run(discordId, mois, 'revenus', 1, Math.round(m * 100) / 100, null, null, JSON.stringify(r), JSON.stringify(images.slice(0, 5)), maintenant().toISOString());
      } else {
        q.ajouter.run(discordId, mois, 'revenus', 0, null, null, null, '{}', '[]', maintenant().toISOString());
      }
      return { update: api.etat(discordId, mois).revenus };
    },
    // Plus gros résultat du mois.
    enregistrerResultat(discordId, mois, { modele, valeur, ressenti, images = [] }) {
      if (q.de.get(discordId, mois, 'resultat')) return { erreur: 'Ton plus gros résultat du mois est déjà envoyé.' };
      const e = api.etat(discordId, mois);
      const md = MODELES[modele];
      if (!md) return { erreur: 'Choisis ton résultat.' };
      if (md.argent && !e.aGagne) return { erreur: 'Sans revenus ce mois-ci, choisis un autre résultat.' };
      let v = String(valeur || '').trim().slice(0, modele === 'autre' ? 200 : 30);
      if (modele !== 'autre') {
        const n = nombre(v);
        if (n === null || n <= 0) return { erreur: `Écris le nombre de ${md.unite}.` };
        v = modele === 'revenus' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
      } else if (v.length < 3) return { erreur: 'Écris ton résultat.' };
      const t = String(ressenti || '').trim().slice(0, 1500);
      if (t.length < 3) return { erreur: 'Dis en quelques mots ce que tu as ressenti.' };
      q.ajouter.run(discordId, mois, 'resultat', null, null, modele, v, JSON.stringify({ ressenti: t }), JSON.stringify(images.slice(0, 5)), maintenant().toISOString());
      return { update: api.etat(discordId, mois).resultat };
    },
    marquerPoste(id, postId) { q.poste.run(String(postId || ''), id); },
    // Le titre et le texte du post « Testimonials ».
    post(u, { nom, discordId }) {
      const mention = discordId ? `<@${discordId}>` : nom;
      if (u.type === 'revenus') {
        const r = u.reponses || {};
        return { titre: `💰 ${nom} : $${Number(u.montant).toLocaleString('en-US', { maximumFractionDigits: 2 })} en ${moisLisible(u.mois)}`.slice(0, 100),
          texte: [`${mention} a généré **$${Number(u.montant).toLocaleString('en-US', { maximumFractionDigits: 2 })}** sur TikTok en ${moisLisible(u.mois)}.`, '',
            ...QUESTIONS_REVENUS.flatMap(([cle, question]) => [`**${question}**`, r[cle] || '', ''])].join('\n').slice(0, 1990) };
      }
      const phrase = MODELES[u.modele] ? MODELES[u.modele].phrase(u.valeur) : u.valeur;
      return { titre: `🔥 ${nom} : ${phrase}`.slice(0, 100),
        texte: [`${mention} — plus gros résultat de ${moisLisible(u.mois)} : **${phrase}**`, '', (u.reponses || {}).ressenti || ''].join('\n').slice(0, 1990) };
    },
  };
  return api;
}

module.exports = { creerUpdatesMois, moisDeLUpdate, MODELES, QUESTIONS_REVENUS };
