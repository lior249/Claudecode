import "server-only";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";
import { enqueue } from "@/server/jobs/queue";
import { deleteFile, filePath, FileTooLargeError, writeStream } from "@/server/storage/storage";
import { detectCuts, detectSilences, MediaError, probe } from "@/server/media/ffmpeg";
import { getAIProvider } from "@/server/ai";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { notifyLearner } from "@/server/notifications/service";
import type { Prisma } from "@/generated/prisma/client";
import { evaluateCheck, type Measurements } from "./checks";
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES, MAX_MEDIA_SECONDS, parsePracticeConfig, type PracticeConfig } from "./config";
import { computeScore, type CriterionResult } from "./scoring";

export const HUMAN_HELP_AFTER_FAILURES = 3;

// Erreur montrée telle quelle à l'élève (français, sans détail technique).
export class PracticeError extends Error {}

const PRACTICE_TYPES = ["PRACTICE_AI"] as const;

async function loadPracticeLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !PRACTICE_TYPES.includes(lesson.type as (typeof PRACTICE_TYPES)[number])) {
    throw new PracticeError("Exercice introuvable.");
  }
  return { lesson, config: parsePracticeConfig(lesson.config) };
}

async function assertCurrent(userId: string, lessonId: string) {
  try {
    await assertCanStartLesson(userId, lessonId);
  } catch (e) {
    if (e instanceof LessonLockedError) throw new PracticeError(e.message);
    throw e;
  }
}

// ---------- Envoi d'un fichier ----------

export async function registerUpload(input: {
  userId: string;
  lessonId: string;
  originalName: string;
  body: Readable;
}) {
  await assertCurrent(input.userId, input.lessonId);
  const { config } = await loadPracticeLesson(input.lessonId);

  const ext = path.extname(input.originalName).toLowerCase();
  const kind = (["video", "audio"] as const).find((k) => config.accept.includes(k) && ACCEPTED_EXTENSIONS[k].includes(ext));
  if (!kind) {
    const allowed = (["video", "audio"] as const).filter((k) => config.accept.includes(k)).flatMap((k) => ACCEPTED_EXTENSIONS[k]);
    throw new PracticeError(
      allowed.length ? `Format non accepté. Formats possibles : ${allowed.join(", ")}.` : "Cet exercice n'accepte pas de fichier.",
    );
  }

  const id = randomUUID();
  const storageKey = `submissions/${input.userId}/${id}${ext}`;
  let written;
  try {
    written = await writeStream(storageKey, input.body, MAX_FILE_BYTES);
  } catch (e) {
    if (e instanceof FileTooLargeError) throw new PracticeError("Fichier trop lourd : 200 Mo maximum.");
    throw e;
  }

  // Vérifie que c'est vraiment un média du bon type (pas seulement une extension).
  try {
    let info;
    try {
      info = await probe(filePath(storageKey));
    } catch (e) {
      if (e instanceof MediaError) throw new PracticeError("Fichier illisible. Exporte-le à nouveau puis réessaie.");
      throw e;
    }
    if (kind === "video" && !info.hasVideo) throw new PracticeError("Ce fichier ne contient pas de vidéo.");
    if (kind === "audio" && (info.hasVideo || !info.hasAudio)) throw new PracticeError("Ce fichier n'est pas un fichier audio.");
    if (info.durationSeconds > MAX_MEDIA_SECONDS + 0.5) throw new PracticeError("Trop long : 2 min 30 maximum.");

    const mimeType = kind === "video" ? (ext === ".mov" ? "video/quicktime" : ext === ".webm" ? "video/webm" : "video/mp4") : audioMime(ext);
    return await prisma.asset.create({
      data: {
        userId: input.userId,
        lessonId: input.lessonId,
        kind: kind === "video" ? "VIDEO" : "AUDIO",
        storageKey,
        originalName: input.originalName.slice(0, 200),
        mimeType,
        sizeBytes: written.sizeBytes,
        sha256: written.sha256,
        durationSeconds: info.durationSeconds,
        width: info.width,
        height: info.height,
        hasAudio: info.hasAudio,
      },
      select: { id: true, kind: true, originalName: true, sizeBytes: true, durationSeconds: true },
    });
  } catch (e) {
    await deleteFile(storageKey);
    throw e;
  }
}

