'use strict';

// Coaching privé : séances de 30 minutes à heure fixe (UTC), un créneau par jour.
// - Deux façons de réserver : créneaux fixes (les mêmes chaque semaine) ou semaine par semaine.
// - Règle du jour même : une réservation faite moins de `delaiReservationHeures` avant la PREMIÈRE séance de la journée
//   (15h00 → limite 11h00) ne compte pas ce jour-là.
// - Le coach donne ses disponibilités chaque semaine et peut signaler un imprévu : les séances touchées s'affichent en rouge
//   chez le membre et lui donnent un coaching en réserve (5 au maximum), à utiliser quand il veut, en plus des autres.
// - Le membre annule ou reporte une séance jusqu'à 30 minutes avant, avec une justification.

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const JOUR_MS = 24 * 3600 * 1000;
const RAPPELS_POSSIBLES = [240, 180, 120, 90];
const MAX_RESERVES = 5;
// Séances à une date précise (les créneaux fixes, eux, se répètent chaque semaine).
const TYPES_PONCTUELLES = { entree: 'Coaching d\'entrée', semaine: 'Semaine par semaine', report: 'Séance reportée', reserve: 'Coaching en réserve' };

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
function fuseauValide(f) {
  if (!f || typeof f !== 'string' || f.length > 64) return false;
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: f }).format(new Date()); return true; } catch { return false; }
}
const cle = (date, heure) => `${date} ${heure}`;

