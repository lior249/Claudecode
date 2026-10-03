import "server-only";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";
import { enqueue } from "@/server/jobs/queue";
import { deleteFile, filePath, FileTooLargeError, writeStream } from "@/server/storage/storage";
import { detectCuts, detectSilences, MediaError, probe } from "@/server/media/ffmpeg";
import { getAnalyst, getGrader } from "@/server/ai";
import { AIError, type AnalysisReport } from "@/server/ai/types";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { notify } from "@/server/notifications/service";
import type { Prisma } from "@/generated/prisma/client";
import { measureText, shotsFromCuts, type MediaMeasurements } from "./analysis";
import {
  ACCEPTED_EXTENSIONS,
  isPracticeReady,
  MAX_FILE_BYTES,
  MAX_MEDIA_SECONDS,
  parsePracticeConfig,
  type PracticeConfig,
  type PracticeCriterion,
} from "./config";
import { computeScore, pointsLost, type CriterionResult } from "./scoring";

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

async function storeMedia(input: {
  ownerId: string;
  lessonId: string;
  originalName: string;
  body: Readable;
  allowed: ("video" | "audio")[];
  isReference: boolean;
}) {
  const ext = path.extname(input.originalName).toLowerCase();
  const kind = input.allowed.find((k) => ACCEPTED_EXTENSIONS[k].includes(ext));
  if (!kind) {
    const formats = input.allowed.flatMap((k) => ACCEPTED_EXTENSIONS[k]);
    throw new PracticeError(formats.length ? `Format non accepté. Formats possibles : ${formats.join(", ")}.` : "Cet exercice n'accepte pas de fichier.");
  }

  const id = randomUUID();
  const storageKey = `${input.isReference ? "references" : "submissions"}/${input.ownerId}/${id}${ext}`;
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
        userId: input.ownerId,
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
        isReference: input.isReference,
      },
      select: { id: true, kind: true, originalName: true, sizeBytes: true, durationSeconds: true },
    });
  } catch (e) {
    await deleteFile(storageKey);
    throw e;
  }
}

// Fichier envoyé par l'élève pour l'exercice en cours.
export async function registerUpload(input: { userId: string; lessonId: string; originalName: string; body: Readable }) {
  await assertCurrent(input.userId, input.lessonId);
  const { config } = await loadPracticeLesson(input.lessonId);
  return storeMedia({
    ownerId: input.userId,
    lessonId: input.lessonId,
    originalName: input.originalName,
    body: input.body,
    allowed: (["video", "audio"] as const).filter((k) => config.accept.includes(k)),
    isReference: false,
  });
}

// Fichier de référence envoyé par l'Admin (vidéo ou audio d'exemple).
export async function registerReferenceUpload(input: { adminId: string; lessonId: string; originalName: string; body: Readable }) {
  await loadPracticeLesson(input.lessonId);
  return storeMedia({
    ownerId: input.adminId,
    lessonId: input.lessonId,
    originalName: input.originalName,
    body: input.body,
    allowed: ["video", "audio"],
    isReference: true,
  });
}

function audioMime(ext: string) {
  return ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "audio/mp4";
}

// ---------- Soumission ----------

const sha256 = (s: string) => createHash("sha256").update(s.trim()).digest("hex");

export async function submitPractice(userId: string, lessonId: string, input: { assetIds: string[]; text: string | null }) {
  await assertCurrent(userId, lessonId);
  const { config } = await loadPracticeLesson(lessonId);
  if (!isPracticeReady(config)) throw new PracticeError("Cet exercice n'est pas encore prêt. Reviens un peu plus tard.");

  const text = input.text?.trim() || null;
  if (text && text.length > 20_000) throw new PracticeError("Texte trop long.");
  const assets = input.assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: input.assetIds }, userId, lessonId, submissionId: null, deletedAt: null, isReference: false } })
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
        data: {
          userId,
          lessonId,
          attemptNumber,
          text,
          textSha256: textHash,
          threshold: config.threshold,
          criteriaSnapshot: config.criteria as unknown as Prisma.InputJsonValue,
          status: "PROCESSING",
        },
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
  return submission;
}

// ---------- Analyse (worker) ----------
// 1. mesures exactes (ffmpeg, comparaison de texte) ; 2. l'analyste décrit la réalisation ;
// 3. le correcteur compte les erreurs par critère ; 4. le serveur calcule les points et la note.

async function measureMedia(asset: { storageKey: string; kind: string; durationSeconds: number | null; hasAudio: boolean | null }) {
  const p = filePath(asset.storageKey);
  const duration = asset.durationSeconds ?? 0;
  const cuts = asset.kind === "VIDEO" ? await detectCuts(p) : [];
  const silences = asset.hasAudio ? await detectSilences(p, 0.25) : [];
  const m: MediaMeasurements = {
    durationSeconds: Math.round(duration * 100) / 100,
    hasAudio: Boolean(asset.hasAudio),
    hasVideo: asset.kind === "VIDEO",
    cuts,
    shots: asset.kind === "VIDEO" ? shotsFromCuts(cuts, duration) : [],
    silences,
  };
  return m;
}