function audioMime(ext: string) {
  return ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "audio/mp4";
}

// ---------- Soumission ----------

const sha256 = (s: string) => createHash("sha256").update(s.trim()).digest("hex");

export async function submitPractice(userId: string, lessonId: string, input: { assetIds: string[]; text: string | null }) {
  await assertCurrent(userId, lessonId);
  const { lesson, config } = await loadPracticeLesson(lessonId);

  const text = input.text?.trim() || null;
  if (text && text.length > 20_000) throw new PracticeError("Texte trop long.");
  const assets = input.assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: input.assetIds }, userId, lessonId, submissionId: null, deletedAt: null } })
    : [];
  if (assets.length !== new Set(input.assetIds).size) throw new PracticeError("Un fichier est introuvable. Renvoie-le.");

  const needVideo = config.accept.includes("video");
  const needAudio = config.accept.includes("audio");
  const needText = config.accept.includes("text");
  if (needVideo && assets.filter((a) => a.kind === "VIDEO").length !== 1) throw new PracticeError("Ajoute ta vidéo.");
  if (needAudio && assets.filter((a) => a.kind === "AUDIO").length !== 1) throw new PracticeError("Ajoute ton fichier audio.");
  if (!needVideo && !needAudio && assets.length) throw new PracticeError("Cet exercice n'accepte pas de fichier.");
  if (needText && !text) throw new PracticeError("Écris ton texte avant d'envoyer.");
  if (!needText && text) throw new PracticeError("Cet exercice n'accepte pas de texte.");

  const previous = await prisma.submission.findMany({
    where: { userId, lessonId },
    select: { status: true, textSha256: true, assets: { select: { sha256: true } } },
  });
  if (previous.some((s) => s.status === "PROCESSING")) throw new PracticeError("Ta réalisation précédente est encore en cours d'analyse.");
  if (previous.some((s) => s.status === "PASSED" || s.status === "HUMAN_APPROVED")) throw new PracticeError("Tu as déjà validé cet exercice.");
  if (previous.some((s) => s.status === "PENDING_HUMAN")) throw new PracticeError("Un coach examine déjà ta réalisation.");

  // Même fichier (ou même texte) qu'avant = pas une nouvelle tentative.
  const oldHashes = new Set(previous.flatMap((s) => s.assets.map((a) => a.sha256)));
  const textHash = text ? sha256(text) : null;
  const sameFile = assets.some((a) => oldHashes.has(a.sha256));
  const sameText = textHash !== null && previous.some((s) => s.textSha256 === textHash);
  if (sameFile || (sameText && assets.length === 0)) {
    throw new PracticeError("Cette réalisation semble identique à ta précédente soumission. Envoie une nouvelle réalisation.");
  }

  let submission;
  try {
    submission = await prisma.$transaction(async (tx) => {
      const attemptNumber = (await tx.submission.count({ where: { userId, lessonId } })) + 1;
      const created = await tx.submission.create({
        data: { userId, lessonId, attemptNumber, text, textSha256: textHash, threshold: config.threshold, status: "PROCESSING" },
      });
      await tx.asset.updateMany({ where: { id: { in: assets.map((a) => a.id) } }, data: { submissionId: created.id } });
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId, attemptCount: 1 },
        update: { attemptCount: { increment: 1 } },
      });
      await tx.job.create({ data: { type: "submission.process", payload: { submissionId: created.id } } });
      await tx.auditLog.create({
        data: { actorUserId: userId, action: "SUBMISSION_CREATED", entityType: "submission", entityId: created.id, metadata: { lessonId, attemptNumber } },
      });
      return created;
    });
  } catch (e) {
    // Double envoi simultané : l'index unique (une seule analyse en cours) refuse le second.
    if ((e as { code?: string }).code === "P2002") throw new PracticeError("Ta réalisation est déjà en cours d'envoi.");
    throw e;
  }

  await pruneOldSubmissionFiles(userId, lessonId);
  void lesson;
  return submission;
}

