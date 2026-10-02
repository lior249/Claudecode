// Note sur 10 (pure, déterministe) : 10 − points perdus. L'IA ne décide jamais du statut.

export interface CriterionResult {
  name: string;
  maxPoints: number;
  pointsLost: number;
  comment: string;
  source: "MEASURE" | "AI";
}

export function computeScore(criteria: CriterionResult[], threshold: number) {
  const lost = criteria.reduce((sum, c) => sum + Math.min(Math.max(c.pointsLost, 0), Math.max(c.maxPoints, 0)), 0);
  const score = Math.round(Math.max(0, 10 - lost) * 10) / 10;
  return { score, passed: score >= threshold };
}
