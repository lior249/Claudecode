// Calendrier des événements : rappels, demande du planning, confirmation des lives de l'accompagnement.
// Toutes les heures sont en GMT.

import { REMINDERS } from './catalog.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Demande du planning : le dimanche, puis le lundi si tu n'as pas répondu.
export const PLANNING_DAYS = [0, 1];
export const PLANNING_HOURS = [9, 15, 18];

// Lives de l'accompagnement, chaque semaine : mercredi et vendredi à 22 h.
export const RECURRING_LIVES = [
  { weekday: 3, hour: 22 },
  { weekday: 5, hour: 22 },
];
// Le jour du live, PlugBot te demande s'il est maintenu à 9 h, puis relance à 12 h et 15 h.
export const CONFIRMATION_HOURS = [9, 12, 15];

function dayOf(timestamp) {
  return Math.floor(timestamp / DAY_MS);
}

function weekdayOf(day) {
  return new Date(day * DAY_MS).getUTCDay();
}

export function endOf(event) {
  return event.startAt + event.durationMin * 60 * 1000;
}

// Rappels à programmer pour un événement validé : ceux qui sont cochés et pas encore passés,
// plus le sondage d'avis à la fin du live. L'annonce (« creation ») part tout de suite, à part.
export function reminderSchedule(event, now) {
  const reminders = [];
  for (const kind of event.reminders) {
    const { offset } = REMINDERS[kind] ?? {};
    if (offset == null) continue;
    const sendAt = event.startAt - offset;
    if (sendAt > now) reminders.push({ kind, sendAt });
  }
  reminders.push({ kind: 'feedback', sendAt: endOf(event) });
  return reminders;
}

// Dernier créneau de demande du planning passé, ou null en dehors du dimanche et du lundi.
// week : le lundi (numéro de jour) de la semaine à planifier.
export function planningSlot(now) {
  const day = dayOf(now);
  const weekday = weekdayOf(day);
  if (!PLANNING_DAYS.includes(weekday)) return null;
  const hour = new Date(now).getUTCHours();
  const slotHour = PLANNING_HOURS.filter((h) => h <= hour).at(-1);
  if (slotHour === undefined) return null;
  return { week: weekday === 0 ? day + 1 : day, slot: day * DAY_MS + slotHour * HOUR_MS };
}

// Le live de l'accompagnement du jour, et le dernier créneau de question passé (ou null).
export function confirmationSlot(now) {
  const day = dayOf(now);
  const live = RECURRING_LIVES.find(({ weekday }) => weekday === weekdayOf(day));
  if (!live) return null;
  const liveAt = day * DAY_MS + live.hour * HOUR_MS;
  const hour = new Date(now).getUTCHours();
  const slotHour = CONFIRMATION_HOURS.filter((h) => h <= hour).at(-1);
  if (slotHour === undefined || now >= liveAt) return null;
  return { day, liveAt, slot: day * DAY_MS + slotHour * HOUR_MS };
}

// Les lives de l'accompagnement de la semaine qui commence le lundi `week`.
export function recurringLivesOfWeek(week) {
  return RECURRING_LIVES.map(({ weekday, hour }) => (week + ((weekday + 6) % 7)) * DAY_MS + hour * HOUR_MS);
}
