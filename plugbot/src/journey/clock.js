// L'heure locale des membres : chacun choisit le pays où il vit, et ses horaires sont dans son heure locale.

import { COUNTRIES, offsetAt } from '../events/zones.js';

const HOUR_MS = 60 * 60 * 1000;

// Les pays proposés : [drapeau, nom, fuseau horaire]. Le nom est la valeur enregistrée.
export const HOME_COUNTRIES = COUNTRIES;

export function timeZoneOf(country) {
  return HOME_COUNTRIES.find(([, name]) => name === country)?.[2] ?? 'UTC';
}

export function countryLabel(country) {
  const found = HOME_COUNTRIES.find(([, name]) => name === country);
  return found ? `${found[0]} ${found[1]}` : country;
}

// La date locale (« 2026-11-05 »), le jour de la semaine (0 = dimanche) et l'heure, dans `timeZone`.
export function localClock(timestamp, timeZone) {
  const date = new Date(timestamp + offsetAt(timestamp, timeZone));
  return {
    day: date.toISOString().slice(0, 10),
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

// L'instant (en temps universel) où il est `hour` heures le jour local `day`, dans `timeZone`.
export function atLocal(day, hour, timeZone) {
  const naive = Date.parse(`${day}T00:00:00Z`) + hour * HOUR_MS;
  const guess = naive - offsetAt(naive, timeZone);
  return naive - offsetAt(guess, timeZone);
}

// Le jour local suivant : « 2026-11-05 » → « 2026-11-06 ».
export function nextDay(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);
}

// « 12 h »
export function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')} h`;
}
