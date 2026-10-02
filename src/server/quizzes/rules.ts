// Règles du QCM (pures). Voir docs/DECISIONS.md § Compréhension.
export const QUIZ_QUESTION_COUNT = 20;
export const QUIZ_PASS_SCORE = 16; // 16/20 minimum
export const QUIZ_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes après un échec

export const isQuizPassed = (score: number) => score >= QUIZ_PASS_SCORE;

// Temps d'attente restant avant une nouvelle tentative (0 = possible tout de suite).
export function cooldownRemainingMs(lastFailedAt: Date | null, now: Date) {
  if (!lastFailedAt) return 0;
  return Math.max(0, lastFailedAt.getTime() + QUIZ_COOLDOWN_MS - now.getTime());
}
