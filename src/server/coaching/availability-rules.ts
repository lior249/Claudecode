// Règles pures des disponibilités des coachs (testées sans base de données).
// Le coach saisit ses créneaux dans son fuseau ; chaque élève les voit dans le sien.

export interface Slot {
  weekday: number; // 0 = lundi … 6 = dimanche
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const MAX_SLOTS_PER_DAY = 3;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateSlots(slots: Slot[]): string | null {
  for (const s of slots) {
    if (!Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6) return "Jour invalide.";
    if (!TIME.test(s.start) || !TIME.test(s.end)) return "Heure invalide (format 21:00).";
    if (s.start >= s.end) return `${WEEKDAYS[s.weekday]} : l'heure de fin doit être après l'heure de début.`;
  }
  for (let d = 0; d < 7; d++) {
    const day = slots.filter((s) => s.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
    if (day.length > MAX_SLOTS_PER_DAY) return `${WEEKDAYS[d]} : ${MAX_SLOTS_PER_DAY} créneaux au maximum.`;
    for (let i = 1; i < day.length; i++) if (day[i].start < day[i - 1].end) return `${WEEKDAYS[d]} : deux créneaux se chevauchent.`;
  }
  return null;
}

// Heure murale d'un instant dans un fuseau, en millisecondes « comme si c'était UTC ».
function wallMs(t: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

// « 2026-10-05 21:00 à Paris » → instant UTC.
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - (wallMs(guess, tz) - guess);
  t = guess - (wallMs(t, tz) - t);
  return new Date(t);
}

const addDays = (day: string, n: number) => {
  const x = new Date(`${day}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const weekdayOf = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
const localDay = (t: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);

export interface Occurrence {
  start: Date;
  end: Date;
}

// Prochaine occurrence de chaque créneau (dans les 7 jours, aujourd'hui compris si le créneau n'est pas fini).
export function nextOccurrences(slots: Slot[], coachTz: string, now: Date): Occurrence[] {
  const today = localDay(now, coachTz);
  return slots
    .map((s) => {
      let day = addDays(today, (s.weekday - weekdayOf(today) + 7) % 7);
      let end = zonedToUtc(day, s.end, coachTz);
      if (end <= now) {
        day = addDays(day, 7);
        end = zonedToUtc(day, s.end, coachTz);
      }
      return { start: zonedToUtc(day, s.start, coachTz), end };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

// « Lundi 21:00–23:00 » dans le fuseau de la personne qui lit.
export function formatOccurrence(o: Occurrence, tz: string) {
  const time = (t: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
  const day = WEEKDAYS[weekdayOf(localDay(o.start, tz))];
  return `${day} ${time(o.start)}–${time(o.end)}`;
}