function creerCoaching({ db, config, maintenant = () => new Date() }) {
  const c = config.coaching;
  const creneaux = [...c.creneaux].sort();
  const premier = creneaux[0];

  const q = {
    toutes: db.prepare('SELECT * FROM reservations ORDER BY jour, heure'),
    miennes: db.prepare('SELECT * FROM reservations WHERE discord_id = ? ORDER BY jour, heure'),
    supprimer: db.prepare('DELETE FROM reservations WHERE id = ?'),
    supprimerFixes: db.prepare('DELETE FROM reservations WHERE discord_id = ?'),
    supprimerPonctuellesFutures: db.prepare('DELETE FROM seances_ponctuelles WHERE discord_id = ? AND date >= ?'),
    inserer: db.prepare('INSERT INTO reservations (discord_id, jour, heure, effectif_le, cree_le) VALUES (?, ?, ?, ?, ?)'),
    annulations: db.prepare('SELECT * FROM annulations WHERE date BETWEEN ? AND ?'),
    annuler: db.prepare('INSERT OR IGNORE INTO annulations (discord_id, date, heure, justification, cree_le) VALUES (?, ?, ?, ?, ?)'),
    profil: db.prepare('SELECT * FROM profils_coaching WHERE discord_id = ?'),
    majProfil: db.prepare(`INSERT INTO profils_coaching (discord_id, pseudo, rappel_min, maj_le) VALUES (?, ?, COALESCE(?, 240), ?)
                           ON CONFLICT(discord_id) DO UPDATE SET pseudo = COALESCE(excluded.pseudo, pseudo),
                           rappel_min = COALESCE(?, rappel_min), maj_le = excluded.maj_le`),
    assurerProfil: db.prepare('INSERT OR IGNORE INTO profils_coaching (discord_id, pseudo, rappel_min, maj_le) VALUES (?, ?, 240, ?)'),
    fuseau: db.prepare('UPDATE profils_coaching SET fuseau = ?, pseudo = COALESCE(?, pseudo) WHERE discord_id = ?'),
    reserves: db.prepare('UPDATE profils_coaching SET reserves = ?, maj_le = ? WHERE discord_id = ?'),
    reserveurs: db.prepare("SELECT discord_id FROM reservations UNION SELECT discord_id FROM seances_ponctuelles WHERE date >= ? AND type != 'entree'"),
    // Séances ponctuelles : coaching d'entrée, semaine par semaine, séance reportée, coaching en réserve.
    ponctuelles: db.prepare('SELECT * FROM seances_ponctuelles WHERE date BETWEEN ? AND ?'),
    ponctuelle: db.prepare('SELECT * FROM seances_ponctuelles WHERE discord_id = ? AND type = ? ORDER BY date DESC, heure DESC LIMIT 1'),
    ponctuelleA: db.prepare('SELECT * FROM seances_ponctuelles WHERE date = ? AND heure = ?'),
    insererPonctuelle: db.prepare('INSERT INTO seances_ponctuelles (discord_id, date, heure, type, cree_le) VALUES (?, ?, ?, ?, ?)'),
    supprimerPonctuelle: db.prepare('DELETE FROM seances_ponctuelles WHERE id = ?'),
    semaineMembre: db.prepare("SELECT * FROM seances_ponctuelles WHERE discord_id = ? AND type = 'semaine' AND date BETWEEN ? AND ? ORDER BY date"),
    // Absences et imprévus du coach.
    absences: db.prepare('SELECT * FROM absences_coach WHERE date BETWEEN ? AND ? ORDER BY date, heure'),
    absenceA: db.prepare('SELECT * FROM absences_coach WHERE date = ? AND heure = ?'),
    supprimerAbsence: db.prepare("DELETE FROM absences_coach WHERE date = ? AND heure = ? AND type = 'absence'"),
    insererAbsence: db.prepare("INSERT OR IGNORE INTO absences_coach (date, heure, type, message, cree_le) VALUES (?, ?, 'absence', NULL, ?)"),
    imprevu: db.prepare(`INSERT INTO absences_coach (date, heure, type, message, cree_le) VALUES (?, ?, 'imprevu', ?, ?)
                         ON CONFLICT(date, heure) DO UPDATE SET type = 'imprevu', message = excluded.message`),
    dispoEnvoyee: db.prepare('INSERT INTO disponibilites_coach (lundi, envoye_le) VALUES (?, ?) ON CONFLICT(lundi) DO UPDATE SET envoye_le = excluded.envoye_le'),
    dispo: db.prepare('SELECT * FROM disponibilites_coach WHERE lundi = ?'),
    // Séances touchées par une absence ou un imprévu du coach.
    touchees: db.prepare('SELECT * FROM seances_touchees WHERE date BETWEEN ? AND ? ORDER BY date, heure'),
    toucheesMembre: db.prepare('SELECT * FROM seances_touchees WHERE discord_id = ? AND date >= ? ORDER BY date, heure'),
    touchee: db.prepare('SELECT * FROM seances_touchees WHERE date = ? AND heure = ?'),
    toucher: db.prepare('INSERT OR IGNORE INTO seances_touchees (date, heure, discord_id, type, message, credite, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    majTouchee: db.prepare('UPDATE seances_touchees SET type = ?, message = ? WHERE date = ? AND heure = ?'),
    supprimerTouchee: db.prepare('DELETE FROM seances_touchees WHERE date = ? AND heure = ?'),
    choisir: db.prepare('UPDATE seances_touchees SET choix = ?, choisi_le = ? WHERE date = ? AND heure = ? AND discord_id = ? AND choix IS NULL'),
  };
  const iso = () => maintenant().toISOString();
  function transaction(f) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = f(); db.exec('COMMIT'); return r; } catch (err) { db.exec('ROLLBACK'); throw err; }
  }

  // Limite de réservation pour un jour donné (ex. 11h00 si la première séance est à 15h00).
  function limiteDuJour(dateStr) {
    return new Date(aHeure(dateStr, premier).getTime() - c.delaiReservationHeures * 3600 * 1000);
  }
  // Une séance à cette date peut-elle être réservée maintenant ? (au moins 1 h avant ; le jour même, avant la limite)
  function reservable(date, heure) {
    const now = maintenant();
    if (aHeure(date, heure) - now < 3600 * 1000) return false;
    return !(date === dateISO(now) && now >= limiteDuJour(date));
  }

  // Date (AAAA-MM-JJ) de la première séance qui comptera pour un créneau fixe réservé maintenant
  // (reportée d'une semaine si ce jour-là le coach est absent ou le créneau déjà pris par une séance ponctuelle).
  function effectifPour(jour, heure) {
    const now = maintenant();
    const aujourdhui = dateISO(now);
    let date = ajouterJours(aujourdhui, (jour - jourIndex(now) + 7) % 7);
    if (date === aujourdhui && (now >= limiteDuJour(aujourdhui) || now >= aHeure(date, heure))) date = ajouterJours(date, 7);
    for (let i = 0; i < 8 && (q.absenceA.get(date, heure) || q.ponctuelleA.get(date, heure)); i++) date = ajouterJours(date, 7);
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
  // type : fixe | entree | semaine | report | reserve ; touchee : { type, message } si le coach est absent à ce moment-là.
  function occurrences(du, au, { discordId } = {}) {
    const res = discordId ? q.miennes.all(discordId) : q.toutes.all();
    const annul = new Set(q.annulations.all(du, au).map((a) => `${cle(a.date, a.heure)} ${a.discord_id}`));
    const absences = new Map(q.absences.all(du, au).map((a) => [cle(a.date, a.heure), a]));
    const liste = [];
    const ajouter = (o) => {
      const a = absences.get(cle(o.date, o.heure));
      liste.push(a ? { ...o, touchee: { type: a.type, message: a.message } } : o);
    };
    for (let d = du; d <= au; d = ajouterJours(d, 1)) {
      const j = jourIndex(new Date(`${d}T00:00:00.000Z`));
      for (const r of res) {
        if (r.jour !== j || d < r.effectif_le || annul.has(`${cle(d, r.heure)} ${r.discord_id}`)) continue;
        ajouter({ date: d, heure: r.heure, discordId: r.discord_id, debut: aHeure(d, r.heure), type: 'fixe' });
      }
    }
    for (const p of q.ponctuelles.all(du, au)) {
      if (discordId && p.discord_id !== discordId) continue;
      ajouter({ date: p.date, heure: p.heure, discordId: p.discord_id, debut: aHeure(p.date, p.heure), type: p.type });
    }
    return liste.sort((a, b) => a.debut - b.debut);
  }

  function assurerProfil(discordId, pseudo) {
    q.assurerProfil.run(discordId, pseudo || null, iso());
    return q.profil.get(discordId);
  }
  // Ajoute (ou retire) un coaching en réserve, entre 0 et 5. Renvoie true si le compteur a changé.
  function crediter(discordId, n) {
    const p = assurerProfil(discordId);
    const r = Math.max(0, Math.min(MAX_RESERVES, (p.reserves || 0) + n));
    if (r === (p.reserves || 0)) return false;
    q.reserves.run(r, iso(), discordId);
    return true;
  }
  // Séances à venir tombées sur une absence ou un imprévu du coach : touchées une fois, avec un coaching en réserve.
  function toucher(du, au) {
    const now = maintenant();
    const deja = new Set(q.touchees.all(du, au).map((t) => cle(t.date, t.heure)));
    const res = [];
    for (const o of occurrences(du, au)) {
      if (!o.touchee || o.debut <= now || deja.has(cle(o.date, o.heure))) continue;
      const credite = crediter(o.discordId, +1);
      q.toucher.run(o.date, o.heure, o.discordId, o.touchee.type, o.touchee.message || null, credite ? 1 : 0, iso());
      res.push({ ...o, credite });
    }
    return res;
  }
  function creneauxLibres(jours = 7) {
    const now = maintenant();
    const du = dateISO(now);
    const au = ajouterJours(du, jours);
    const pris = new Set(occurrences(du, au).map((o) => cle(o.date, o.heure)));
    const absents = new Set(q.absences.all(du, au).map((a) => cle(a.date, a.heure)));
    const libres = [];
    for (let d = du; d <= au; d = ajouterJours(d, 1)) {
      for (const heure of creneaux) {
        if (!reservable(d, heure) || pris.has(cle(d, heure)) || absents.has(cle(d, heure))) continue;
        libres.push({ date: d, heure, debut: aHeure(d, heure) });
      }
    }
    return libres;
  }
  const estLibre = (date, heure) => creneauxLibres(14).some((x) => x.date === date && x.heure === heure);
  function prochainesSeances(discordId, jours = 8) {
    const now = maintenant();
    return occurrences(dateISO(now), ajouterJours(dateISO(now), jours), { discordId }).filter((o) => o.debut > now);
  }
  // Retire une séance du membre (annulation ou report) : un créneau fixe est annulé ce jour-là, une séance ponctuelle supprimée.
  function retirerSeance(discordId, seance, justification) {
    if (seance.type !== 'fixe') {
      const p = q.ponctuelleA.get(seance.date, seance.heure);
      if (p && p.discord_id === discordId) q.supprimerPonctuelle.run(p.id);
    }
    q.annuler.run(discordId, seance.date, seance.heure, justification.slice(0, 500), iso());
  }
  function seanceAModifier(discordId, date, heure, justification) {
    const texte = String(justification || '').trim();
    if (texte.length < 5) return { erreur: 'Explique en quelques mots pourquoi.' };
    const seance = prochainesSeances(discordId, 21).find((o) => o.date === date && o.heure === heure);
    if (!seance) return { erreur: 'Séance introuvable.' };
    if (seance.touchee) return { erreur: 'Ton coach a déjà annulé cette séance : choisis Reprogrammer ou Garder en réserve.' };
    if (seance.debut - maintenant() < c.annulationMinutes * 60 * 1000) {
      return { erreur: `Trop tard : une séance ne peut plus être annulée ou reportée moins de ${c.annulationMinutes} minutes avant.` };
    }
    return { seance, texte };
  }

  const api = {
    JOURS,
    creneaux,
    RAPPELS_POSSIBLES,
    MAX_RESERVES,
    TYPES_PONCTUELLES,
    limiteDuJour,
    effectifPour,
    reservable,

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

    // Remplace les créneaux fixes du membre. Renvoie les créneaux qui ne comptent qu'à partir d'une semaine suivante.
    enregistrer(discordId, selection, rappelMin, pseudo) {
      const erreur = valider(selection);
      if (erreur) return { erreur };
      if (rappelMin !== undefined && !RAPPELS_POSSIBLES.includes(rappelMin)) return { erreur: 'Rappel invalide.' };
      const now = maintenant();
      try {
        return transaction(() => {
          const miennes = q.miennes.all(discordId);
          const voulu = new Set(selection.map((s) => `${s.jour} ${s.heure}`));
          for (const r of miennes) if (!voulu.has(`${r.jour} ${r.heure}`)) q.supprimer.run(r.id);
          const deja = new Set(miennes.map((r) => `${r.jour} ${r.heure}`));
          const decales = [];
          for (const s of selection) {
            if (deja.has(`${s.jour} ${s.heure}`)) continue;
            const effectif = effectifPour(s.jour, s.heure);
            q.inserer.run(discordId, s.jour, s.heure, effectif, now.toISOString());
            if (effectif !== ajouterJours(dateISO(now), (s.jour - jourIndex(now) + 7) % 7)) decales.push({ ...s, effectifLe: effectif });
          }
          // Passer aux créneaux fixes : les séances « semaine par semaine » à venir sont remplacées.
          for (const p of q.semaineMembre.all(discordId, dateISO(now), ajouterJours(dateISO(now), 21))) if (aHeure(p.date, p.heure) > now) q.supprimerPonctuelle.run(p.id);
          q.majProfil.run(discordId, pseudo || null, rappelMin === undefined ? null : rappelMin, now.toISOString(), rappelMin === undefined ? null : rappelMin);
          return { ok: true, decales, reservations: q.miennes.all(discordId) };
        });
      } catch (err) {
        if (/UNIQUE/.test(err.message)) return { erreur: "Un des créneaux vient d'être pris par quelqu'un d'autre. Choisis-en un autre." };
        throw err;
      }
    },
    creneauxFixes(discordId) { return q.miennes.all(discordId); },
    majRappel(discordId, rappelMin, pseudo) {
      if (!RAPPELS_POSSIBLES.includes(rappelMin)) return { erreur: 'Rappel invalide.' };
      q.majProfil.run(discordId, pseudo || null, rappelMin, iso(), rappelMin);
      return { ok: true };
    },
    retirerCreneauxFixes(discordId) { return q.supprimerFixes.run(discordId).changes; },

    occurrences,
    prochainesSeances,

    // ---------- Semaine par semaine ----------
    // La grille d'une semaine précise (dates réelles) : libre, pris, moi, touchée (coach absent), absent, passé.
    grilleSemaine(discordId, lundi) {
      const dimanche = ajouterJours(lundi, 6);
      const occ = new Map(occurrences(lundi, dimanche).map((o) => [cle(o.date, o.heure), o]));
      const absents = new Set(q.absences.all(lundi, dimanche).map((a) => cle(a.date, a.heure)));
      const cases = [];
      for (let i = 0; i < 7; i++) {
        const date = ajouterJours(lundi, i);
        for (const heure of creneaux) {
          const o = occ.get(cle(date, heure));
          let etat;
          if (o) etat = o.discordId !== discordId ? 'pris' : o.touchee ? 'touchee' : 'moi';
          else etat = absents.has(cle(date, heure)) ? 'absent' : reservable(date, heure) ? 'libre' : 'passe';
          cases.push({ date, heure, etat, type: o && o.discordId === discordId ? o.type : null,
            modifiable: Boolean(o && o.discordId === discordId && o.type === 'semaine' && reservable(date, heure)) });
        }
      }
      return { lundi, cases };
    },
    // Remplace les séances « semaine par semaine » à venir de cette semaine (3 à 5 par semaine, une par jour).
    reserverSemaine(discordId, lundi, selection, pseudo) {
      const now = maintenant();
      const cetteSemaine = lundiDe(now);
      if (![cetteSemaine, ajouterJours(cetteSemaine, 7)].includes(lundi)) return { erreur: 'Choisis cette semaine ou la semaine prochaine.' };
      if (q.miennes.all(discordId).length) return { erreur: 'Tu as des créneaux fixes : retire-les d\'abord pour réserver semaine par semaine.' };
      const dimanche = ajouterJours(lundi, 6);
      if (!Array.isArray(selection)) return { erreur: 'Sélection invalide.' };
      for (const s of selection) {
        if (typeof s.date !== 'string' || s.date < lundi || s.date > dimanche || !creneaux.includes(s.heure)) return { erreur: 'Créneau invalide.' };
      }
      const existantes = q.semaineMembre.all(discordId, lundi, dimanche);
      const figees = existantes.filter((p) => !reservable(p.date, p.heure)); // passées ou trop proches : on n'y touche plus
      const finales = new Map(figees.map((p) => [cle(p.date, p.heure), p]));
      for (const s of selection) finales.set(cle(s.date, s.heure), s);
      const jours = new Set([...finales.values()].map((x) => x.date));
      if (jours.size !== finales.size) return { erreur: 'Un seul créneau par jour.' };
      if (finales.size < c.minParSemaine) return { erreur: `Choisis au moins ${c.minParSemaine} créneaux dans la semaine.` };
      if (c.maxParSemaine && finales.size > c.maxParSemaine) return { erreur: `${c.maxParSemaine} créneaux au maximum par semaine.` };
      const miennes = new Set(existantes.map((p) => cle(p.date, p.heure)));
      for (const s of selection) {
        if (miennes.has(cle(s.date, s.heure))) continue;
        if (!estLibre(s.date, s.heure)) return { erreur: `Le créneau du ${s.date} à ${s.heure} n'est plus libre. Choisis-en un autre.` };
      }
      try {
        return transaction(() => {
          const voulues = new Set(selection.map((s) => cle(s.date, s.heure)));
          for (const p of existantes) if (reservable(p.date, p.heure) && !voulues.has(cle(p.date, p.heure))) q.supprimerPonctuelle.run(p.id);
          for (const s of selection) if (!miennes.has(cle(s.date, s.heure))) q.insererPonctuelle.run(discordId, s.date, s.heure, 'semaine', now.toISOString());
          assurerProfil(discordId, pseudo);
          return { ok: true, seances: q.semaineMembre.all(discordId, lundi, dimanche) };
        });
      } catch (err) {
        if (/UNIQUE/.test(err.message)) return { erreur: "Un des créneaux vient d'être pris. Choisis-en un autre." };
        throw err;
      }
    },
    // A-t-il des coachings prévus ? (créneaux fixes, ou séances « semaine par semaine » dans les 7 prochains jours)
    aUnPlanning(discordId) {
      if (q.miennes.all(discordId).length) return true;
      const aujourdhui = dateISO(maintenant());
      return q.semaineMembre.all(discordId, aujourdhui, ajouterJours(aujourdhui, 7)).length > 0;
    },

    // ---------- Annuler ou reporter (membre) ----------
    // Annulation d'une séance précise, au plus tard 30 min avant, avec justification. Une séance prise sur une réserve rend la réserve.
    annuler(discordId, date, heure, justification) {
      const r = seanceAModifier(discordId, date, heure, justification);
      if (r.erreur) return r;
      transaction(() => {
        retirerSeance(discordId, r.seance, r.texte);
        if (r.seance.type === 'reserve') crediter(discordId, +1);
      });
      return { ok: true, seance: r.seance };
    },
    // Report sur un autre créneau libre (même règles que l'annulation).
    reporter(discordId, date, heure, justification, nouvelle = {}) {
      const r = seanceAModifier(discordId, date, heure, justification);
      if (r.erreur) return r;
      if (!estLibre(nouvelle.date, nouvelle.heure)) return { erreur: "Ce nouveau créneau n'est plus libre. Choisis-en un autre." };
      const type = ['fixe', 'semaine'].includes(r.seance.type) ? 'report' : r.seance.type;
      try {
        transaction(() => {
          retirerSeance(discordId, r.seance, r.texte);
          q.insererPonctuelle.run(discordId, nouvelle.date, nouvelle.heure, type, iso());
        });
      } catch (err) {
        if (/UNIQUE/.test(err.message)) return { erreur: "Ce créneau vient d'être pris. Choisis-en un autre." };
        throw err;
      }
      return { ok: true, seance: r.seance, nouvelle: { date: nouvelle.date, heure: nouvelle.heure, debut: aHeure(nouvelle.date, nouvelle.heure), type } };
    },

    // ---------- Coachings en réserve ----------
    reserves(discordId) { const p = q.profil.get(discordId); return (p && p.reserves) || 0; },
    utiliserReserve(discordId, date, heure) {
      if (api.reserves(discordId) < 1) return { erreur: 'Tu n\'as pas de coaching en réserve.' };
      if (!estLibre(date, heure)) return { erreur: "Ce créneau n'est plus libre. Choisis-en un autre." };
      try {
        transaction(() => {
          q.insererPonctuelle.run(discordId, date, heure, 'reserve', iso());
          crediter(discordId, -1);
        });
      } catch (err) {
        if (/UNIQUE/.test(err.message)) return { erreur: "Ce créneau vient d'être pris. Choisis-en un autre." };
        throw err;
      }
      return { ok: true, seance: { date, heure, debut: aHeure(date, heure), type: 'reserve' }, reserves: api.reserves(discordId) };
    },
    // Séances annulées par le coach, en attente du choix du membre (Reprogrammer ou Garder en réserve).
    toucheesAChoisir(discordId) {
      return q.toucheesMembre.all(discordId, ajouterJours(dateISO(maintenant()), -7)).filter((t) => !t.choix)
        .map((t) => ({ ...t, debut: aHeure(t.date, t.heure) }));
    },
    choisirTouchee(discordId, date, heure, choix, nouvelle = {}) {
      const t = q.touchee.get(date, heure);
      if (!t || t.discord_id !== discordId) return { erreur: 'Séance introuvable.' };
      if (t.choix) return { erreur: 'C\'est déjà fait.' };
      if (choix === 'reserve') {
        q.choisir.run('reserve', iso(), date, heure, discordId);
        return { ok: true, reserves: api.reserves(discordId) };
      }
      if (choix !== 'reprogrammer') return { erreur: 'Choix inconnu.' };
      const r = api.utiliserReserve(discordId, nouvelle.date, nouvelle.heure);
      if (r.erreur) return r;
      q.choisir.run('reprogramme', iso(), date, heure, discordId);
      return r;
    },

    // ---------- Disponibilités et imprévus (coach) ----------
    disponibilites(lundi) {
      const dimanche = ajouterJours(lundi, 6);
      return { lundi, absences: q.absences.all(lundi, dimanche), envoye: q.dispo.get(lundi) || null, seances: occurrences(lundi, dimanche) };
    },
    // Absences du coach pour une semaine (les créneaux non cochés). Renvoie les séances touchées et celles rétablies.
    enregistrerDisponibilites(lundi, absences) {
      const now = maintenant();
      const dimanche = ajouterJours(lundi, 6);
      const valides = (Array.isArray(absences) ? absences : [])
        .filter((a) => a && typeof a.date === 'string' && a.date >= lundi && a.date <= dimanche && creneaux.includes(a.heure) && aHeure(a.date, a.heure) > now);
      return transaction(() => {
        for (const a of q.absences.all(lundi, dimanche)) if (a.type === 'absence' && aHeure(a.date, a.heure) > now) q.supprimerAbsence.run(a.date, a.heure);
        for (const a of valides) q.insererAbsence.run(a.date, a.heure, now.toISOString());
        q.dispoEnvoyee.run(lundi, now.toISOString());
        const touchees = toucher(lundi, dimanche);
        // Créneaux de nouveau disponibles : la séance est rétablie si le membre n'a encore rien choisi.
        const absents = new Set(q.absences.all(lundi, dimanche).map((a) => cle(a.date, a.heure)));
        const retablies = [];
        for (const t of q.touchees.all(lundi, dimanche)) {
          if (t.type !== 'absence' || absents.has(cle(t.date, t.heure)) || t.choix || aHeure(t.date, t.heure) <= now) continue;
          q.supprimerTouchee.run(t.date, t.heure);
          if (t.credite) crediter(t.discord_id, -1);
          retablies.push({ date: t.date, heure: t.heure, discordId: t.discord_id, debut: aHeure(t.date, t.heure) });
        }
        return { ok: true, absences: valides.length, touchees, retablies };
      });
    },
    // Imprévu du jour : les séances choisies sont annulées, avec le message du coach pour chaque membre.
    signalerImprevu(date, heures, message) {
      const texte = String(message || '').trim();
      if (texte.length < 3) return { erreur: 'Écris un message pour les membres concernés.' };
      const now = maintenant();
      const valides = [...new Set(Array.isArray(heures) ? heures : [heures])].filter((h) => creneaux.includes(h) && aHeure(date, h) > now);
      if (!valides.length) return { erreur: 'Choisis au moins une séance à venir.' };
      return transaction(() => {
        for (const h of valides) {
          q.imprevu.run(date, h, texte.slice(0, 1000), now.toISOString());
          if (q.touchee.get(date, h)) q.majTouchee.run('imprevu', texte.slice(0, 1000), date, h);
        }
        const touchees = toucher(date, date).filter((t) => valides.includes(t.heure));
        return { ok: true, touchees, creneaux: valides };
      });
    },
    absences(du, au) { return q.absences.all(du, au); },
    touchees(du, au) { return q.touchees.all(du, au); },
    dispoEnvoyee(lundi) { return q.dispo.get(lundi) || null; },

    // ---------- Profil ----------
    profil(discordId) {
      return q.profil.get(discordId) || null;
    },
    majFuseau(discordId, fuseau, pseudo) {
      if (!fuseauValide(fuseau)) return false;
      assurerProfil(discordId, pseudo);
      q.fuseau.run(fuseau, pseudo || null, discordId);
      return true;
    },

    // Créneaux libres des prochains jours, pour une séance ponctuelle (au moins 1 h à l'avance, avant la limite du jour même).
    creneauxLibres,
    seancePonctuelle(discordId, type = 'entree') {
      return q.ponctuelle.get(discordId, type) || null;
    },
    // Réserve (ou reporte) la séance ponctuelle du membre (coaching d'entrée).
    reserverPonctuelle(discordId, date, heure, type = 'entree') {
      if (!estLibre(date, heure)) return { erreur: "Ce créneau n'est plus libre. Choisis-en un autre." };
      const ancienne = q.ponctuelle.get(discordId, type);
      if (ancienne && aHeure(ancienne.date, ancienne.heure) - maintenant() < c.annulationMinutes * 60 * 1000 && aHeure(ancienne.date, ancienne.heure) > maintenant()) {
        return { erreur: `Ton coaching commence dans moins de ${c.annulationMinutes} minutes : il ne peut plus être reporté.` };
      }
      try {
        transaction(() => {
          if (ancienne && aHeure(ancienne.date, ancienne.heure) > maintenant()) q.supprimerPonctuelle.run(ancienne.id);
          q.insererPonctuelle.run(discordId, date, heure, type, iso());
        });
      } catch (err) {
        if (/UNIQUE/.test(err.message)) return { erreur: "Ce créneau vient d'être pris. Choisis-en un autre." };
        throw err;
      }
      return { ok: true, seance: q.ponctuelle.get(discordId, type) };
    },

    // Membres qui ont des coachings à venir (créneaux fixes ou séances ponctuelles, hors coaching d'entrée).
    reserveurs() {
      return q.reserveurs.all(dateISO(maintenant())).map((r) => r.discord_id);
    },
    // Libère tous ses coachings (créneaux fixes et séances à venir).
    supprimerMembre(discordId) {
      return q.supprimerFixes.run(discordId).changes + q.supprimerPonctuellesFutures.run(discordId, dateISO(maintenant())).changes;
    },

    lundiDe,
    ajouterJours,
    dateISO,
  };
  return api;
}

module.exports = { creerCoaching, JOURS, lundiDe, ajouterJours, dateISO, jourIndex, aHeure, fuseauValide, MAX_RESERVES, TYPES_PONCTUELLES };
