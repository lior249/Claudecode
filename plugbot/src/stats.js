// Calculs purs : chaînes, prison et classements. Aucun accès à Discord ni à la base ici.

import { dayOf } from './time.js';

// Paliers de la prison, en jours entiers sans show-up. Le premier palier fait entrer en prison.
export const PRISON_LEVELS = [3, 6, 10, 15, 30];
export const DAYS_TO_LEAVE_PRISON = 3;
// Jours entiers à passer sur le serveur avant que la prison s'applique.
export const DAYS_BEFORE_TRACKING = 7;

const PROOF_TYPES = /^(image|video)\//;
const PROOF_EXTENSIONS = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|mp4|mov|webm|m4v)$/i;

// Une pièce jointe compte comme preuve si c'est une image ou une vidéo.
export function isProof(attachment) {
  return PROOF_TYPES.test(attachment.contentType ?? '') || PROOF_EXTENSIONS.test(attachment.name ?? '');
}

// Premier jour où la prison s'applique : le lendemain du lancement du bot,
// et pas avant que le membre ait passé 7 jours entiers sur le serveur.
export function trackingStartDay(joinedAt, launchDay) {
  const joinedDay = joinedAt == null ? -Infinity : dayOf(joinedAt);
  return Math.max(launchDay + 1, joinedDay + DAYS_BEFORE_TRACKING + 1);
}

// Nombre de jours d'affilée avec au moins un show-up. Tant que la journée n'est pas finie,
// une chaîne qui s'arrête hier est toujours vivante.
export function chainLength(days, today) {
  let day = days.has(today) ? today : today - 1;
  let length = 0;
  while (days.has(day)) {
    length++;
    day--;
  }
  return length;
}

// Rejoue les journées depuis le début du suivi pour savoir si le membre est en prison.
// On y entre après 3 jours entiers sans show-up, on en sort après 3 jours de show-up d'affilée.
export function prisonState(days, startDay, today) {
  let inPrison = false;
  let entryDay = null;
  let missed = 0;
  let run = 0;
  for (let day = startDay; day <= today; day++) {
    if (days.has(day)) {
      run++;
      missed = 0;
      if (inPrison && run >= DAYS_TO_LEAVE_PRISON) {
        inPrison = false;
        entryDay = null;
      }
    } else if (day < today) {
      run = 0;
      missed++;
      if (!inPrison && missed >= PRISON_LEVELS[0]) {
        inPrison = true;
        entryDay = day + 1;
      }
    }
  }
  return { inPrison, entryDay, missed, daysToLeave: inPrison ? DAYS_TO_LEAVE_PRISON - run : 0 };
}

// Palier atteint pour un nombre de jours sans show-up (0 si aucun).
export function prisonLevel(missed) {
  return PRISON_LEVELS.filter((level) => level <= missed).at(-1) ?? 0;
}

// Tri d'un classement : le score, puis le départage, puis celui qui a atteint son score le premier.
export function sortLeaderboard(entries) {
  return [...entries].sort(
    (a, b) =>
      b.score - a.score ||
      (b.tiebreak ?? 0) - (a.tiebreak ?? 0) ||
      a.reachedAt - b.reachedAt ||
      a.userId.localeCompare(b.userId),
  );
}

// Les lignes (rows) viennent de tracker.snapshot() : une par membre suivi.
// Les membres en prison ne figurent dans aucun classement.

export function weeklyLeaderboard(rows, category) {
  return sortLeaderboard(
    rows
      .filter((row) => row.category === category && !row.prison.inPrison && row.week > 0)
      .map((row) => ({ userId: row.userId, score: row.week, tiebreak: row.total, reachedAt: row.weekReachedAt })),
  );
}

export function allTimeLeaderboard(rows, category) {
  return sortLeaderboard(
    rows
      .filter((row) => row.category === category && !row.prison.inPrison && row.total > 0)
      .map((row) => ({ userId: row.userId, score: row.total, reachedAt: row.totalReachedAt })),
  );
}

// Classement de la prison : ceux qui y sont depuis le plus longtemps.
export function prisonLeaderboard(rows, category, today) {
  return rows
    .filter((row) => row.category === category && row.prison.inPrison)
    .map((row) => ({ userId: row.userId, score: today - row.prison.entryDay + 1, missed: row.prison.missed }))
    .sort((a, b) => b.score - a.score || b.missed - a.missed || a.userId.localeCompare(b.userId));
}
