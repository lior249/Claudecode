// Calculs purs : chaînes, prison et classements. Aucun accès à Discord ni à la base ici.

import { dayOf } from './time.js';

// Jours entiers sans show-up avant la prison, selon la catégorie du membre.
export const PRISON_DAYS = { free: 21, plug: 15 };
// L'alerte part 5 jours avant la prison.
export const WARNING_DAYS_BEFORE = 5;
// Dernier message de prison : « définitivement en prison ».
export const FINAL_PRISON_DAYS = 30;
export const DAYS_TO_LEAVE_PRISON = 3;
// Jours entiers à passer sur le serveur avant que la prison s'applique.
export const DAYS_BEFORE_TRACKING = 7;

const PROOF_TYPES = /^(image|video)\//;
const PROOF_EXTENSIONS = /\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|mp4|mov|webm|m4v)$/i;

// Une pièce jointe compte comme preuve si c'est une image ou une vidéo.
export function isProof(attachment) {
  return PROOF_TYPES.test(attachment.contentType ?? '') || PROOF_EXTENSIONS.test(attachment.name ?? '');
}

// Premier jour compté pour la prison : pas avant le lendemain du lancement du bot, ni avant que
// le membre ait passé 7 jours entiers sur le serveur, ni avant le lendemain d'une remise à zéro
// (changement de rôle ou libération par l'équipe).
export function trackingStartDay(joinedAt, launchDay, resetDay = null) {
  const joinedDay = joinedAt == null ? -Infinity : dayOf(joinedAt);
  return Math.max(launchDay + 1, joinedDay + DAYS_BEFORE_TRACKING + 1, (resetDay ?? -Infinity) + 1);
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

// Jours entiers sans show-up depuis le dernier show-up, comptés à partir de `startDay`.
// La journée en cours ne compte pas tant qu'elle n'est pas finie.
export function missedDays(days, startDay, today) {
  if (days.has(today)) return 0;
  let missed = 0;
  for (let day = today - 1; day >= startDay && !days.has(day); day--) missed++;
  return missed;
}

// Alerte 5 jours avant la prison, une seule fois par absence.
export function needsWarning(missed, prisonDays, today, lastWarningDay) {
  if (missed < prisonDays - WARNING_DAYS_BEFORE || missed >= prisonDays) return false;
  const absenceStart = today - missed;
  return lastWarningDay == null || lastWarningDay < absenceStart;
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

// Classement d'une catégorie sur une période. Les lignes (rows) viennent de tracker.snapshot().
// Les membres en prison n'y figurent pas. À points égaux, le plus gros total all-time passe devant.
export function leaderboard(rows, category) {
  return sortLeaderboard(
    rows
      .filter((row) => row.category === category && !row.prison.inPrison && row.points > 0)
      .map((row) => ({ userId: row.userId, score: row.points, tiebreak: row.total, reachedAt: row.pointsReachedAt })),
  );
}
