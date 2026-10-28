// Toutes les heures de PlugBot sont en temps universel (UTC).

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

// Le 4 janvier 1970 était un dimanche : les semaines démarrent le dimanche à 18 h UTC.
const FIRST_WEEK_START = Date.UTC(1970, 0, 4, 18);

// Numéro du jour UTC (nombre de jours écoulés depuis le 1er janvier 1970).
export function dayOf(timestamp) {
  return Math.floor(timestamp / DAY_MS);
}

// Début de la semaine en cours : le dernier dimanche 18 h UTC passé.
export function weekStart(timestamp) {
  return FIRST_WEEK_START + Math.floor((timestamp - FIRST_WEEK_START) / WEEK_MS) * WEEK_MS;
}

export function weekRange(timestamp) {
  const start = weekStart(timestamp);
  return { start, end: start + WEEK_MS };
}
