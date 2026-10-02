import "server-only";
import { prisma } from "@/server/db";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";
import type { QuizChoice } from "@/generated/prisma/enums";
import { cooldownRemainingMs, isQuizPassed, QUIZ_QUESTION_COUNT } from "./rules";

export class QuizError extends Error {}

// Vue élève d'une question : jamais la bonne réponse avant qu'il ait répondu.
export interface QuizQuestionView {
  position: number;
  question: string;
  answers: Record<QuizChoice, string>;
  answered: null | { selected: QuizChoice; correct: QuizChoice; isCorrect: boolean; explanation: string };
}

export interface QuizState {
  lessonId: string;
  lessonTitle: string;
  status: "READY" | "COOLDOWN" | "IN_PROGRESS" | "PASSED" | "NOT_READY";
  cooldownUntil: string | null;
  attemptCount: number;
  bestScore: number | null;
  lastResult: { score: number; passed: boolean } | null;
  questions: QuizQuestionView[]; // rempli seulement pendant une tentative
}

async function loadQuestions(lessonId: string) {
  return prisma.quizQuestion.findMany({ where: { lessonId }, orderBy: { position: "asc" } });
}

function toAnswers(q: { answerA: string; answerB: string; answerC: string; answerD: string }) {
  return { A: q.answerA, B: q.answerB, C: q.answerC, D: q.answerD };
}

export async function getQuizState(userId: string, lessonId: string, now = new Date()): Promise<QuizState> {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, title: true, type: true } });
  if (!lesson || lesson.type !== "UNDERSTANDING") throw new QuizError("QCM introuvable.");

  const [progress, attempts, questions] = [
    await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
    await prisma.quizAttempt.findMany({ where: { userId, lessonId }, orderBy: { startedAt: "desc" }, include: { answers: true } }),
    await loadQuestions(lessonId),
  ];
  const finished = attempts.filter((a) => a.completedAt);
  const last = finished[0];
  const base = {
    lessonId,
    lessonTitle: lesson.title,
    attemptCount: finished.length,
    bestScore: finished.reduce<number | null>((best, a) => Math.max(best ?? 0, a.score ?? 0), null),
    lastResult: last ? { score: last.score!, passed: last.passed! } : null,
    cooldownUntil: null,
    questions: [],
  };

  if (progress?.completedAt) return { ...base, status: "PASSED" };
  if (questions.length !== QUIZ_QUESTION_COUNT) return { ...base, status: "NOT_READY" };

  const open = attempts.find((a) => !a.completedAt);
  if (open) {
    const answered = new Map(open.answers.map((a) => [a.position, a]));
    return {
      ...base,
      status: "IN_PROGRESS",
      questions: questions.map((q) => {
        const a = answered.get(q.position);
        return {
          position: q.position,
          question: q.question,
          answers: toAnswers(q),
          answered: a
            ? { selected: a.selectedAnswer, correct: a.correctAnswer, isCorrect: a.isCorrect, explanation: q.explanation }
            : null,
        };
      }),
    };
  }

  const wait = cooldownRemainingMs(last && !last.passed ? last.completedAt : null, now);
  if (wait > 0) return { ...base, status: "COOLDOWN", cooldownUntil: new Date(now.getTime() + wait).toISOString() };
  return { ...base, status: "READY" };
}

