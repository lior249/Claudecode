// Agenda des appels : réglages et règles pures (testées sans Netlify).

// Réglages à adapter. Les heures sont celles du fuseau `fuseau`.
export const AGENDA = {
  fuseau: "Africa/Lome",
  nomFuseau: "heure de Lomé",
  dureeMinutes: 30,
  joursAffiches: 14,
  delaiMinimumHeures: 3,
  // 0 = dimanche, 1 = lundi … 6 = samedi. Plages « HH:MM-HH:MM ».
  horaires: {
    1: ["10:00-12:00", "14:00-19:00"],
    2: ["10:00-12:00", "14:00-19:00"],
    3: ["10:00-12:00", "14:00-19:00"],
    4: ["10:00-12:00", "14:00-19:00"],
    5: ["10:00-12:00", "14:00-19:00"],
    6: ["10:00-13:00"],
  },
};

// Heure murale d'un instant dans un fuseau, en millisecondes « comme si c'était UTC ».
function wallMs(t, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
}

// « 2026-10-12 », « 14:30 » dans un fuseau → instant UTC.
export function zonedToUtc(day, time, tz) {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - (wallMs(guess, tz) - guess);
  t = guess - (wallMs(t, tz) - t);
  return new Date(t);
}

const addDays = (day, n) => {
  const x = new Date(`${day}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
const localDay = (t, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Tous les débuts de créneaux à venir (ISO UTC), dans l'ordre, sans tenir compte des réservations.
export function creneauxAVenir(now, agenda = AGENDA) {
  const first = new Date(now.getTime() + agenda.delaiMinimumHeures * 3600_000);
  const today = localDay(now, agenda.fuseau);
  const out = [];
  for (let i = 0; i < agenda.joursAffiches; i++) {
    const day = addDays(today, i);
    for (const plage of agenda.horaires[weekdayOf(day)] ?? []) {
      const [debut, fin] = plage.split("-").map(toMinutes);
      for (let m = debut; m + agenda.dureeMinutes <= fin; m += agenda.dureeMinutes) {
        const start = zonedToUtc(day, toHhmm(m), agenda.fuseau);
        if (start >= first) out.push(start.toISOString());
      }
    }
  }
  return out;
}

// Clé de stockage d'un créneau (pas de « : » ni de « . » dans les clés).
export const cleCreneau = (iso) => `creneaux/${iso.replace(/[:.]/g, "-")}`;

// « lundi 13 octobre à 10 h 00 »
export function libelleCreneau(iso, tz = AGENDA.fuseau) {
  const t = new Date(iso);
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(t);
  const [h, m] = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t).split(":");
  return `${jour} à ${Number(h)} h ${m}`;
}

// Pseudo Instagram : accepte « @pseudo », « pseudo » ou un lien de profil.
export function pseudoInstagram(brut) {
  let v = String(brut ?? "").trim();
  const lien = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (lien) v = lien[1];
  v = v.replace(/^@+/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

// Vérifie le formulaire. Renvoie { erreur } ou { nom, instagram, creneau }.
export function lireReservation(corps, creneauxLibres) {
  if (!corps || typeof corps !== "object") return { erreur: "Demande invalide." };
  const nom = String(corps.nom ?? "").replace(/\s+/g, " ").trim();
  if (nom.length < 2 || nom.length > 60) return { erreur: "Indique ton nom (2 à 60 caractères)." };
  const instagram = pseudoInstagram(corps.instagram);
  if (!instagram) return { erreur: "Indique ton pseudo Instagram, par exemple @tonpseudo." };
  const creneau = String(corps.creneau ?? "");
  if (!creneauxLibres.includes(creneau)) return { erreur: "Ce créneau n'est plus disponible. Choisis-en un autre." };
  return { nom, instagram, creneau };
}

// Empêche le nom de casser la mise en forme du message Discord.
const echapper = (s) => s.replace(/([\\*_~`|>#\[\]()-])/g, "\\$1");

export function messageDiscord({ nom, instagram, creneau }, agenda = AGENDA) {
  return [
    "**Nouvelle réservation d'appel**",
    `Nom : ${echapper(nom)}`,
    `Instagram : @${echapper(instagram)} — <https://www.instagram.com/${instagram}/>`,
    `Appel : ${libelleCreneau(creneau, agenda.fuseau)} (${agenda.nomFuseau}), ${agenda.dureeMinutes} min`,
  ].join("\n");
}
