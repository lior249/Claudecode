// Dates et heures des événements : affichage en français et lecture de ce que tu tapes.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// « mercredi 5 novembre »
export function formatDate(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(timestamp);
}

// « 22 h 00 (GMT) »
export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getUTCHours())} h ${pad(date.getUTCMinutes())} (GMT)`;
}

// « mercredi 5 novembre à 22 h 00 (GMT) »
export function formatDateTime(timestamp) {
  return `${formatDate(timestamp)} à ${formatTime(timestamp)}`;
}

// « 05/11 » ou « 5/11/2026 ». Sans année, c'est la prochaine fois que cette date arrive.
// Renvoie le début du jour (minuit GMT), ou null si la date n'est pas valable.
export function parseDate(text, now) {
  const match = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?\s*$/.exec(text ?? '');
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  let year = match[3] ? Number(match[3]) : new Date(now).getUTCFullYear();
  if (year < 100) year += 2000;
  const date = Date.UTC(year, month, day);
  if (new Date(date).getUTCMonth() !== month || new Date(date).getUTCDate() !== day) return null;
  if (!match[3] && date < Math.floor(now / DAY_MS) * DAY_MS) return Date.UTC(year + 1, month, day);
  return date;
}

// « 22:00 », « 22h », « 22 h 30 » ou « 9h5 ». Renvoie le nombre de millisecondes depuis minuit, ou null.
export function parseTime(text) {
  const match = /^\s*(\d{1,2})\s*(?:[:h]\s*(\d{1,2})?)?\s*$/i.exec(text ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) return null;
  return (hours * 60 + minutes) * 60 * 1000;
}

// Durée en minutes : « 60 », « 90 min », « 1h30 ». Renvoie null si elle n'est pas valable.
export function parseDuration(text) {
  const hoursMatch = /^\s*(\d{1,2})\s*h\s*(\d{1,2})?\s*(?:min)?\s*$/i.exec(text ?? '');
  if (hoursMatch) return Number(hoursMatch[1]) * 60 + Number(hoursMatch[2] ?? 0) || null;
  const minutesMatch = /^\s*(\d{1,3})\s*(?:min(?:utes?)?)?\s*$/i.exec(text ?? '');
  if (!minutesMatch) return null;
  const minutes = Number(minutesMatch[1]);
  return minutes > 0 ? minutes : null;
}
