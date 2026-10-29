// Toutes les heures de PlugBot sont en temps universel (UTC).

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
// Heure des publications quotidiennes et de la fin des challenges, en temps universel (GMT).
// Pour la changer, il suffit de modifier ces deux nombres.
export const EVENING_HOUR = 20;
export const EVENING_MINUTE = 30;
export const EVENING_MS = (EVENING_HOUR * 60 + EVENING_MINUTE) * 60 * 1000;
// Heure du compte à rebours de la prison, en temps universel (GMT).
export const PRISON_COUNTDOWN_HOUR = 18;
// Toute la période depuis le lancement, pour le classement all-time.
export const ALL_TIME = { start: 0, end: Number.MAX_SAFE_INTEGER };

// Le 4 janvier 1970 était un dimanche.
const FIRST_SUNDAY_EVENING = Date.UTC(1970, 0, 4) + EVENING_MS;

// Numéro du jour UTC (nombre de jours écoulés depuis le 1er janvier 1970).
export function dayOf(timestamp) {
  return Math.floor(timestamp / DAY_MS);
}

// Jour UTC du dernier 20 h 30 passé : la veille tant qu'il n'est pas 20 h 30.
export function eveningDay(timestamp) {
  return dayOf(timestamp - EVENING_MS);
}

// Fin de la dernière semaine de challenge : le dernier dimanche 20 h 30 UTC passé.
export function lastWeekEnd(timestamp) {
  return FIRST_SUNDAY_EVENING + Math.floor((timestamp - FIRST_SUNDAY_EVENING) / WEEK_MS) * WEEK_MS;
}

// Challenge de la semaine : du dimanche 20 h 30 au dimanche 20 h 30 suivant (UTC), sans pause.
// Il est annoncé le lundi soir.
export function weekRange(timestamp) {
  const start = lastWeekEnd(timestamp);
  return { start, end: start + WEEK_MS };
}

// Fin d'un mois : son dernier jour à 20 h 30 UTC. `month` peut déborder (-1 = décembre de l'année d'avant).
function monthEnd(year, month) {
  return Date.UTC(year, month + 1, 0) + EVENING_MS;
}

// Fin du dernier challenge du mois : le dernier « dernier jour du mois à 20 h 30 UTC » passé.
export function lastMonthEnd(timestamp) {
  const date = new Date(timestamp);
  const end = monthEnd(date.getUTCFullYear(), date.getUTCMonth());
  return timestamp >= end ? end : monthEnd(date.getUTCFullYear(), date.getUTCMonth() - 1);
}

// Challenge du mois : du dernier jour du mois précédent à 20 h 30 au dernier jour du mois à 20 h 30 (UTC),
// sans pause. Il est annoncé le 1er au soir.
export function monthRange(timestamp) {
  const start = lastMonthEnd(timestamp);
  const date = new Date(start + DAY_MS);
  return { start, end: monthEnd(date.getUTCFullYear(), date.getUTCMonth()) };
}

// « novembre 2026 » pour le mois qui se termine à `end`.
export function monthName(end) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(end);
}

// « 30 novembre », et « 1er novembre » pour le premier du mois.
export function dayAndMonth(timestamp) {
  const text = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(timestamp);
  return text.replace(/^1 /, '1er ');
}