// ---------- Analyse (worker) ----------

async function measure(config: PracticeConfig, asset: { storageKey: string; kind: string; durationSeconds: number | null; hasAudio: boolean | null }) {
  const types = new Set(config.checks.map((c) => c.type));
  const m: Measurements = { durationSeconds: asset.durationSeconds ?? undefined, hasAudio: asset.hasAudio ?? undefined };
  const p = filePath(asset.storageKey);
  if (asset.kind === "VIDEO" && (types.has("cuts") || types.has("maxShotLength"))) m.cuts = await detectCuts(p);
  if (types.has("silences") && asset.hasAudio) {
    const minSilence = Math.min(...config.checks.filter((c) => c.type === "silences").map((c) => c.minSilence));
    m.silences = await detectSilences(p, minSilence);
  }
  return m;
}

export async function processSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { assets: true, lesson: true } });
  if (!submission || submission.status !== "PROCESSING") return; // déjà traitée

  try {
    const config = parsePracticeConfig(submission.lesson.config);
    const media = submission.assets.find((a) => a.kind !== "IMAGE" && !a.deletedAt) ?? null;
    const measurements: Measurements = media ? await measure(config, media) : {};
    const measured = config.checks.map((c) => evaluateCheck(c, measurements, submission.text));

    let aiCriteria: CriterionResult[] = [];
    let feedback = defaultFeedback(measured);
    let aiModel: string | null = null;
    if (config.rubric.trim()) {
      const ai = await getAIProvider().evaluate({
        lessonTitle: submission.lesson.title,
        instructions: submission.lesson.summary,
        rubric: config.rubric,
        measuredCriteria: measured,
        measurements,
        text: submission.text,
        media: submission.assets
          .filter((a) => !a.deletedAt)
          .map((a) => ({ path: filePath(a.storageKey), mimeType: a.mimeType, originalName: a.originalName })),
      });
      aiCriteria = ai.criteria.map((c) => ({ ...c, source: "AI" as const }));
      feedback = ai.feedback;
      aiModel = ai.model;
    }

    const criteria = [...measured, ...aiCriteria];
    const { score, passed } = computeScore(criteria, submission.threshold);
    const updated = await prisma.submission.updateMany({
      where: { id: submissionId, status: "PROCESSING" },
      data: {
        status: passed ? "PASSED" : "FAILED",
        score,
        criteria: criteria as unknown as Prisma.InputJsonValue,
        measurements: measurements as Prisma.InputJsonValue,
        feedback,
        aiModel,
        lastError: null,
        processedAt: new Date(),
      },
    });
    if (updated.count === 0) return;

    const progress = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: submission.userId, lessonId: submission.lessonId } } });
    if (progress && (progress.bestScore === null || score > progress.bestScore)) {
      await prisma.lessonProgress.update({ where: { id: progress.id }, data: { bestScore: score } });
    }
    if (passed) await completeLesson(submission.userId, submission.lessonId, score);
    await notifyLearner(
      submission.userId,
      passed
        ? `✅ « ${submission.lesson.title} » validé avec ${fmtScore(score)}/10. La suite est débloquée !`
        : `❌ « ${submission.lesson.title} » : ${fmtScore(score)}/10. Il faut ${fmtScore(submission.threshold)}/10. Regarde la correction sur Creato et renvoie une nouvelle réalisation.`,
    );
  } catch (e) {
    console.error(`[submission ${submissionId}] analyse impossible`, e);
    await prisma.submission.updateMany({
      where: { id: submissionId, status: "PROCESSING" },
      data: { status: "ERROR", technicalFailures: { increment: 1 }, lastError: e instanceof Error ? e.message.slice(0, 1000) : String(e) },
    });
  }
}

const fmtScore = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function defaultFeedback(measured: CriterionResult[]) {
  const missed = measured.filter((c) => c.pointsLost > 0);
  if (!missed.length) return "Tout est bon sur les points mesurés. Bravo !";
  return `À corriger : ${missed.map((c) => c.name.toLowerCase()).join(", ")}.`;
}

