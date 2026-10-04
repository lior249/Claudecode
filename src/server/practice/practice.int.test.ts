import { createReadStream } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { exists, filePath } from "@/server/storage/storage";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { gradeSubmission, listPendingReviews } from "@/server/admin/reviews";
import { resetDb, seedCourse } from "../../../tests/db";
import { getPracticeView, PracticeError, registerUpload, submitPractice } from "./service";

const fx = (f: string) => path.resolve(import.meta.dirname, "../../../tests/fixtures", f);
const upload = (userId: string, lessonId: string, file: string, name = file) =>
  registerUpload({ userId, lessonId, originalName: name, body: createReadStream(fx(file)) });

async function course(config: object, extra = 1) {
  const c = await seedCourse(["PRACTICE_HUMAN", ...Array(extra).fill("PRACTICE_HUMAN")]);
  await prisma.lesson.update({ where: { id: c.lessons[0].id }, data: { config } });
  const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
  const coach = await prisma.user.create({ data: { displayName: "Coach", role: "COACH", coachOrder: 1 } });
  return { ...c, admin, coach };
}

const crit = (id: string, instruction: string, pointsPerMiss: number) => ({ id, instruction, pointsPerMiss });
const CUTS = {
  accept: ["video"],
  criteria: [crit("cuts", "Chaque cut est placé au bon moment (± 0,5 s).", 2), crit("son", "La vidéo n'a aucune piste audio.", 10)],
};
const ok = (cuts = 0, son = 0) => [
  { criterionId: "cuts", misses: cuts, comment: cuts ? `${cuts} cut(s) décalé(s)` : "" },
  { criterionId: "son", misses: son, comment: "" },
];

