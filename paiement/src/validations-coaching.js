'use strict';

// Validation des coachings (docs : INSTALLER_BOB.md, « Validation des coachings »).
//  - Après la séance (5 minutes après la fin des 30 minutes) : le coach et l'élève confirment qu'elle a bien eu lieu.
//    L'élève ne valide que si le coaching a vraiment eu lieu ; sinon il conteste (« j'ai attendu pendant tout le coaching »).
//    Le coach traite la contestation : un coaching en réserve (à reprogrammer), ou classée.
//  - En avance : le coach déclare une séance à venir faite en avance (ou annulée car non nécessaire…) ; l'élève approuve
//    (le créneau est libéré) ou refuse, en disant pourquoi.

const DUREE_MIN = 30;
const APRES_MIN = 5;
const RAISONS = {
  fait_avance: 'Ce coaching a été fait en avance',
  non_necessaire: 'Ce coaching a été annulé car non nécessaire',
  live_groupe: 'Ce coaching est remplacé par un live de groupe',
  autre: 'Autre raison',
};

function creerValidations({ db, coaching, maintenant = () => new Date() }) {
  const q = {
    une: db.prepare('SELECT * FROM validations_coaching WHERE id = ?'),
    de: db.prepare('SELECT * FROM validations_coaching WHERE discord_id = ? AND date = ? AND heure = ?'),
    creer: db.prepare(`INSERT OR IGNORE INTO validations_coaching (discord_id, date, heure, type, raison, texte, statut, coach_ok_le, cree_le)
      VALUES (?, ?, ?, ?, ?, ?, 'attente', ?, ?)`),
    maj: db.prepare('UPDATE validations_coaching SET statut = ?, coach_ok_le = COALESCE(?, coach_ok_le), eleve_ok_le = COALESCE(?, eleve_ok_le), reponse = COALESCE(?, reponse), decide_le = ? WHERE id = ?'),
    eleve: db.prepare("SELECT * FROM validations_coaching WHERE discord_id = ? AND statut = 'attente' AND eleve_ok_le IS NULL ORDER BY date, heure"),
    coach: db.prepare(`SELECT * FROM validations_coaching WHERE (statut = 'attente' AND type = 'apres' AND coach_ok_le IS NULL)
      OR statut IN ('conteste', 'refuse') ORDER BY date, heure`),
  };
  const iso = () => maintenant().toISOString();
  const debutDe = (date, heure) => new Date(`${date}T${heure}:00.000Z`);

  const api = {
    RAISONS,
    une(id) { return q.une.get(Number(id)) || null; },
    // Séances finies depuis 5 minutes (3 derniers jours), pas encore à valider : une validation pour chacune.
    echues() {
      const now = maintenant();
      const du = new Date(now.getTime() - 3 * 864e5).toISOString().slice(0, 10);
      const nouvelles = [];
      for (const o of coaching.occurrences(du, now.toISOString().slice(0, 10))) {
        if (o.touchee) continue;
        if (debutDe(o.date, o.heure).getTime() + (DUREE_MIN + APRES_MIN) * 60000 > now.getTime()) continue;
        if (q.creer.run(o.discordId, o.date, o.heure, 'apres', null, null, null, iso()).changes) nouvelles.push(q.de.get(o.discordId, o.date, o.heure));
      }
      return nouvelles;
    },
    // Le coach déclare une séance à venir faite en avance (ou annulée) : l'élève doit approuver.
    avance(discordId, date, heure, { raison, texte } = {}) {
      if (!RAISONS[raison]) return { erreur: 'Choisis la raison.' };
      const t = String(texte || '').trim().slice(0, 500);
      if (raison === 'autre' && t.length < 3) return { erreur: 'Précise la raison.' };
      const o = coaching.occurrences(date, date, { discordId }).find((x) => x.heure === heure);
      if (!o) return { erreur: 'Séance introuvable.' };
      const deja = q.de.get(discordId, date, heure);
      if (deja && deja.statut === 'attente') return { erreur: 'Une demande attend déjà la réponse de l\'élève.' };
      if (deja) db.prepare('DELETE FROM validations_coaching WHERE id = ?').run(deja.id); // nouvelle demande après un refus
      q.creer.run(discordId, date, heure, 'avance', raison, t || null, iso(), iso());
      return { validation: q.de.get(discordId, date, heure) };
    },
    // Réponse de l'élève : oui (valide / approuve) ou non (contestation / refus, avec la raison).
    repondre(id, discordId, oui, texte) {
      const v = q.une.get(Number(id));
      if (!v || v.discord_id !== discordId) return { erreur: 'Introuvable.' };
      if (v.statut !== 'attente' || v.eleve_ok_le) return { erreur: 'Déjà répondu.' };
      const mot = String(texte || '').trim().slice(0, 1000);
      if (!oui && mot.length < 5) return { erreur: v.type === 'avance' ? 'Dis pourquoi tu refuses.' : 'Explique ce qui s\'est passé (ex. j\'ai attendu pendant tout le coaching).' };
      if (!oui) { q.maj.run(v.type === 'avance' ? 'refuse' : 'conteste', null, null, mot, iso(), v.id); return { validation: q.une.get(v.id) }; }
      if (v.type === 'avance') {
        // D'accord des deux : la séance disparaît du programme, le créneau se libère.
        coaching.liberer(discordId, v.date, v.heure, `${RAISONS[v.raison] || 'Validé'}${v.texte ? ` : ${v.texte}` : ''}`);
        q.maj.run('valide', null, iso(), null, iso(), v.id);
      } else q.maj.run(v.coach_ok_le ? 'valide' : 'attente', null, iso(), null, v.coach_ok_le ? iso() : null, v.id);
      return { validation: q.une.get(v.id) };
    },
    // Le coach confirme qu'une séance passée a eu lieu.
    validerCoach(id) {
      const v = q.une.get(Number(id));
      if (!v || v.type !== 'apres' || v.statut !== 'attente') return { erreur: 'Rien à valider.' };
      q.maj.run(v.eleve_ok_le ? 'valide' : 'attente', iso(), null, null, v.eleve_ok_le ? iso() : null, v.id);
      return { validation: q.une.get(v.id) };
    },
    // Contestation (ou refus) traitée par le coach : un coaching en réserve à reprogrammer, ou classée.
    traiter(id, decision) {
      const v = q.une.get(Number(id));
      if (!v || !['conteste', 'refuse'].includes(v.statut)) return { erreur: 'Rien à traiter.' };
      if (!['reserve', 'classer'].includes(decision)) return { erreur: 'Décision inconnue.' };
      if (decision === 'reserve') coaching.crediterReserve(v.discord_id);
      q.maj.run(decision === 'reserve' ? 'reporte' : 'classe', null, null, null, iso(), v.id);
      return { validation: q.une.get(v.id) };
    },
    pourEleve(discordId) { return q.eleve.all(String(discordId)); },
    pourCoach() { return q.coach.all(); },
  };
  return api;
}

module.exports = { creerValidations, RAISONS };
