"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { catalogItemInput, deleteCatalogItem, saveCatalogItem } from "@/server/decisions/admin";

export async function saveCatalogItemAction(raw: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = catalogItemInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "links") return { ok: false, error: "Chaque lien a besoin d'un titre et d'une adresse qui commence par https://." };
    return { ok: false, error: issue?.message ?? "Formulaire invalide." };
  }
  try {
    const item = await saveCatalogItem(admin.id, parsed.data);
    revalidatePath("/admin/catalogs");
    return { ok: true, id: item.id };
  } catch (e) {
    console.error("[catalog]", e);
    return { ok: false, error: "Enregistrement impossible. Réessaie." };
  }
}

export async function deleteCatalogItemAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const res = await deleteCatalogItem(admin.id, String(id).slice(0, 64));
  if (res.ok) revalidatePath("/admin/catalogs");
  return res;
}
