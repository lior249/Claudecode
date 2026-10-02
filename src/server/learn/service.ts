import "server-only";
import { notify } from "@/server/notifications/service";
import { prisma } from "@/server/db";
import { computeProgression, type Progression } from "./progression";
import type { ManualRank } from "@/generated/prisma/enums";

// Parcours publié, dans l'ordre. Les champs sensibles (config, whopUrl) ne sont pas chargés ici.
export async function loadCurriculum() {
  return prisma.level.findMany({
    where: { isPublished: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      modules: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, summary: true, type: true, position: true },
          },
        },
      },
    },
  });
}

export async function getLearnerProgression(userId: string, now = new Date(), opts: { startClock?: boolean } = {}) {
  // Le chrono du Learn démarre à la première visite de l'élève (jamais quand un admin consulte sa fiche).
  let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.learnStartedAt && opts.startClock !== false) {
    user = await prisma.user.update({ where: { id: userId }, data: { learnStartedAt: now } });
  }

  const [curriculum, completions] = [
    await loadCurriculum(),
    await prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { lessonId: true, completedAt: true },
    }),
  ];

  const progression = computeProgression({
    levels: curriculum,
    completions: completions.map((c) => ({ lessonId: c.lessonId, completedAt: c.completedAt! })),
    learnStartedAt: user.learnStartedAt,
    manualRank: user.manualRank as ManualRank | null,
    now,
  });

  return { user, curriculum, progression };
}

// Liens Whop des modules débloqués uniquement : un lien verrouillé ne quitte jamais le serveur.
export async function getUnlockedWhopLinks(progression: Progression) {
  const unlocked = progression.levels.flatMap((l) => l.modules).filter((m) => m.status !== "LOCKED").map((m) => m.id);
  const rows = await prisma.module.findMany({
    where: { id: { in: unlocked }, whopUrl: { not: null } },
    select: { id: true, whopUrl: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, r.whopUrl!]));
}

// Revérifie côté serveur que la leçon est bien la leçon en cours (ou déjà validée).
export async function assertCanStartLesson(userId: string, lessonId: string) {
  const { progression } = await getLearnerProgression(userId);
  if (progression.currentLessonId !== lessonId) {
    throw new LessonLockedError();
  }
  return progression;
}

export class LessonLockedError extends Error {
  constructor() {
    super("Cette leçon n'est pas encore disponible.");
  }
}

// Validation d'une leçon : idempotente, jamais annulée.
export async function completeLesson(userId: string, lessonId: string, score: number | null, now = new Date()) {
  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  if (existing?.completedAt) return existing;
  const row = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, attemptCount: 1, bestScore: score, completedAt: now },
    update: {
      completedAt: now,
      bestScore: score === null ? existing?.bestScore : Math.max(score, existing?.bestScore ?? score),
    },
  });
  await prisma.auditLog.create({
    data: { actorUserId: userId, action: "LESSON_COMPLETED", entityType: "lesson", entityId: lessonId, metadata: { score } },
  });

  const { progression } = await getLearnerProgression(userId, now);
  if (progression.learnCompleted) {
    await prisma.user.updateMany({ where: { id: userId, learnCompletedAt: null }, data: { learnCompletedAt: now } });
  }
  await celebrate(userId, lessonId, progression);
  return row;
}

// Fêter la fin d'un module ou d'un niveau (une seule fois chacun).
async function celebrate(userId: string, lessonId: string, progression: Awaited<ReturnType<typeof getLearnerProgression>>["progression"]) {
  const level = progression.levels.find((l) => l.modules.some((m) => m.lessons.some((x) => x.id === lessonId)));
  const mod = level?.modules.find((m) => m.lessons.some((x) => x.id === lessonId));
  if (!level || !mod || progression.learnCompleted) return;
  if (level.status === "COMPLETED") {
    await notify(userId, {
      kind: "learn.level",
      href: "/learn",
      onceKey: `level-done:${level.id}`,
      text: `🏅 Niveau « ${level.title} » terminé ! ${progression.percent} % du parcours. Le niveau suivant est ouvert.`,
    });
  } else if (mod.status === "COMPLETED") {
    await notify(userId, { kind: "learn.module", href: "/learn", onceKey: `module-done:${mod.id}`, text: `🎉 Module « ${mod.title} » terminé ! Tu en es à ${progression.percent} %.` });
  }
}
