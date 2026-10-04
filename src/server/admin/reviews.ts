import "server-only";
import { prisma } from "@/server/db";
import { completeLesson } from "@/server/learn/service";
import { notify } from "@/server/notifications/service";
import { computeScore, pointsLost, type CriterionResult } from "@/server/practice/scoring";
import type { PracticeCriterion } from "@/server/practice/config";

// Correction à la main des exercices pratiques (admin ou coach) : le correcteur compte les erreurs par critère,
// le serveur calcule la note (8/10 pour valider).

export class ReviewError extends Error {}

export async function listPendingReviews() {
  const subs = await prisma.submission.findMany({
    where: { status: "PENDING_HUMAN" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { displayName: true } }, lesson: { select: { title: true, module: { select: { title: true } } } } },
  });
  return subs.map((s) => ({
    id: s.id,
    learner: s.user.displayName,
    lesson: s.lesson.title,
    module: s.lesson.module.title,
    attemptNumber: s.attemptNumber,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function getReview(id: string) {
  const s = await prisma.submission.findUnique({
    where: { id },
    include: {
      user: { select: { displayName: true } },
      lesson: { select: { title: true, summary: true, config: true, module: { select: { title: true } } } },
      assets: { where: { deletedAt: null }, select: { id: true, kind: true, mimeType: true, originalName: true, durationSeconds: true } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    status: s.status,
    learner: s.user.displayName,
    lesson: s.lesson.title,
    module: s.lesson.module.title,
    summary: s.lesson.summary,
    attemptNumber: s.attemptNumber,
    createdAt: s.createdAt.toISOString(),
    text: s.text,
    threshold: s.threshold,
    score: s.score,
    feedback: s.feedback,
    criteria: (s.criteriaSnapshot as unknown as PracticeCriterion[] | null) ?? [],
    results: (s.criteria as unknown as CriterionResult[] | null) ?? [],
    assets: s.assets.map((a) => ({ ...a, url: `/api/admin/assets/${a.id}` })),
    reviewComment: s.reviewComment,
  };
}

export interface Grade {
  criterionId: string;
  misses: number;
  comment: string;
}

export async function gradeSubmission(grader: { id: string; role: string }, id: string, grades: Grade[], feedback: string) {
  if (grader.role !== "ADMIN" && grader.role !== "COACH") throw new ReviewError("Soumission introuvable.");
  const s = await prisma.submission.findUnique({ where: { id }, include: { lesson: true } });
  if (!s || s.status !== "PENDING_HUMAN") throw new ReviewError("Cette réalisation a déjà été corrigée.");
  const criteria = (s.criteriaSnapshot as unknown as PracticeCriterion[] | null) ?? [];
  const results: CriterionResult[] = criteria.map((c) => {
    const g = grades.find((x) => x.criterionId === c.id);
    if (!g || !Number.isInteger(g.misses) || g.misses < 0 || g.misses > 100) throw new ReviewError("Indique le nombre d'erreurs pour chaque critère (0 si tout est bon).");
    return { criterionId: c.id, instruction: c.instruction, pointsPerMiss: c.pointsPerMiss, misses: g.misses, pointsLost: pointsLost(g.misses, c.pointsPerMiss), evidence: [], comment: g.comment.trim() };
  });
  const { score, passed } = computeScore(results, s.threshold);
  if (!passed && !feedback.trim() && !results.some((r) => r.comment)) throw new ReviewError("Explique à l'élève ce qu'il doit corriger.");
  const updated = await prisma.submission.updateMany({
    where: { id, status: "PENDING_HUMAN" },
    data: {
      status: passed ? "PASSED" : "FAILED",
      score,
      criteria: results as unknown as object[],
      feedback: feedback.trim() || null,
      processedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: grader.id,
    },
  });
  if (!updated.count) throw new ReviewError("Cette réalisation vient d'être corrigée.");
  await prisma.auditLog.create({
    data: { actorUserId: grader.id, action: passed ? "SUBMISSION_APPROVED" : "SUBMISSION_REJECTED", entityType: "submission", entityId: id, metadata: { score } },
  });
  if (passed) {
    await completeLesson(s.userId, s.lessonId, score);
    const progress = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: s.userId, lessonId: s.lessonId } } });
    if (progress && (progress.bestScore === null || score > progress.bestScore)) await prisma.lessonProgress.update({ where: { id: progress.id }, data: { bestScore: score } });
  }
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  await notify(s.userId, {
    kind: "learn.result",
    href: `/learn/practice/${s.lessonId}`,
    mood: passed ? "content" : "ko",
    text: passed
      ? `« ${s.lesson.title} » validé avec ${fmt(score)}/10. La suite est débloquée !`
      : `« ${s.lesson.title} » : ${fmt(score)}/10. Il faut ${fmt(s.threshold)}/10. Regarde la correction sur Creato et renvoie une nouvelle réalisation.`,
  });
  return { score, passed };
}
