import { createReadStream } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { exists, filePath } from "@/server/storage/storage";
import { setAIForTests } from "@/server/ai";
import { AIError, type GradeInput } from "@/server/ai/types";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { resetDb, seedCourse } from "../../../tests/db";
import { getPracticeView, PracticeError, processSubmission, registerReferenceUpload, registerUpload, requestHumanReview, retrySubmission, submitPractice } from "./service";

const fx = (f: string) => path.resolve(import.meta.dirname, "../../../tests/fixtures", f);
const upload = (userId: string, lessonId: string, file: string, name = file) =>
  registerUpload({ userId, lessonId, originalName: name, body: createReadStream(fx(file)) });

async function course(config: object, extra = 1) {
  const c = await seedCourse(["PRACTICE_AI", ...Array(extra).fill("PRACTICE_AI")]);
  await prisma.lesson.update({ where: { id: c.lessons[0].id }, data: { config } });
  return c;
}

const crit = (id: string, instruction: string, pointsPerMiss: number) => ({ id, instruction, pointsPerMiss });
const CUTS = {
  accept: ["video"],
  agentInstructions: "Exercice des cuts : 4 cuts attendus à 3 s, 5 s, 8 s et 13 s, tolérance ± 0,5 s. La vidéo ne doit pas avoir de son.",
  criteria: [crit("cuts", "Chaque cut est placé au bon moment (± 0,5 s).", 2), crit("son", "La vidéo n'a aucune piste audio.", 10)],
};

// Correcteur de test qui applique la consigne des cuts à partir des mesures exactes (comme le ferait l'agent).
const cutsGrader = {
  grade: async (input: GradeInput) => {
    const expected = [3, 5, 8, 13];
    const cuts = input.report.media!.cuts;
    const missed = expected.filter((t) => !cuts.some((c) => Math.abs(c - t) <= 0.5));
    return {
      criteria: [
        { criterionId: "cuts", misses: missed.length, evidence: missed.map((t) => ({ time: t, detail: "cut absent" })), comment: "" },
        { criterionId: "son", misses: input.report.media!.hasAudio ? 1 : 0, evidence: [], comment: "" },
      ],
      feedback: "ok",
      model: "test-grader",
    };
  },
};

