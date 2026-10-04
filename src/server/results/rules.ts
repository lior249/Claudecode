// Règles pures des résultats : points, paliers, code du jour, rangs spéciaux (testées sans base de données).
import { createHmac } from "node:crypto";
import { FOLLOWERS_FOR_A, rankFromMonthlyAmount } from "@/server/coaching/rules";

import type { Metric, Special } from "./labels";
export { METRIC_LABELS, type Metric, type Special, type Tier } from "./labels";

export const MAX_POSTS_PER_DAY = 2;

// Paliers propres : chiffres entiers positifs, triés, sans doublon de seuil.
export function parseTiers(raw: unknown): { min: number; points: number }[] {
  if (!Array.isArray(raw)) return [];
  const tiers = raw
    .map((t) => ({ min: Number((t as { min?: unknown })?.min), points: Number((t as { points?: unknown })?.points) }))
    .filter((t) => Number.isInteger(t.min) && t.min >= 0 && Number.isInteger(t.points) && t.points >= 0);
  const byMin = new Map(tiers.map((t) => [t.min, t]));
  return [...byMin.values()].sort((a, b) => a.min - b.min);
}

/** Points d'un résultat : paliers sur le chiffre lu s'il y en a, sinon points fixes. */
export function resultPoints(type: { points: number; metric: Metric; tiers: unknown }, metricValue: number | null) {
  const tiers = parseTiers(type.tiers);
  if (type.metric === "NONE" || tiers.length === 0) return Math.max(0, type.points);
  if (metricValue === null) return 0;
  let points = 0;
  for (const t of tiers) if (metricValue >= t.min) points = t.points;
  return points;
}

/** Un même résultat (même identifiant) ne rapporte qu'une fois : seule la différence avec le meilleur précédent compte. */
export const pointsGained = (points: number, previousBest: number) => Math.max(0, points - previousBest);

/** Code du jour à écrire sur la capture : propre à chaque membre et à chaque jour (fuseau du membre). */
export function dailyCode(secret: string, userId: string, day: string) {
  const n = createHmac("sha256", secret).update(`${userId}:${day}`).digest().readUInt32BE(0) % 10_000;
  return `CR-${String(n).padStart(4, "0")}`;
}

/** Rang débloqué par un type spécial (null si aucun). */
export function specialRank(special: Special, metricValue: number | null) {
  if (metricValue === null) return null;
  if (special === "FOLLOWERS_RANK") return metricValue >= FOLLOWERS_FOR_A ? ("A" as const) : null;
  if (special === "MONTHLY_REVENUE") return rankFromMonthlyAmount(metricValue);
  return null;
}

/** Normalise l'identifiant lu (espaces, casse) pour comparer deux captures d'un même résultat. */
export const normalizeIdentifier = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim() || null;
