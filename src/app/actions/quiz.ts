"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { answerQuizQuestion, QuizError, startQuizAttempt, type AnswerResult } from "@/server/quizzes/service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const lessonId = z.string().min(1).max(64);
const answerInput = z.object({ lessonId, position: z.number().int().min(1).max(20), choice: z.enum(["A", "B", "C", "D"]) });

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof QuizError) return { ok: false, error: e.message };
    console.error("[quiz]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
}

export async function startQuiz(id: string): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = lessonId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "QCM introuvable." };
  const res = await guard(async () => {
    await startQuizAttempt(user.id, parsed.data);
    return null;
  });
  revalidatePath(`/learn/quiz/${parsed.data}`);
  return res;
}

export async function answerQuestion(input: { lessonId: string; position: number; choice: string }): Promise<Result<AnswerResult>> {
  const user = await requireUser();
  const parsed = answerInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Réponse invalide." };
  const { lessonId: id, position, choice } = parsed.data;
  const res = await guard(() => answerQuizQuestion(user.id, id, position, choice));
  if (res.ok && res.data.finished) revalidatePath("/learn");
  return res;
}
