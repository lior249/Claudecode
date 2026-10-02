import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { resetDb, seedCourse } from "../../../tests/db";
import { createLesson, createModule, CurriculumError, deleteLesson, move } from "./curriculum";
import { getLearnerFile } from "./learner-file";
import { decideReview, ReviewError } from "./reviews";
import { sendDeadlineReminders } from "@/server/reminders/service";

const H = 3_600_000;

describe("Éditeur du parcours", () => {
  beforeEach(resetDb);

  it("une nouvelle leçon est créée masquée, à la fin du module, avec une configuration par défaut", async () => {
    const { mod, learner } = await seedCourse(["UNDERSTANDING"]);
    const l = await createLesson(learner.id, { moduleId: mod.id, title: "Nouvelle", type: "CODE_VALIDATION" });
    expect(l).toMatchObject({ position: 2, isPublished: false });
    expect((l.config as { code: string }).code).toHaveLength(10);
    const d = await createLesson(learner.id, { moduleId: mod.id, title: "Pays", type: "DECISION", catalog: "countries" });
    expect(d.config).toEqual({ catalog: "countries" });
  });

  it("monter / descendre renumérote les positions", async () => {
    const { mod, lessons, learner } = await seedCourse(["UNDERSTANDING", "PRACTICE_AI", "DECISION"]);
    await move(learner.id, "lesson", lessons[2].id, "up");
    const order = await prisma.lesson.findMany({ where: { moduleId: mod.id }, orderBy: { position: "asc" } });
    expect(order.map((l) => l.id)).toEqual([lessons[0].id, lessons[2].id, lessons[1].id]);
    await move(learner.id, "lesson", lessons[0].id, "up"); // déjà en haut : rien ne change
    expect((await prisma.lesson.findFirstOrThrow({ where: { position: 1 } })).id).toBe(lessons[0].id);
  });

  it("une leçon déjà travaillée ne peut pas être supprimée", async () => {
    const { lessons, learner, level } = await seedCourse(["PRACTICE_AI", "PRACTICE_AI"]);
    await prisma.lessonProgress.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptCount: 1 } });
    await expect(deleteLesson(learner.id, lessons[0].id)).rejects.toThrow(CurriculumError);
    await deleteLesson(learner.id, lessons[1].id);
    expect(await prisma.lesson.count()).toBe(1);
    await createModule(learner.id, { levelId: level.id, title: "M2", description: "", whopUrl: null });
    expect(await prisma.module.count()).toBe(2);
  });
});

describe("Fiche Learn d'un élève", () => {
  beforeEach(resetDb);

  it("consulter la fiche ne démarre pas le chrono de l'élève", async () => {
    const { learner } = await seedCourse(["PRACTICE_AI"]);
    await getLearnerFile(learner.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).learnStartedAt).toBeNull();
  });

  it("décrochages, critères ratés et choix apparaissent sur la fiche", async () => {
    const { lessons, learner } = await seedCourse(["PRACTICE_AI", "PRACTICE_AI"]);
    const t0 = new Date(Date.now() - 100 * H);
    await prisma.user.update({ where: { id: learner.id }, data: { learnStartedAt: t0 } });
    await prisma.lessonProgress.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptCount: 2, bestScore: 8, completedAt: new Date(t0.getTime() + 30 * H) } });
    const crit = { criterionId: "a", instruction: "Cuts au bon moment", pointsPerMiss: 2, misses: 2, pointsLost: 4, evidence: [], comment: "" };
    await prisma.submission.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptNumber: 1, status: "FAILED", score: 6, threshold: 8, criteria: [crit] } });
    await prisma.submission.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptNumber: 2, status: "PASSED", score: 8, threshold: 8, criteria: [{ ...crit, misses: 1 }] } });
    const file = (await getLearnerFile(learner.id))!;
    expect(file.lateRemarks).toHaveLength(2); // 30 h sur la 1re leçon, et la 2e ouverte depuis 70 h
    expect(file.lateRemarks[0].duration).toBe("1 j 6 h");
    expect(file.lessons[0]).toMatchObject({ attempts: 2, scores: ["6/10", "8/10"], missedCriteria: [{ instruction: "Cuts au bon moment", count: 2 }] });
  });
});

describe("Validation humaine", () => {
  beforeEach(resetDb);

  it("valider débloque la suite ; refuser exige un commentaire", async () => {
    const { lessons, learner } = await seedCourse(["PRACTICE_AI", "PRACTICE_AI"]);
    const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
    const sub = await prisma.submission.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptNumber: 1, status: "PENDING_HUMAN", threshold: 8 } });
    await expect(decideReview(admin.id, sub.id, "REJECT", "  ")).rejects.toThrow(ReviewError);
    await decideReview(admin.id, sub.id, "APPROVE", "");
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("HUMAN_APPROVED");
    expect((await getLearnerProgression(learner.id)).progression.currentLessonId).toBe(lessons[1].id);
    await expect(decideReview(admin.id, sub.id, "APPROVE", "")).rejects.toThrow("n'attend plus");
  });
});

describe("Rappel 4 h avant la fin des 24 h", () => {
  beforeEach(resetDb);

  it("part une seule fois, seulement dans les 4 dernières heures", async () => {
    const { learner } = await seedCourse(["PRACTICE_AI"]);
    const t0 = new Date("2026-10-02T08:00:00Z");
    await prisma.user.update({ where: { id: learner.id }, data: { learnStartedAt: t0 } });
    expect(await sendDeadlineReminders(new Date(t0.getTime() + 19 * H))).toBe(0);
    expect(await sendDeadlineReminders(new Date(t0.getTime() + 21 * H))).toBe(1);
    expect(await sendDeadlineReminders(new Date(t0.getTime() + 22 * H))).toBe(0);
    expect(await sendDeadlineReminders(new Date(t0.getTime() + 25 * H))).toBe(0);
  });
});
