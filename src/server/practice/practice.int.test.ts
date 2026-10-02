import { createReadStream } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { exists, filePath } from "@/server/storage/storage";
import { setAIProviderForTests } from "@/server/ai";
import { AIError } from "@/server/ai/types";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { resetDb, seedCourse } from "../../../tests/db";
import { getPracticeView, PracticeError, processSubmission, registerUpload, requestHumanReview, retrySubmission, submitPractice } from "./service";

const fx = (f: string) => path.resolve(import.meta.dirname, "../../../tests/fixtures", f);
const upload = (userId: string, lessonId: string, file: string, name = file) =>
  registerUpload({ userId, lessonId, originalName: name, body: createReadStream(fx(file)) });

async function course(config: object, extra = 1) {
  const c = await seedCourse(["PRACTICE_AI", ...Array(extra).fill("PRACTICE_AI")]);
  await prisma.lesson.update({ where: { id: c.lessons[0].id }, data: { config } });
  return c;
}

const CUTS = {
  accept: ["video"],
  checks: [{ type: "noAudio" }, { type: "cuts", expected: [3, 5, 8, 13], tolerance: 0.5, penaltyPerMiss: 2 }],
};

describe("Pratique : envoi, analyse, note", () => {
  beforeEach(resetDb);
  afterEach(() => setAIProviderForTests(null));

  it("exercice Cuts réussi : 10/10, leçon validée, suite débloquée", async () => {
    const { lessons, learner } = await course(CUTS);
    const asset = await upload(learner.id, lessons[0].id, "cuts-ok.mp4");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    expect(sub.status).toBe("PROCESSING");
    expect(await prisma.job.count({ where: { type: "submission.process" } })).toBe(1);

    await processSubmission(sub.id);
    const done = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(done).toMatchObject({ status: "PASSED", score: 10 });
    const { progression } = await getLearnerProgression(learner.id);
    expect(progression.currentLessonId).toBe(lessons[1].id);
  });

  it("exercice Cuts raté (cuts décalés + son) puis même fichier refusé", async () => {
    const { lessons, learner } = await course(CUTS);
    const asset = await upload(learner.id, lessons[0].id, "cuts-ko.mp4");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    await processSubmission(sub.id);
    const done = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(done).toMatchObject({ status: "FAILED", score: 0 });
    const criteria = done.criteria as { name: string; pointsLost: number; comment: string }[];
    expect(criteria.find((c) => c.name === "Cuts au bon moment")).toMatchObject({ pointsLost: 4 });

    const again = await upload(learner.id, lessons[0].id, "cuts-ko.mp4", "copie.mp4");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [again.id], text: null })).rejects.toThrow("identique");

    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.status).toBe("OPEN");
    expect(view.submissions).toHaveLength(1);
  });

  it("voix off : 2 silences trop longs = 8/10, encore validé", async () => {
    const { lessons, learner } = await course({ accept: ["audio"], checks: [{ type: "silences", minSilence: 0.5, penaltyPerSilence: 1 }] });
    const asset = await upload(learner.id, lessons[0].id, "voix-ko.mp3");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    await processSubmission(sub.id);
    expect(await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ status: "PASSED", score: 8 });
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
    // L'intrus voit le même parcours : sa première leçon est la même.
    await expect(submitPractice(intruder.id, a.lessons[0].id, { assetIds: [asset.id], text: null })).rejects.toThrow(PracticeError);
  });

  it("transcription (texte) : 96 % de ressemblance minimum", async () => {
    const reference = "Il est impossible pour un pilote de survivre à un barrel roll sans entraînement.";
    const { lessons, learner } = await course({ accept: ["text"], checks: [{ type: "textSimilarity", reference, min: 0.96 }] });
    const ko = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Un pilote ne survit pas." });
    await processSubmission(ko.id);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: ko.id } })).status).toBe("FAILED");
    const ok = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: reference.toUpperCase() });
    await processSubmission(ok.id);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: ok.id } })).status).toBe("PASSED");
  });

  it("panne de l'IA : relance possible, puis « faire appel à un humain » après 3 échecs", async () => {
    setAIProviderForTests({ evaluate: async () => { throw new AIError("timeout"); } });
    const { lessons, learner } = await course({ accept: ["text"], rubric: "Le CTA est naturel (3 points)." });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Mon script avec un CTA." });
    await processSubmission(sub.id);
    await expect(requestHumanReview(learner.id, sub.id)).rejects.toThrow("après 3 essais");
    await retrySubmission(learner.id, sub.id);
    await processSubmission(sub.id);
    await retrySubmission(learner.id, sub.id);
    await processSubmission(sub.id);
    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.canAskHuman).toBe(true);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).lastError).toContain("timeout");
    await requestHumanReview(learner.id, sub.id);
    expect((await getPracticeView(learner.id, lessons[0].id)).status).toBe("PENDING_HUMAN");
  });

  it("l'IA ne décide pas : la note est recalculée par le serveur (8/10 requis)", async () => {
    setAIProviderForTests({
      evaluate: async () => ({ criteria: [{ name: "Nuance", maxPoints: 3, pointsLost: 2.5, comment: "" }], feedback: "ok", model: "fake", raw: {} }),
    });
    const { lessons, learner } = await course({ accept: ["text"], rubric: "Nuance (3 points)." });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Texte" });
    await processSubmission(sub.id);
    expect(await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ score: 7.5, status: "FAILED" });
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
