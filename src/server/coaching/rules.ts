// Règles du coaching (pures, sans base de données). Voir docs/DECISIONS.md § Espace coaching.

export const MAX_OPEN_LEARNER_TICKETS = 3;
export const RESPONSE_DEADLINE_MS = 12 * 3_600_000; // 12 h en continu
export const FAST_ANSWER_MS = 3_600_000; // réponse en moins d'1 h
export const COACH_REMINDERS_LEFT_MS = [4 * 3_600_000, 2 * 3_600_000];
export const FOLLOW_UP_HOURS = [24, 48, 72, 120] as const;
export const ABSENCE_DAYS = 7;
export const ABSENCE_WARNING_DAYS = [4, 6];
export const MIN_STARS = 1;
export const MAX_STARS = 6;
export const FAST_ANSWERS_PER_STAR = 10;
export const LATE_ANSWERS_PER_STAR = 5;

// ---------- Liens TikTok ----------

// L'identifiant d'une vidéo TikTok contient sa date de publication (les 32 premiers bits = secondes Unix).
export function parseTikTokUrl(raw: string): { username: string; videoId: string; postedAt: Date } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?tiktok\.com$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/@([\w.]{2,24})\/(?:video|photo)\/(\d{15,20})\/?$/);
  if (!m) return null;
  const seconds = Number(BigInt(m[2]) >> BigInt(32));
  return { username: m[1].toLowerCase(), videoId: m[2], postedAt: new Date(seconds * 1000) };
}

export function normalizeTikTokUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

// ---------- Dates locales (fuseau de l'élève) ----------

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localDate(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000);
}

// ---------- Streak (au moins 1 post par jour, gel 1 jour par mois) ----------

export interface StreakResult {
  current: number;
  best: number;
  points: number; // +1 par semaine complète, +3 à 30 jours, +10 à 100 jours
  frozenDays: string[];
  todayDone: boolean;
  flame: 0 | 1 | 2 | 3 | 4;
}

export function flameLevel(current: number): StreakResult["flame"] {
  if (current >= 100) return 4;
  if (current >= 30) return 3;
  if (current >= 7) return 2;
  if (current >= 1) return 1;
  return 0;
}

export function computeStreak(postDays: Iterable<string>, startDay: string, today: string, freezesPerMonth = 1): StreakResult {
  const posted = new Set(postDays);
  const frozenUsed = new Map<string, number>();
  const frozenDays: string[] = [];
  let current = 0;
  let best = 0;
  let points = 0;
  const grow = () => {
    current++;
    best = Math.max(best, current);
    if (current % 7 === 0) points += 1;
    if (current === 30) points += 3;
    if (current === 100) points += 10;
  };
  if (startDay > today) return { current: 0, best: 0, points: 0, frozenDays, todayDone: false, flame: 0 };
  for (let day = startDay; day <= today; day = addDays(day, 1)) {
    if (posted.has(day)) grow();
    else if (day === today) break; // la journée n'est pas finie : la chaîne tient encore
    else {
      const month = day.slice(0, 7);
      if (current > 0 && (frozenUsed.get(month) ?? 0) < freezesPerMonth) {
        frozenUsed.set(month, (frozenUsed.get(month) ?? 0) + 1);
        frozenDays.push(day);
        grow();
      } else current = 0;
    }
  }
  return { current, best, points, frozenDays, todayDone: posted.has(today), flame: flameLevel(current) };
}

// ---------- Grille de régularité (style GitHub) ----------

export type DayState = "posted" | "frozen" | "missed" | "before" | "future";
export interface ActivityGrid {
  weeks: { day: string; state: DayState }[][]; // colonnes = semaines (lundi → dimanche)
  percent: number; // jours postés / jours écoulés depuis le début du coaching (sur la période affichée)
  thisWeek: DayState[]; // lundi → dimanche de la semaine en cours
}

const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi

export function activityGrid(postDays: Iterable<string>, frozenDays: Iterable<string>, startDay: string, today: string, weeks = 18): ActivityGrid {
  const posted = new Set(postDays);
  const frozen = new Set(frozenDays);
  const firstMonday = addDays(addDays(today, -weekday(today)), -7 * (weeks - 1));
  const state = (day: string): DayState =>
    day > today ? "future" : day < startDay ? "before" : posted.has(day) ? "posted" : frozen.has(day) ? "frozen" : "missed";
  const cols: { day: string; state: DayState }[][] = [];
  let done = 0;
  let elapsed = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(firstMonday, w * 7 + d);
      const st = state(day);
      // Aujourd'hui compte seulement s'il est déjà posté (la journée n'est pas finie).
      if (st === "posted") {
        done++;
        elapsed++;
      } else if (st === "frozen" || (st === "missed" && day !== today)) elapsed++;
      col.push({ day, state: st });
    }
    cols.push(col);
  }
  return { weeks: cols, percent: elapsed ? Math.round((done / elapsed) * 100) : 0, thisWeek: cols[cols.length - 1].map((c) => c.state) };
}

// ---------- Qualité : points par vidéo selon les vues ----------

export function viewPoints(views: number) {
  if (views >= 1_000_000) return 5;
  if (views >= 500_000) return 4;
  if (views >= 300_000) return 3;
  if (views >= 100_000) return 2;
  if (views >= 10_000) return 1;
  return 0;
}

// ---------- Rangs ----------

export const RANKS = ["E", "D", "C", "B", "A", "S", "SS", "SSS"] as const;
export type AnyRank = (typeof RANKS)[number];

export function maxRank(a: AnyRank | null | undefined, b: AnyRank | null | undefined): AnyRank | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return RANKS.indexOf(a) >= RANKS.indexOf(b) ? a : b;
}

// Résultats d'un seul mois : S = 100 €, SS = 500 €, SSS = 1 000 € (fin du coaching).
export function rankFromMonthlyAmount(eur: number): "S" | "SS" | "SSS" | null {
  if (eur >= 1000) return "SSS";
  if (eur >= 500) return "SS";
  if (eur >= 100) return "S";
  return null;
}

export const FOLLOWERS_FOR_A = 10_000;

// Fenêtre des résultats du mois : du dernier jour du mois au 5 du mois suivant (dates locales).
export function monthlyWindow(today: string): { open: boolean; month: string | null } {
  const [y, m, d] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d === lastDay) return { open: true, month: today.slice(0, 7) };
  if (d <= 5) {
    const prev = new Date(Date.UTC(y, m - 2, 1));
    return { open: true, month: prev.toISOString().slice(0, 7) };
  }
  return { open: false, month: null };
}

// ---------- Étoiles des coachs ----------

export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const clampStars = (n: number) => Math.min(MAX_STARS, Math.max(MIN_STARS, n));

// ---------- Questions de suivi prédéfinies (tickets ouverts par le coach) ----------

export const FOLLOW_UP_TEMPLATES = [
  { key: "account_screenshot", subject: "Capture de ton compte", body: "Tu peux m'envoyer une capture d'écran récente de ton compte TikTok (avec ton nom d'utilisateur visible) ?" },
  { key: "problems", subject: "Des difficultés ?", body: "Tu as rencontré des problèmes récemment ? Si oui, raconte-moi : on va trouver une solution ensemble." },
  { key: "satisfaction", subject: "Ton avis sur le coaching", body: "Est-ce que mon coaching te satisfait ? Tu as des remarques ou des choses à améliorer ?" },
  { key: "best_video", subject: "Ta meilleure vidéo", body: "Envoie-moi le lien de ta meilleure vidéo de la semaine et explique-moi pourquoi elle a marché selon toi." },
  { key: "worst_video", subject: "Ta vidéo la moins vue", body: "Envoie-moi le lien de ta vidéo qui a le moins marché cette semaine. On l'analyse ensemble." },
  { key: "next_week", subject: "Ton objectif de la semaine", body: "Quel est ton objectif pour cette semaine (nombre de posts, vues, abonnés) ?" },
  { key: "routine", subject: "Ta routine", body: "Comment s'organise ta journée pour créer tes vidéos ? Combien de temps tu y passes ?" },
  { key: "niche", subject: "Ta niche", body: "Tu te sens toujours bien dans ta niche ? Tu as remarqué des formats qui marchent mieux que d'autres ?" },
] as const;
