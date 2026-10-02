// Note sur 10 (pure, déterministe). L'agent compte les erreurs ; le serveur calcule les points et le statut.

export interface CriterionResult {
  criterionId: string;
  instruction: string;
  pointsPerMiss: number;
  misses: number; // nombre de fois où le critère n'est pas respecté
  pointsLost: number; // misses × pointsPerMiss (calculé ici, jamais par l'IA)
  evidence: { time: number | null; detail: string }[];
  comment: string;
}

export function pointsLost(misses: number, pointsPerMiss: number) {
  return Math.max(0, Math.floor(misses)) * pointsPerMiss;
}

export function computeScore(criteria: Pick<CriterionResult, "pointsLost">[], threshold: number) {
  const lost = criteria.reduce((sum, c) => sum + Math.max(0, c.pointsLost), 0);
  const score = Math.round(Math.max(0, 10 - lost) * 10) / 10;
  return { score, passed: score >= threshold };
}
