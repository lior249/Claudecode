"use server";

import { revalidatePath } from "next/cache";
import { getEnv } from "@/server/env";
import { requireUser } from "@/server/auth/session";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Démo uniquement : valide la leçon en cours sans exercice, pour visualiser la progression.
export async function devCompleteLesson(lessonId: string): Promise<ActionResult> {
  if (!getEnv().devLoginEnabled) return { ok: false, error: "Action indisponible." };
  const user = await requireUser();
  try {
    await assertCanStartLesson(user.id, lessonId);
    await completeLesson(user.id, lessonId, null);
  } catch (e) {
    if (e instanceof LessonLockedError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Impossible de valider pour le moment. Réessaie." };
  }
  revalidatePath("/learn");
  return { ok: true };
}
