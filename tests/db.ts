import { prisma } from "@/server/db";
import type { LessonType } from "@/generated/prisma/enums";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "ReactivationRequest", "RankProof", "ViewProof", "Post", "CoachStarEvent", "ResponseWait", "TicketMessage", "Ticket", "Reminder", "LaunchReport", "DecisionResponse", "CatalogItem", "Job", "Asset", "Submission", "QuizAnswer", "QuizAttempt", "QuizQuestion", "AuditLog", "Session", "LessonProgress", "Lesson", "Module", "Level", "User" CASCADE',
  );
}

// Petit parcours : niveau 1 > module 1 > [types...]
export async function seedCourse(types: LessonType[]) {
  const level = await prisma.level.create({ data: { title: "Niveau", position: 1 } });
  const mod = await prisma.module.create({ data: { levelId: level.id, title: "Module", position: 1 } });
  const lessons = [];
  for (const [i, type] of types.entries()) {
    lessons.push(await prisma.lesson.create({ data: { moduleId: mod.id, title: `Leçon ${i + 1}`, type, position: i + 1 } }));
  }
  const learner = await prisma.user.create({ data: { displayName: "Élève", role: "LEARNER" } });
  return { level, mod, lessons, learner };
}

export async function seedQuestions(lessonId: string, count = 20) {
  for (let position = 1; position <= count; position++) {
    await prisma.quizQuestion.create({
      data: {
        lessonId, position, question: `Q${position}`, answerA: "a", answerB: "b", answerC: "c", answerD: "d",
        correctAnswer: "A", explanation: `Explication ${position}`,
      },
    });
  }
}
