"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { gradeSubmission, ReviewError } from "@/server/admin/reviews";

const input = z.object({
  id: z.string().min(1).max(64),
  grades: z.array(z.object({ criterionId: z.string().max(40), misses: z.number().int(), comment: z.string().max(2000) })).max(10),
  feedback: z.string().max(4000),
});

// Correction d'un exercice pratique (admin ou coach).
export async function gradeSubmissionAction(raw: unknown): Promise<{ ok: true; passed: boolean; score: number } | { ok: false; error: string }> {
  const grader = await requireUser(["ADMIN", "COACH"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    const r = await gradeSubmission(grader, parsed.data.id, parsed.data.grades, parsed.data.feedback);
    revalidatePath("/admin/reviews");
    revalidatePath("/coach/exercises");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    console.error("[review]", e);
    return { ok: false, error: "Action impossible. Réessaie." };
  }
}