export async function processSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { assets: true, lesson: true } });
  if (!submission || submission.status !== "PROCESSING") return; // déjà traitée

  try {
    const config = parsePracticeConfig(submission.lesson.config);
    const criteria = (submission.criteriaSnapshot as unknown as PracticeCriterion[] | null) ?? config.criteria;
    const media = submission.assets.find((a) => (a.kind === "VIDEO" || a.kind === "AUDIO") && !a.deletedAt) ?? null;

    const report: AnalysisReport = { media: null, text: null, ai: null };
    if (submission.text) report.text = measureText(submission.text, config.referenceText);
    let analystModel: string | null = null;
    if (media) {
      report.media = await measureMedia(media);
      const reference = config.referenceAssetId
        ? await prisma.asset.findFirst({ where: { id: config.referenceAssetId, isReference: true, deletedAt: null } })
        : null;
      report.ai = await getAnalyst().analyze({
        lessonTitle: submission.lesson.title,
        agentInstructions: config.agentInstructions,
        criteria,
        media: { path: filePath(media.storageKey), mimeType: media.mimeType, originalName: media.originalName },
        reference: reference ? { path: filePath(reference.storageKey), mimeType: reference.mimeType, originalName: reference.originalName } : null,
        measurements: report.media,
      });
      analystModel = report.ai.model;
    }

    const grading = await getGrader().grade({
      lessonTitle: submission.lesson.title,
      learnerInstructions: submission.lesson.summary,
      agentInstructions: config.agentInstructions,
      criteria,
      report,
      text: submission.text,
      referenceText: config.referenceText,
    });

    const results: CriterionResult[] = criteria.map((c) => {
      const g = grading.criteria.find((x) => x.criterionId === c.id);
      if (!g) throw new AIError(`correcteur : critère « ${c.id} » non évalué`);
      const misses = Math.max(0, Math.floor(g.misses));
      return {
        criterionId: c.id,
        instruction: c.instruction,
        pointsPerMiss: c.pointsPerMiss,
        misses,
        pointsLost: pointsLost(misses, c.pointsPerMiss),
        evidence: g.evidence.slice(0, 30),
        comment: g.comment,
      };
    });
    const { score, passed } = computeScore(results, submission.threshold);

    const updated = await prisma.submission.updateMany({
      where: { id: submissionId, status: "PROCESSING" },
      data: {
        status: passed ? "PASSED" : "FAILED",
        score,
        criteria: results as unknown as Prisma.InputJsonValue,
        analysis: report as unknown as Prisma.InputJsonValue,
        feedback: grading.feedback,
        aiModel: [analystModel, grading.model].filter(Boolean).join(" / "),
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
    await notify(submission.userId, { kind: "learn.result", href: `/learn/practice/${submission.lessonId}`, mood: passed ? "content" : "ko", text: passed
        ? `✅ « ${submission.lesson.title} » validé avec ${fmtScore(score)}/10. La suite est débloquée !`
        : `❌ « ${submission.lesson.title} » : ${fmtScore(score)}/10. Il faut ${fmtScore(submission.threshold)}/10. Regarde la correction sur Creato et renvoie une nouvelle réalisation.` });
  } catch (e) {
    console.error(`[submission ${submissionId}] analyse impossible`, e);
    await prisma.submission.updateMany({
      where: { id: submissionId, status: "PROCESSING" },
      data: { status: "ERROR", technicalFailures: { increment: 1 }, lastError: e instanceof Error ? e.message.slice(0, 1000) : String(e) },
    });
  }
}

const fmtScore = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

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
  // Pendant le Learn, les corrections humaines sont traitées par les admins.
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) {
    await notify(a.id, { kind: "admin.humanReview", href: "/admin/reviews", text: `🙋 ${sub.user.displayName} demande une correction humaine pour « ${sub.lesson.title} ». Ouvre Creato pour l'examiner.` });
  }
}

// ---------- Vue élève ----------

export interface PracticeView {
  lessonId: string;
  title: string;
  summary: string;
  criteria: { instruction: string; pointsPerMiss: number }[]; // visibles par l'élève avant l'envoi
  accept: PracticeConfig["accept"];
  threshold: number;
  status: "NOT_READY" | "OPEN" | "PROCESSING" | "PASSED" | "PENDING_HUMAN";
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
    reviewComment: string | null;
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
        : isPracticeReady(config)
          ? "OPEN"
          : "NOT_READY";
  return {
    lessonId,
    title: lesson.title,
    summary: lesson.summary,
    criteria: config.criteria.map((c) => ({ instruction: c.instruction, pointsPerMiss: c.pointsPerMiss })),
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
      reviewComment: s.reviewComment,
    })),
  };
}
