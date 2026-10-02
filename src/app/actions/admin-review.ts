"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { decideReview, ReviewError } from "@/server/admin/reviews";

const input = z.object({ id: z.string().min(1).max(64), decision: z.enum(["APPROVE", "REJECT"]), comment: z.string().max(4000) });

export async function decideReviewAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Formulaire invalide." };
  try {
    await decideReview(admin.id, parsed.data.id, parsed.data.decision, parsed.data.comment);
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    console.error("[review]", e);
    return { ok: false, error: "Action impossible. Réessaie." };
  }
  revalidatePath("/admin/reviews");
  return { ok: true };
}
