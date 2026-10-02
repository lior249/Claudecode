"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { PracticeError, requestHumanReview, retrySubmission, submitPractice } from "@/server/practice/service";

type Result = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<unknown>, lessonId: string): Promise<Result> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof PracticeError) return { ok: false, error: e.message };
    console.error("[practice]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath(`/learn/practice/${lessonId}`);
  return { ok: true };
}

const id = z.string().min(1).max(64);
const submitInput = z.object({ lessonId: id, assetIds: z.array(id).max(5), text: z.string().max(20_000).nullable() });

export async function submitPracticeAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const input = submitInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "Envoi invalide." };
  return guard(() => submitPractice(user.id, input.data.lessonId, { assetIds: input.data.assetIds, text: input.data.text }), input.data.lessonId);
}

export async function retrySubmissionAction(lessonId: string, submissionId: string): Promise<Result> {
  const user = await requireUser();
  if (!id.safeParse(submissionId).success || !id.safeParse(lessonId).success) return { ok: false, error: "Soumission introuvable." };
  return guard(() => retrySubmission(user.id, submissionId), lessonId);
}

export async function requestHumanAction(lessonId: string, submissionId: string): Promise<Result> {
  const user = await requireUser();
  if (!id.safeParse(submissionId).success || !id.safeParse(lessonId).success) return { ok: false, error: "Soumission introuvable." };
  return guard(() => requestHumanReview(user.id, submissionId), lessonId);
}
