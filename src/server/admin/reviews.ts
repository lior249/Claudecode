import "server-only";
import { prisma } from "@/server/db";
import { completeLesson } from "@/server/learn/service";
import { notify } from "@/server/notifications/service";
import type { CriterionResult } from "@/server/practice/scoring";
import type { AnalysisReport } from "@/server/ai/types";

// Validations humaines : soumissions dont l'élève a « fait appel à un humain » après 3 pannes.

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
    lastError: s.lastError,
    technicalFailures: s.technicalFailures,
    criteria: (s.criteriaSnapshot as unknown as { instruction: string; pointsPerMiss: number }[] | null) ?? [],
    results: (s.criteria as unknown as CriterionResult[] | null) ?? [],
    analysis: (s.analysis as unknown as AnalysisReport | null) ?? null,
    assets: s.assets.map((a) => ({ ...a, url: `/api/admin/assets/${a.id}` })),
    reviewComment: s.reviewComment,
  };
}

export async function decideReview(adminId: string, id: string, decision: "APPROVE" | "REJECT", comment: string) {
  const s = await prisma.submission.findUnique({ where: { id }, include: { lesson: true } });
  if (!s || s.status !== "PENDING_HUMAN") throw new ReviewError("Cette soumission n'attend plus de validation.");
  if (decision === "REJECT" && !comment.trim()) throw new ReviewError("Explique à l'élève ce qu'il doit corriger.");

  const updated = await prisma.submission.updateMany({
    where: { id, status: "PENDING_HUMAN" },
    data: {
      status: decision === "APPROVE" ? "HUMAN_APPROVED" : "HUMAN_REJECTED",
      reviewComment: comment.trim() || null,
      reviewedAt: new Date(),
      reviewedById: adminId,
    },
  });
  if (!updated.count) throw new ReviewError("Cette soumission vient d'être traitée.");
  await prisma.auditLog.create({
    data: { actorUserId: adminId, action: decision === "APPROVE" ? "SUBMISSION_APPROVED" : "SUBMISSION_REJECTED", entityType: "submission", entityId: id },
  });
  if (decision === "APPROVE") await completeLesson(s.userId, s.lessonId, null);
  await notify(s.userId, { kind: "learn.review", href: "/learn", text: decision === "APPROVE"
      ? `✅ Un coach a validé « ${s.lesson.title} ». La suite est débloquée !`
      : `❌ Un coach a examiné « ${s.lesson.title} » : ${comment.trim()} Renvoie une nouvelle réalisation sur Creato.` });
}