// ---------- Panne : relancer, puis faire appel à un humain ----------

export async function retrySubmission(userId: string, submissionId: string) {
  const sub = await prisma.submission.findFirst({ where: { id: submissionId, userId } });
  if (!sub) throw new PracticeError("Soumission introuvable.");
  if (sub.status !== "ERROR") throw new PracticeError("Cette soumission n'est pas en erreur.");
  const updated = await prisma.submission.updateMany({ where: { id: sub.id, status: "ERROR" }, data: { status: "PROCESSING" } });
  if (updated.count) await enqueue("submission.process", { submissionId: sub.id });
}

export async function requestHumanReview(userId: string, submissionId: string) {
  const sub = await prisma.submission.findFirst({ where: { id: submissionId, userId }, include: { lesson: true, user: true } });
  if (!sub) throw new PracticeError("Soumission introuvable.");
  if (sub.status !== "ERROR" || sub.technicalFailures < HUMAN_HELP_AFTER_FAILURES) {
    throw new PracticeError("Tu pourras faire appel à un humain après 3 essais qui n'ont pas pu être traités.");
  }
  await prisma.submission.update({ where: { id: sub.id }, data: { status: "PENDING_HUMAN" } });
  await prisma.auditLog.create({
    data: { actorUserId: userId, action: "HUMAN_REVIEW_REQUESTED", entityType: "submission", entityId: sub.id, metadata: { lessonId: sub.lessonId } },
  });
  if (sub.user.coachId) {
    await notifyLearner(sub.user.coachId, `🙋 ${sub.user.displayName} demande une correction humaine pour « ${sub.lesson.title} ». Ouvre Creato pour l'examiner.`);
  }
}

// ---------- Vue élève ----------

export interface PracticeView {
  lessonId: string;
  title: string;
  summary: string;
  rubric: string;
  measuredCriteria: string[]; // libellés des mesures automatiques (sans les valeurs de référence)
  accept: PracticeConfig["accept"];
  threshold: number;
  status: "OPEN" | "PROCESSING" | "PASSED" | "PENDING_HUMAN";
  canAskHuman: boolean;
  submissions: {
    id: string;
    attemptNumber: number;
    status: string;
    score: number | null;
    feedback: string | null;
    criteria: CriterionResult[];
    createdAt: string;
    technicalFailures: number;
    files: { name: string; deleted: boolean }[];
    hasText: boolean;
  }[];
}

export async function getPracticeView(userId: string, lessonId: string): Promise<PracticeView> {
  const { lesson, config } = await loadPracticeLesson(lessonId);
  const submissions = await prisma.submission.findMany({
    where: { userId, lessonId },
    orderBy: { attemptNumber: "desc" },
    include: { assets: { select: { originalName: true, deletedAt: true } } },
  });
  const latest = submissions[0];
  const passed = submissions.some((s) => s.status === "PASSED" || s.status === "HUMAN_APPROVED");
  const status = passed
    ? "PASSED"
    : latest?.status === "PROCESSING"
      ? "PROCESSING"
      : latest?.status === "PENDING_HUMAN"
        ? "PENDING_HUMAN"
        : "OPEN";
  return {
    lessonId,
    title: lesson.title,
    summary: lesson.summary,
    rubric: config.rubric,
    measuredCriteria: config.checks.map((c) => c.label),
    accept: config.accept,
    threshold: config.threshold,
    status,
    canAskHuman: latest?.status === "ERROR" && latest.technicalFailures >= HUMAN_HELP_AFTER_FAILURES,
    submissions: submissions.map((s) => ({
      id: s.id,
      attemptNumber: s.attemptNumber,
      status: s.status,
      score: s.score,
      feedback: s.feedback,
      criteria: (s.criteria as unknown as CriterionResult[] | null) ?? [],
      createdAt: s.createdAt.toISOString(),
      technicalFailures: s.technicalFailures,
      files: s.assets.map((a) => ({ name: a.originalName, deleted: Boolean(a.deletedAt) })),
      hasText: Boolean(s.text),
    })),
  };
}
