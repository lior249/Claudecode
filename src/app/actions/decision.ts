"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { chooseCatalogItem, DecisionError } from "@/server/decisions/service";

const id = z.string().min(1).max(64);

export async function chooseItemAction(lessonId: string, itemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!id.safeParse(lessonId).success || !id.safeParse(itemId).success) return { ok: false, error: "Choix introuvable." };
  try {
    await chooseCatalogItem(user.id, lessonId, itemId);
  } catch (e) {
    if (e instanceof DecisionError) return { ok: false, error: e.message };
    console.error("[decision]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath("/learn", "layout");
  return { ok: true };
}