describe("Pratique : envoi, correction à la main, note", () => {
  beforeEach(resetDb);

  it("envoi → à corriger (admins et coachs prévenus) ; 8/10 ou plus = leçon validée", async () => {
    const { lessons, learner, admin, coach } = await course(CUTS);
    const asset = await upload(learner.id, lessons[0].id, "cuts-ok.mp4");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    expect(sub.status).toBe("PENDING_HUMAN");
    expect(await prisma.job.count()).toBe(0); // plus d'analyse automatique
    expect((await getPracticeView(learner.id, lessons[0].id)).status).toBe("PENDING_HUMAN");
    expect(await prisma.notification.count({ where: { kind: "admin.humanReview", userId: { in: [admin.id, coach.id] } } })).toBe(2);
    expect((await listPendingReviews()).map((r) => r.id)).toEqual([sub.id]);
    const second = await upload(learner.id, lessons[0].id, "cuts-ko.mp4");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [second.id], text: null })).rejects.toThrow("examine déjà");

    expect(await gradeSubmission(coach, sub.id, ok(1), "")).toEqual({ score: 8, passed: true });
    const done = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(done).toMatchObject({ status: "PASSED", score: 8, reviewedById: coach.id });
    expect((done.criteria as { pointsLost: number }[]).map((c) => c.pointsLost)).toEqual([2, 0]);
    expect((await getLearnerProgression(learner.id)).progression.currentLessonId).toBe(lessons[1].id);
    await expect(gradeSubmission(admin, sub.id, ok(), "")).rejects.toThrow("déjà été corrigée");
  });

  it("note sous 8/10 : non validé, explication obligatoire, puis nouvelle réalisation (pas le même fichier)", async () => {
    const { lessons, learner, admin } = await course(CUTS);
    const asset = await upload(learner.id, lessons[0].id, "cuts-ko.mp4");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    await expect(gradeSubmission(admin, sub.id, [{ criterionId: "cuts", misses: 2, comment: "" }, { criterionId: "son", misses: 1, comment: "" }], "")).rejects.toThrow("Explique");
    await expect(gradeSubmission(admin, sub.id, [{ criterionId: "cuts", misses: 2, comment: "" }], "x")).rejects.toThrow("chaque critère");
    expect(await gradeSubmission(admin, sub.id, ok(2, 1), "Cuts décalés et son présent.")).toEqual({ score: 0, passed: false });
    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.status).toBe("OPEN");
    expect(view.submissions[0]).toMatchObject({ status: "FAILED", score: 0, feedback: "Cuts décalés et son présent." });
    expect(await prisma.notification.findFirst({ where: { userId: learner.id, kind: "learn.result" } })).toMatchObject({ mood: "ko" });
    const same = await upload(learner.id, lessons[0].id, "cuts-ko.mp4", "encore.mp4");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [same.id], text: null })).rejects.toThrow("identique");
  });

  it("un élève ne peut pas corriger ; les critères au moment de l'envoi sont gardés", async () => {
    const { lessons, learner, admin } = await course({ accept: ["text"], criteria: [crit("a", "Ancien critère", 2)] });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Texte" });
    await expect(gradeSubmission(learner, sub.id, [{ criterionId: "a", misses: 0, comment: "" }], "")).rejects.toThrow("introuvable");
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: { accept: ["text"], criteria: [crit("b", "Nouveau", 5)] } } });
    await gradeSubmission(admin, sub.id, [{ criterionId: "a", misses: 1, comment: "" }], "");
    const done = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(done.score).toBe(8);
    expect((done.criteria as { instruction: string }[])[0].instruction).toBe("Ancien critère");
  });

  it("exercice pas prêt (aucun critère) : envoi refusé", async () => {
    const { lessons, learner } = await course({ accept: ["text"], criteria: [] });
    expect((await getPracticeView(learner.id, lessons[0].id)).status).toBe("NOT_READY");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "x" })).rejects.toThrow("pas encore prêt");
  });

  it("critères visibles par l'élève avant l'envoi", async () => {
    const { lessons, learner } = await course(CUTS);
    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.criteria).toEqual([
      { instruction: "Chaque cut est placé au bon moment (± 0,5 s).", pointsPerMiss: 2 },
      { instruction: "La vidéo n'a aucune piste audio.", pointsPerMiss: 10 },
    ]);
  });

  it("refuse les mauvais formats, les faux fichiers et les leçons verrouillées", async () => {
    const { lessons, learner } = await course(CUTS);
    await expect(upload(learner.id, lessons[0].id, "voix-ok.mp3")).rejects.toThrow("Format non accepté");
    const fake = Readable.from([Buffer.from("ceci n'est pas une vidéo")]);
    await expect(registerUpload({ userId: learner.id, lessonId: lessons[0].id, originalName: "faux.mp4", body: fake })).rejects.toThrow("illisible");
    await expect(upload(learner.id, lessons[1].id, "cuts-ok.mp4")).rejects.toThrow("pas encore disponible");
    expect(await prisma.asset.count()).toBe(0); // fichiers refusés supprimés
  });

  it("un élève ne peut pas soumettre le fichier d'un autre", async () => {
    const a = await course(CUTS);
    const asset = await upload(a.learner.id, a.lessons[0].id, "cuts-ok.mp4");
    const intruder = await prisma.user.create({ data: { displayName: "Intrus", role: "LEARNER" } });
    await expect(submitPractice(intruder.id, a.lessons[0].id, { assetIds: [asset.id], text: null })).rejects.toThrow(PracticeError);
  });

  it("ne garde que les fichiers des 5 dernières tentatives", async () => {
    const { lessons, learner } = await course(CUTS);
    for (let n = 1; n <= 7; n++) {
      const sub = await prisma.submission.create({ data: { userId: learner.id, lessonId: lessons[0].id, attemptNumber: n, status: "FAILED", threshold: 8 } });
      const key = `submissions/${learner.id}/t${n}.mp4`;
      await mkdir(path.dirname(filePath(key)), { recursive: true });
      await writeFile(filePath(key), `fichier ${n}`);
      await prisma.asset.create({ data: { userId: learner.id, lessonId: lessons[0].id, submissionId: sub.id, kind: "VIDEO", storageKey: key, originalName: `${n}.mp4`, mimeType: "video/mp4", sizeBytes: 9, sha256: `h${n}` } });
    }
    await pruneOldSubmissionFiles(learner.id, lessons[0].id);
    const assets = await prisma.asset.findMany({ orderBy: { originalName: "asc" } });
    expect(assets.map((a) => Boolean(a.deletedAt))).toEqual([true, true, false, false, false, false, false]);
    expect(await exists(assets[0].storageKey)).toBe(false);
    expect(await exists(assets[6].storageKey)).toBe(true);
    expect(await prisma.submission.count()).toBe(7); // les soumissions restent
  });
});
