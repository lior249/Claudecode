'use strict';

// Coaching privé : créneaux récurrents de 30 minutes (heure GMT = UTC).
// Règle du jour même : seules comptent les réservations faites au moins `delaiReservationHeures`
// avant la PREMIÈRE séance de la journée (15h00 → limite 11h00). Sinon, la séance compte la semaine suivante.

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOUR_MS = 24 * 3600 * 1000;
const RAPPELS_POSSIBLES = [240, 180, 120, 90];

const jourIndex = (d) => (d.getUTCDay() + 6) % 7; // 0 = lundi
const dateISO = (d) => d.toISOString().slice(0, 10);
function aHeure(dateStr, heure) {
  return new Date(`${dateStr}T${heure}:00.000Z`);
}
function ajouterJours(dateStr, n) {
  return dateISO(new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() + n * JOUR_MS));
}
function lundiDe(d) {
  return ajouterJours(dateISO(d), -jourIndex(d));
}

function creerCoaching({ db, config, maintenant = () => new Date() }) {
  const c = config.coaching;
  const creneaux = [...c.creneaux].sort();
  const premier = creneaux[0];

  const q = {
    toutes: db.prepare('SELECT * FROM reservations ORDER BY jour, heure'),
    miennes: db.prepare('SELECT * FROM reservations WHERE discord_id = ? ORDER BY jour, heure'),
    supprimer: db.prepare('DELETE FROM reservations WHERE id = ?'),
    supprimerMembre: db.prepare('DELETE FROM reservations WHERE discord_id = ?'),
    inserer: db.prepare('INSERT INTO reservations (discord_id, jour, heure, effectif_le, cree_le) VALUES (?, ?, ?, ?, ?)'),
    annulations: db.prepare('SELECT * FROM annulations WHERE date BETWEEN ? AND ?'),
    annuler: db.prepare('INSERT INTO annulations (discord_id, date, heure, justification, cree_le) VALUES (?, ?, ?, ?, ?)'),
    profil: db.prepare('SELECT * FROM profils_coaching WHERE discord_id = ?'),
    majProfil: db.prepare(`INSERT INTO profils_coaching (discord_id, pseudo, rappel_min, maj_le) VALUES (?, ?, COALESCE(?, 240), ?)
                           ON CONFLICT(discord_id) DO UPDATE SET pseudo = COALESCE(excluded.pseudo, pseudo),
                           rappel_min = COALESCE(?, rappel_min), maj_le = excluded.maj_le`),
    reserveurs: db.prepare('SELECT DISTINCT discord_id FROM reservations'),
    // Séances ponctuelles (coaching d'entrée de l'accompagnement) : une date précise, pas un créneau répété.
    ponctuelles: db.prepare('SELECT * FROM seances_ponctuelles WHERE date BETWEEN ? AND ?'),
    ponctuelle: db.prepare('SELECT * FROM seances_ponctuelles WHERE discord_id = ? AND type = ? ORDER BY date DESC, heure DESC LIMIT 1'),
    insererPonctuelle: db.prepare('INSERT INTO seances_ponctuelles (discord_id, date, heure, type, cree_le) VALUES (?, ?, ?, ?, ?)'),
    supprimerPonctuelle: db.prepare('DELETE FROM seances_ponctuelles WHERE id = ?'),
  };

  // Limite de réservation pour un jour donné (ex. 11h00 si la première séance est à 15h00).
  function limiteDuJour(dateStr) {
    return new Date(aHeure(dateStr, premier).getTime() - c.delaiReservationHeures * 3600 * 1000);
  }

  // Date (AAAA-MM-JJ) de la première séance qui comptera pour un créneau réservé maintenant.
  function effectifPour(jour, heure) {
    const now = maintenant();
    const aujourdhui = dateISO(now);
    let date = ajouterJours(aujourdhui, (jour - jourIndex(now) + 7) % 7);
    if (date === aujourdhui && (now >= limiteDuJour(aujourdhui) || now >= aHeure(date, heure))) date = ajouterJours(date, 7);
    return date;
  }

  function valider(selection) {
    if (!Array.isArray(selection)) return 'Sélection invalide.';
    for (const s of selection) {
      if (!Number.isInteger(s.jour) || s.jour < 0 || s.jour > 6 || !creneaux.includes(s.heure)) return 'Créneau invalide.';
    }
    const jours = new Set(selection.map((s) => s.jour));
    if (jours.size !== selection.length) return 'Un seul créneau par jour.';
    if (selection.length < c.minParSemaine) return `Choisis au moins ${c.minParSemaine} créneaux dans la semaine.`;
    if (c.maxParSemaine && selection.length > c.maxParSemaine) return `${c.maxParSemaine} créneaux au maximum par semaine.`;
    return null;
  }

  // Séances (dates réelles) entre deux dates incluses, annulations retirées.
  function occurrences(du, au, { discordId } = {}) {
    const res = discordId ? q.miennes.all(discordId) : q.toutes.all();
    const annul = new Set(q.annulations.all(du, au).map((a) => `${a.date} ${a.heure}`));
    const liste = [];
    for (let d = du; d <= au; d = ajouterJours(d, 1)) {
      const j = jourIndex(new Date(`${d}T00:00:00.000Z`));
      for (const r of res) {
        if (r.jour !== j || d < r.effectif_le || annul.has(`${d} ${r.heure}`)) continue;
        liste.push({ date: d, heure: r.heure, discordId: r.discord_id, debut: aHeure(d, r.heure) });
      }
    }
    for (const p of q.ponctuelles.all(du, au)) {
      if (discordId && p.discord_id !== discordId) continue;
      liste.push({ date: p.date, heure: p.heure, discordId: p.discord_id, debut: aHeure(p.date, p.heure), type: p.type });
    }
    return liste.sort((a, b) => a.debut - b.debut);
  }

  return {
    JOURS,
    creneaux,
    RAPPELS_POSSIBLES,
    limiteDuJour,
    effectifPour,

    grille(discordId) {
      const toutes = q.toutes.all();
      const prises = new Map(toutes.map((r) => [`${r.jour} ${r.heure}`, r]));
      const cases = [];
      for (let jour = 0; jour < 7; jour++) {
        for (const heure of creneaux) {
          const r = prises.get(`${jour} ${heure}`);
          cases.push({ jour, heure, etat: !r ? 'libre' : r.discord_id === discordId ? 'moi' : 'pris', effectifLe: r && r.discord_id === discordId ? r.effectif_le : null });
        }
      }
      const profil = discordId ? q.profil.get(discordId) : null;
      return { cases, rappelMin: profil ? profil.rappel_min : 240 };
    },

    // Remplace les créneaux récurrents du membre. Renvoie les créneaux qui ne comptent qu'à partir de la semaine suivante.
    enregistrer(discordId, selection, rappelMin, pseudo) {
      const erreur = valider(selection);
      if (erreur) return { erreur };
      if (rappelMin !== undefined && !RAPPELS_POSSIBLES.includes(rappelMin)) return { erreur: 'Rappel invalide.' };
      const iso = maintenant().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        const miennes = q.miennes.all(discordId);
        const voulu = new Set(selection.map((s) => `${s.jour} ${s.heure}`));
        for (const r of miennes) if (!voulu.has(`${r.jour} ${r.heure}`)) q.supprimer.run(r.id);
        const deja = new Set(miennes.map((r) => `${r.jour} ${r.heure}`));
        const decales = [];
        for (const s of selection) {
          if (deja.has(`${s.jour} ${s.heure}`)) continue;
          const effectif = effectifPour(s.jour, s.heure);
          q.inserer.run(discordId, s.jour, s.heure, effectif, iso);
          if (effectif !== ajouterJours(dateISO(maintenant()), (s.jour - jourIndex(maintenant()) + 7) % 7)) {
            decales.push({ ...s, effectifLe: effectif });
          }
        }
        q.majProfil.run(discordId, pseudo || null, rappelMin === undefined ? null : rappelMin, iso, rappelMin === undefined ? null : rappelMin);
        db.exec('COMMIT');
        return { ok: true, decales, reservations: q.miennes.all(discordId) };
      } catch (err) {
        db.exec('ROLLBACK');
        if (/UNIQUE/.test(err.message)) return { erreur: "Un des créneaux vient d'être pris par quelqu'un d'autre. Choisis-en un autre." };
        throw err;
      }
    },

    occurrences,

    prochainesSeances(discordId, jours = 8) {
      const now = maintenant();
      return occurrences(dateISO(now), ajouterJours(dateISO(now), jours), { discordId }).filter((o) => o.debut > now);
    },

    // Annulation d'une séance précise, au plus tard 30 min avant, avec justification.
    annuler(discordId, date, heure, justification) {
      const texte = String(justification || '').trim();
      if (texte.length < 5) return { erreur: 'Explique en quelques mots pourquoi tu annules.' };
      const seance = this.prochainesSeances(discordId).find((o) => o.date === date && o.heure === heure);
      if (!seance) return { erreur: 'Séance introuvable.' };
      if (seance.debut - maintenant() < c.annulationMinutes * 60 * 1000) {
        return { erreur: `Trop tard : une séance ne peut plus être annulée moins de ${c.annulationMinutes} minutes avant.` };
      }
      q.annuler.run(discordId, date, heure, texte.slice(0, 500), maintenant().toISOString());
      return { ok: true, seance };
    },

    profil(discordId) {
      return q.profil.get(discordId) || null;
    },

    // Créneaux libres des prochains jours, pour une séance ponctuelle (au moins 1 h à l'avance).
    creneauxLibres(jours = 7) {
      const now = maintenant();
      const du = dateISO(now);
      const au = ajouterJours(du, jours);
      const pris = new Set(occurrences(du, au).map((o) => `${o.date} ${o.heure}`));
      const libres = [];
      for (let d = du; d <= au; d = ajouterJours(d, 1)) {
        for (const heure of creneaux) {
          const debut = aHeure(d, heure);
          if (debut - now < 3600 * 1000 || pris.has(`${d} ${heure}`)) continue;
          libres.push({ date: d, heure, debut });
        }
      }
      return libres;
    },
    seancePonctuelle(discordId, type = 'entree') {
      return q.ponctuelle.get(discordId, type) || null;
    },
    // Réserve (ou reporte) la séance ponctuelle du membre.
    reserverPonctuelle(discordId, date, heure, type = 'entree') {
      const libre = this.creneauxLibres(14).find((x) => x.date === date && x.heure === heure);
      if (!libre) return { erreur: "Ce créneau n'est plus libre. Choisis-en un autre." };
      const ancienne = q.ponctuelle.get(discordId, type);
      if (ancienne && aHeure(ancienne.date, ancienne.heure) - maintenant() < c.annulationMinutes * 60 * 1000 && aHeure(ancienne.date, ancienne.heure) > maintenant()) {
        return { erreur: `Ton coaching commence dans moins de ${c.annulationMinutes} minutes : il ne peut plus être reporté.` };
      }
      try {
        db.exec('BEGIN IMMEDIATE');
        if (ancienne && aHeure(ancienne.date, ancienne.heure) > maintenant()) q.supprimerPonctuelle.run(ancienne.id);
        q.insererPonctuelle.run(discordId, date, heure, type, maintenant().toISOString());
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        if (/UNIQUE/.test(err.message)) return { erreur: "Ce créneau vient d'être pris. Choisis-en un autre." };
        throw err;
      }
      return { ok: true, seance: q.ponctuelle.get(discordId, type) };
    },

    reserveurs() {
      return q.reserveurs.all().map((r) => r.discord_id);
    },

    supprimerMembre(discordId) {
      return q.supprimerMembre.run(discordId).changes;
    },

    lundiDe,
    ajouterJours,
    dateISO,
  };
}

module.exports = { creerCoaching, JOURS, lundiDe, ajouterJours, dateISO, jourIndex, aHeure };
