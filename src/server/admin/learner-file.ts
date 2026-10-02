import "server-only";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { formatDuration } from "@/server/learn/progression";
import { CATALOGS } from "@/server/decisions/catalog";
import type { CriterionResult } from "@/server/practice/scoring";

// Fiche Learn d'un élève : tout ce qu'un coach doit savoir avant de commencer le coaching.
// Lecture seule : consulter une fiche ne démarre jamais le chrono de l'élève.

export async function listLearners() {
  const learners = await prisma.user.findMany({
    where: { role: "LEARNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true, discordUsername: true, avatarUrl: true, status: true, coach: { select: { displayName: true } } },
  });
  const rows = [];
  for (const l of learners) {
    const { progression } = await getLearnerProgression(l.id, new Date(), { startClock: false });
    const current = progression.levels.flatMap((x) => x.modules.flatMap((m) => m.lessons)).find((x) => x.id === progression.currentLessonId);
    rows.push({
      ...l,
      coachName: l.coach?.displayName ?? null,
      percent: progression.percent,
      rank: progression.rank,
      currentLesson: current?.title ?? null,
      overdue: current?.overdue ?? false,
      lateCount: progression.lateRemarks.length,
      learnCompleted: progression.learnCompleted,
    });
  }
  return rows;
}

export async function getLearnerFile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { coach: { select: { displayName: true } } } });
  if (!user || user.role !== "LEARNER") return null;
  const { progression } = await getLearnerProgression(userId, new Date(), { startClock: false });

  const [progressRows, quizAttempts, submissions, decisions, launch] = [
    await prisma.lessonProgress.findMany({ where: { userId } }),
    await prisma.quizAttempt.findMany({ where: { userId, completedAt: { not: null } }, orderBy: { completedAt: "asc" } }),
    await prisma.submission.findMany({ where: { userId }, orderBy: { attemptNumber: "asc" } }),
    await prisma.decisionResponse.findMany({ where: { userId }, include: { catalogItem: { select: { catalog: true } } } }),
    await prisma.launchReport.findFirst({ where: { userId } }),
  ];
  const progressBy = new Map(progressRows.map((p) => [p.lessonId, p]));

  const lessons = progression.levels.flatMap((level) =>
    level.modules.flatMap((mod) =>
      mod.lessons.map((lesson) => {
        const p = progressBy.get(lesson.id);
        const quiz = quizAttempts.filter((a) => a.lessonId === lesson.id);
        const subs = submissions.filter((s) => s.lessonId === lesson.id);
        // Critères qui ont posé problème : nombre de tentatives où chacun a été raté.
        const missed = new Map<string, number>();
        for (const s of subs) {
          for (const c of (s.criteria as unknown as CriterionResult[] | null) ?? []) {
            if (c.misses > 0) missed.set(c.instruction, (missed.get(c.instruction) ?? 0) + 1);
          }
        }
        return {
          id: lesson.id,
          level: level.title,
          module: mod.title,
          title: lesson.title,
          type: lesson.type,
          status: lesson.status,
          unlockedAt: lesson.unlockedAt?.toISOString() ?? null,
          completedAt: lesson.completedAt?.toISOString() ?? null,
          duration: lesson.unlockedAt && lesson.completedAt ? formatDuration(lesson.completedAt.getTime() - lesson.unlockedAt.getTime()) : null,
          attempts: lesson.type === "UNDERSTANDING" ? quiz.length : lesson.type === "PRACTICE_AI" ? subs.length : (p?.attemptCount ?? 0),
          bestScore: p?.bestScore ?? null,
          scores: lesson.type === "UNDERSTANDING" ? quiz.map((a) => `${a.score}/20`) : subs.filter((s) => s.score !== null).map((s) => `${s.score}/10`),
          missedCriteria: [...missed.entries()].map(([instruction, count]) => ({ instruction, count })).sort((a, b) => b.count - a.count),
          waitingHuman: subs.some((s) => s.status === "PENDING_HUMAN"),
        };
      }),
    ),
  );

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      discordUsername: user.discordUsername,
      avatarUrl: user.avatarUrl,
      status: user.status,
      coachName: user.coach?.displayName ?? null,
      createdAt: user.createdAt.toISOString(),
      learnStartedAt: user.learnStartedAt?.toISOString() ?? null,
      learnCompletedAt: user.learnCompletedAt?.toISOString() ?? null,
      eliteGrantedAt: user.eliteGrantedAt?.toISOString() ?? null,
    },
    rank: progression.rank,
    percent: progression.percent,
    completedLessons: progression.completedLessons,
    totalLessons: progression.totalLessons,
    // Décrochages (plus de 24 h sur une leçon), affichés en rouge.
    lateRemarks: progression.lateRemarks.map((r) => ({
      text: r.previousLessonTitle
        ? `A décroché entre « ${r.previousModuleTitle} — ${r.previousLessonTitle} » et « ${r.moduleTitle} — ${r.lessonTitle} » pendant plus de 24 h`
        : `A mis plus de 24 h à commencer « ${r.moduleTitle} — ${r.lessonTitle} »`,
      duration: formatDuration(r.durationMs),
      from: r.unlockedAt.toISOString(),
      to: r.endedAt.toISOString(),
      ongoing: r.ongoing,
    })),
    lessons,
    decisions: decisions.map((d) => ({ catalog: CATALOGS[d.catalogItem.catalog].label, title: d.itemTitle, chosenAt: d.chosenAt.toISOString() })),
    launch: launch ? { submittedAt: launch.submittedAt.toISOString(), answers: launch.answers as { question: string; answer: string }[] } : null,
  };
}
export type LearnerFile = NonNullable<Awaited<ReturnType<typeof getLearnerFile>>>;