describe("Pratique : envoi, analyse, note", () => {
  beforeEach(async () => {
    await resetDb();
    setAIForTests({ grader: cutsGrader });
  });
  afterEach(() => setAIForTests({}));

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
    const criteria = done.criteria as { criterionId: string; misses: number; pointsLost: number }[];
    expect(criteria.find((c) => c.criterionId === "cuts")).toMatchObject({ misses: 2, pointsLost: 4 });
    expect(criteria.find((c) => c.criterionId === "son")).toMatchObject({ misses: 1, pointsLost: 10 });
    const analysis = done.analysis as { media: { cuts: number[]; hasAudio: boolean }; ai: { model: string } };
    expect(analysis.media.cuts).toEqual([3, 6.5, 8, 14]);
    expect(analysis.ai.model).toBe("mock-analyst");

    const again = await upload(learner.id, lessons[0].id, "cuts-ko.mp4", "copie.mp4");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [again.id], text: null })).rejects.toThrow("identique");

    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.status).toBe("OPEN");
    expect(view.submissions).toHaveLength(1);
  });

  it("voix off : les silences exacts sont transmis au correcteur, 2 silences × −1 = 8/10", async () => {
    setAIForTests({
      grader: {
        grade: async (input: GradeInput) => ({
          criteria: [{ criterionId: "silences", misses: input.report.media!.silences.filter((x) => x.duration >= 0.5).length, evidence: [], comment: "" }],
          feedback: "",
          model: "test",
        }),
      },
    });
    const { lessons, learner } = await course({ accept: ["audio"], agentInstructions: "Couper les silences.", criteria: [crit("silences", "Aucun silence de 0,5 s ou plus.", 1)] });
    const asset = await upload(learner.id, lessons[0].id, "voix-ko.mp3");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    await processSubmission(sub.id);
    expect(await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ status: "PASSED", score: 8 });
  });

  it("exercice pas prêt (pas de consigne ou pas de critère) : envoi refusé", async () => {
    const { lessons, learner } = await course({ accept: ["text"], criteria: [] });
    expect((await getPracticeView(learner.id, lessons[0].id)).status).toBe("NOT_READY");
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "x" })).rejects.toThrow("pas encore prêt");
  });

  it("critères visibles par l'élève, consigne et référence cachées", async () => {
    const { lessons, learner } = await course({ ...CUTS, referenceText: "SCRIPT SECRET" });
    const view = await getPracticeView(learner.id, lessons[0].id);
    expect(view.criteria).toEqual([{ instruction: "Chaque cut est placé au bon moment (± 0,5 s).", pointsPerMiss: 2 }, { instruction: "La vidéo n'a aucune piste audio.", pointsPerMiss: 10 }]);
    expect(JSON.stringify(view)).not.toContain("SCRIPT SECRET");
    expect(JSON.stringify(view)).not.toContain("4 cuts attendus");
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

  it("transcription : le pourcentage exact de ressemblance est calculé par le serveur et donné au correcteur", async () => {
    const reference = "Il est impossible pour un pilote de survivre à un barrel roll sans entraînement.";
    let seen: GradeInput | null = null;
    setAIForTests({
      grader: {
        grade: async (input: GradeInput) => {
          seen = input;
          return { criteria: [{ criterionId: "t", misses: input.report.text!.reference!.similarityPercent >= 96 ? 0 : 1, evidence: [], comment: "" }], feedback: "", model: "test" };
        },
      },
    });
    const { lessons, learner } = await course({ accept: ["text"], agentInstructions: "Transcrire.", referenceText: reference, criteria: [crit("t", "Le texte correspond au script à 96 % minimum.", 10)] });
    const ko = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Un pilote ne survit pas." });
    await processSubmission(ko.id);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: ko.id } })).status).toBe("FAILED");
    expect(seen!.report.ai).toBeNull(); // pas d'analyste pour un texte
    const ok = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: reference.toUpperCase() });
    await processSubmission(ok.id);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: ok.id } })).status).toBe("PASSED");
    expect(seen!.report.text!.reference!.similarityPercent).toBe(100);
  });

  it("fichier de référence de l'Admin transmis à l'analyste, jamais supprimé comme orphelin", async () => {
    const { lessons, learner } = await course(CUTS);
    const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
    const ref = await registerReferenceUpload({ adminId: admin.id, lessonId: lessons[0].id, originalName: "exemple.mp4", body: createReadStream(fx("cuts-ok.mp4")) });
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: { ...CUTS, referenceAssetId: ref.id } } });
    let referenceName: string | null = null;
    setAIForTests({
      grader: cutsGrader,
      analyst: {
        analyze: async (input) => {
          referenceName = input.reference?.originalName ?? null;
          return { summary: "", transcript: [], shots: [], soundEvents: [], onScreenText: [], comparisonWithReference: "", model: "t" };
        },
      },
    });
    const asset = await upload(learner.id, lessons[0].id, "cuts-ok.mp4", "moi.mp4");
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [asset.id], text: null });
    await processSubmission(sub.id);
    expect(referenceName).toBe("exemple.mp4");
    const { cleanupOrphanAssets } = await import("@/server/retention/service");
    await cleanupOrphanAssets(0);
    expect((await prisma.asset.findUniqueOrThrow({ where: { id: ref.id } })).deletedAt).toBeNull();
  });

  it("l'élève ne peut pas soumettre le fichier de référence", async () => {
    const { lessons, learner } = await course(CUTS);
    const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
    const ref = await registerReferenceUpload({ adminId: admin.id, lessonId: lessons[0].id, originalName: "exemple.mp4", body: createReadStream(fx("cuts-ok.mp4")) });
    await expect(submitPractice(learner.id, lessons[0].id, { assetIds: [ref.id], text: null })).rejects.toThrow(PracticeError);
  });

  it("panne de l'IA : relance possible, puis « faire appel à un humain » après 3 échecs", async () => {
    setAIForTests({ grader: { grade: async () => { throw new AIError("timeout"); } } });
    const { lessons, learner } = await course({ accept: ["text"], agentInstructions: "CTA naturel.", criteria: [crit("cta", "Le CTA est naturel.", 3)] });
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

  it("l'IA ne décide pas : points = erreurs × points du critère, note et statut calculés par le serveur", async () => {
    setAIForTests({
      grader: {
        grade: async () => ({
          criteria: [
            { criterionId: "a", misses: 1, evidence: [], comment: "" },
            { criterionId: "b", misses: 2.9, evidence: [], comment: "" }, // demi-erreur arrondie à l'entier inférieur
          ],
          feedback: "ok",
          model: "fake",
        }),
      },
    });
    const { lessons, learner } = await course({ accept: ["text"], agentInstructions: "x", criteria: [crit("a", "A", 1.5), crit("b", "B", 0.5)] });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Texte" });
    await processSubmission(sub.id);
    expect(await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ score: 7.5, status: "FAILED" });
  });

  it("un critère oublié par le correcteur = panne (relançable), jamais un 10/10 par défaut", async () => {
    setAIForTests({ grader: { grade: async () => ({ criteria: [], feedback: "", model: "fake" }) } });
    const { lessons, learner } = await course({ accept: ["text"], agentInstructions: "x", criteria: [crit("a", "A", 2)] });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Texte" });
    await processSubmission(sub.id);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("ERROR");
  });

  it("les critères au moment de l'envoi sont conservés si l'Admin les change ensuite", async () => {
    const { lessons, learner } = await course({ accept: ["text"], agentInstructions: "x", criteria: [crit("a", "Ancien critère", 2)] });
    setAIForTests({ grader: { grade: async () => ({ criteria: [{ criterionId: "a", misses: 1, evidence: [], comment: "" }], feedback: "", model: "f" }) } });
    const sub = await submitPractice(learner.id, lessons[0].id, { assetIds: [], text: "Texte" });
    await prisma.lesson.update({ where: { id: lessons[0].id }, data: { config: { accept: ["text"], agentInstructions: "x", criteria: [crit("a", "Nouveau", 5)] } } });
    await processSubmission(sub.id);
    const done = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } });
    expect(done.score).toBe(8);
    expect((done.criteria as { instruction: string }[])[0].instruction).toBe("Ancien critère");
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
