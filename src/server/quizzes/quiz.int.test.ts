import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDb, seedCourse, seedQuestions } from "../../../tests/db";
import { answerQuizQuestion, getQuizState, QuizError, saveQuizQuestions, startQuizAttempt } from "./service";
import { getLearnerProgression } from "@/server/learn/service";

const t0 = new Date("2026-10-02T10:00:00Z");
const plus = (min: number) => new Date(t0.getTime() + min * 60000);

async function play(userId: string, lessonId: string, correct: number, at = t0) {
  await startQuizAttempt(userId, lessonId, at);
  let last;
  for (let p = 1; p <= 20; p++) last = await answerQuizQuestion(userId, lessonId, p, p <= correct ? "A" : "B", at);
  return last!;
}

describe("QCM (Compréhension)", () => {
  beforeEach(resetDb);

  it("16/20 valide la leçon et débloque la suivante", async () => {
    const { lessons, learner } = await seedCourse(["UNDERSTANDING", "PRACTICE_AI"]);
    await seedQuestions(lessons[0].id);
    const res = await play(learner.id, lessons[0].id, 16);
    expect(res.finished).toEqual({ score: 16, passed: true });
    const { progression } = await getLearnerProgression(learner.id);
    expect(progression.currentLessonId).toBe(lessons[1].id);
    expect((await getQuizState(learner.id, lessons[0].id)).status).toBe("PASSED");
  });

  it("15/20 échoue, impose 5 minutes d'attente, puis permet de réessayer ; 20/20 valide", async () => {
    const { lessons, learner } = await seedCourse(["UNDERSTANDING"]);
    await seedQuestions(lessons[0].id);
    expect((await play(learner.id, lessons[0].id, 15)).finished).toEqual({ score: 15, passed: false });

    const waiting = await getQuizState(learner.id, lessons[0].id, plus(4));
    expect(waiting.status).toBe("COOLDOWN");
    await expect(startQuizAttempt(learner.id, lessons[0].id, plus(4))).rejects.toThrow(QuizError);

    expect((await getQuizState(learner.id, lessons[0].id, plus(5))).status).toBe("READY");
    expect((await play(learner.id, lessons[0].id, 20, plus(6))).finished).toEqual({ score: 20, passed: true });

    const progress = await prisma.lessonProgress.findFirstOrThrow({ where: { userId: learner.id } });
    expect(progress.attemptCount).toBe(2);
    expect(progress.bestScore).toBe(20);
  });

  it("correction immédiate avec explication, réponse définitive, bonne réponse cachée avant", async () => {
    const { lessons, learner } = await seedCourse(["UNDERSTANDING"]);
    await seedQuestions(lessons[0].id);
    await startQuizAttempt(learner.id, lessons[0].id);
    const state = await getQuizState(learner.id, lessons[0].id);
    expect(JSON.stringify(state.questions[0])).not.toContain("correct");

    const r = await answerQuizQuestion(learner.id, lessons[0].id, 1, "C");
    expect(r).toMatchObject({ isCorrect: false, correct: "A", explanation: "Explication 1", finished: null });
    await expect(answerQuizQuestion(learner.id, lessons[0].id, 1, "A")).rejects.toThrow("déjà répondu");
  });

  it("refuse une leçon verrouillée et un QCM incomplet", async () => {
    const { lessons, learner } = await seedCourse(["PRACTICE_AI", "UNDERSTANDING"]);
    await seedQuestions(lessons[1].id);
    await expect(startQuizAttempt(learner.id, lessons[1].id)).rejects.toThrow("pas encore disponible");

    const other = await seedCourse(["UNDERSTANDING"]);
    await seedQuestions(other.lessons[0].id, 19);
    // L'élève du 2e parcours voit les 2 parcours ; on teste l'état du QCM incomplet.
    expect((await getQuizState(other.learner.id, other.lessons[0].id)).status).toBe("NOT_READY");
  });

  it("double clic sur « Commencer » : une seule tentative ouverte", async () => {
    const { lessons, learner } = await seedCourse(["UNDERSTANDING"]);
    await seedQuestions(lessons[0].id);
    await Promise.all([startQuizAttempt(learner.id, lessons[0].id), startQuizAttempt(learner.id, lessons[0].id)]);
    expect(await prisma.quizAttempt.count()).toBe(1);
  });

  it("modifier les questions ne réécrit pas l'historique", async () => {
    const { lessons, learner } = await seedCourse(["UNDERSTANDING"]);
    await seedQuestions(lessons[0].id);
    await startQuizAttempt(learner.id, lessons[0].id);
    await answerQuizQuestion(learner.id, lessons[0].id, 1, "A");
    const q = { question: "Nouvelle", answerA: "1", answerB: "2", answerC: "3", answerD: "4", correctAnswer: "B" as const, explanation: "" };
    await saveQuizQuestions(learner.id, lessons[0].id, Array(20).fill(q));
    const answer = await prisma.quizAnswer.findFirstOrThrow();
    expect(answer).toMatchObject({ questionText: "Q1", correctAnswer: "A", isCorrect: true });
  });
});