export async function startQuizAttempt(userId: string, lessonId: string, now = new Date()) {
  await assertCanStartLesson(userId, lessonId);
  const state = await getQuizState(userId, lessonId, now);
  if (state.status === "IN_PROGRESS") return;
  if (state.status === "COOLDOWN") throw new QuizError("Retourne revoir le module sur Whop. Tu pourras réessayer dans quelques minutes.");
  if (state.status === "NOT_READY") throw new QuizError("Ce QCM n'est pas encore prêt.");
  if (state.status === "PASSED") throw new QuizError("Tu as déjà validé ce QCM.");
  try {
    await prisma.quizAttempt.create({ data: { userId, lessonId, totalQuestions: QUIZ_QUESTION_COUNT, startedAt: now } });
  } catch (e) {
    // Double clic : l'index unique garantit une seule tentative ouverte.
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
}

export interface AnswerResult {
  isCorrect: boolean;
  correct: QuizChoice;
  explanation: string;
  finished: null | { score: number; passed: boolean };
}

// Enregistre une réponse (définitive) et renvoie immédiatement la correction.
export async function answerQuizQuestion(
  userId: string,
  lessonId: string,
  position: number,
  selected: QuizChoice,
  now = new Date(),
): Promise<AnswerResult> {
  try {
    await assertCanStartLesson(userId, lessonId);
  } catch (e) {
    if (e instanceof LessonLockedError) throw new QuizError(e.message);
    throw e;
  }
  const attempt = await prisma.quizAttempt.findFirst({
    where: { userId, lessonId, completedAt: null },
    include: { answers: true },
  });
  if (!attempt) throw new QuizError("Aucune tentative en cours. Relance le QCM.");

  const question = await prisma.quizQuestion.findUnique({ where: { lessonId_position: { lessonId, position } } });
  if (!question) throw new QuizError("Question introuvable.");

  const already = attempt.answers.find((a) => a.position === position);
  if (already) throw new QuizError("Tu as déjà répondu à cette question.");

  const isCorrect = selected === question.correctAnswer;
  try {
    await prisma.quizAnswer.create({
      data: {
        attemptId: attempt.id,
        position,
        questionId: question.id,
        questionText: question.question,
        selectedAnswer: selected,
        correctAnswer: question.correctAnswer,
        isCorrect,
        answeredAt: now,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new QuizError("Tu as déjà répondu à cette question.");
    throw e;
  }

  const answeredCount = attempt.answers.length + 1;
  let finished: AnswerResult["finished"] = null;
  if (answeredCount >= attempt.totalQuestions) finished = await finishAttempt(attempt.id, userId, lessonId, now);
  return { isCorrect, correct: question.correctAnswer, explanation: question.explanation, finished };
}

async function finishAttempt(attemptId: string, userId: string, lessonId: string, now: Date) {
  const score = await prisma.quizAnswer.count({ where: { attemptId, isCorrect: true } });
  const passed = isQuizPassed(score);
  // Ne clôt qu'une fois, même si deux dernières réponses arrivent en même temps.
  const closed = await prisma.quizAttempt.updateMany({
    where: { id: attemptId, completedAt: null },
    data: { score, passed, completedAt: now },
  });
  if (closed.count === 0) {
    const a = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    return { score: a.score!, passed: a.passed! };
  }

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, attemptCount: 1, bestScore: score },
    update: { attemptCount: { increment: 1 } },
  });
  const progress = await prisma.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId, lessonId } } });
  if (progress.bestScore === null || score > progress.bestScore) {
    await prisma.lessonProgress.update({ where: { id: progress.id }, data: { bestScore: score } });
  }
  await prisma.auditLog.create({
    data: { actorUserId: userId, action: "QUIZ_SUBMITTED", entityType: "lesson", entityId: lessonId, metadata: { attemptId, score, passed } },
  });
  if (passed) await completeLesson(userId, lessonId, score, now);
  return { score, passed };
}

// --- Admin : saisie des 20 questions ---

export interface QuizQuestionInput {
  question: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: QuizChoice;
  explanation: string;
}

export async function getQuizForAdmin(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, title: true, type: true, module: { select: { title: true } } },
  });
  if (!lesson || lesson.type !== "UNDERSTANDING") return null;
  return { lesson, questions: await loadQuestions(lessonId) };
}

// Remplace les questions saisies (positions 1 à n). L'historique des élèves n'est pas touché (copie dans QuizAnswer).
export async function saveQuizQuestions(actorId: string, lessonId: string, questions: QuizQuestionInput[]) {
  if (questions.length > QUIZ_QUESTION_COUNT) throw new QuizError(`${QUIZ_QUESTION_COUNT} questions maximum.`);
  await prisma.$transaction(async (tx) => {
    for (const [i, q] of questions.entries()) {
      const position = i + 1;
      await tx.quizQuestion.upsert({
        where: { lessonId_position: { lessonId, position } },
        create: { lessonId, position, ...q },
        update: q,
      });
    }
    await tx.quizQuestion.deleteMany({ where: { lessonId, position: { gt: questions.length } } });
    await tx.auditLog.create({
      data: { actorUserId: actorId, action: "QUIZ_EDITED", entityType: "lesson", entityId: lessonId, metadata: { count: questions.length } },
    });
  });
}
