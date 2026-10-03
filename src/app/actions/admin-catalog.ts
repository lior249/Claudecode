"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { catalogItemInput, deleteCatalogItem, saveCatalogItem } from "@/server/decisions/admin";
import {
  createCriterion,
  createOption,
  criterionLabel,
  deleteCriterion,
  deleteOption,
  moveCriterion,
  moveOption,
  optionInput,
  renameCriterion,
  updateOption,
} from "@/server/decisions/criteria";

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

// ---------- Critères et options des catalogues ----------

const criterionAction = z.discriminatedUnion("op", [
  z.object({ op: z.literal("createCriterion"), catalog: z.enum(["NICHE", "COUNTRY", "METHOD_10K"]), label: criterionLabel }),
  z.object({ op: z.literal("renameCriterion"), id: z.string().max(64), label: criterionLabel }),
  z.object({ op: z.literal("deleteCriterion"), id: z.string().max(64) }),
  z.object({ op: z.literal("moveCriterion"), id: z.string().max(64), dir: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ op: z.literal("createOption"), criterionId: z.string().max(64), option: optionInput }),
  z.object({ op: z.literal("updateOption"), id: z.string().max(64), option: optionInput }),
  z.object({ op: z.literal("deleteOption"), id: z.string().max(64) }),
  z.object({ op: z.literal("moveOption"), id: z.string().max(64), dir: z.union([z.literal(-1), z.literal(1)]) }),
]);

export async function catalogCriteriaAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = criterionAction.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const a = parsed.data;
  try {
    if (a.op === "createCriterion") await createCriterion(admin.id, a.catalog, a.label);
    else if (a.op === "renameCriterion") await renameCriterion(admin.id, a.id, a.label);
    else if (a.op === "deleteCriterion") await deleteCriterion(admin.id, a.id);
    else if (a.op === "moveCriterion") await moveCriterion(admin.id, a.id, a.dir);
    else if (a.op === "createOption") await createOption(admin.id, a.criterionId, a.option);
    else if (a.op === "updateOption") await updateOption(admin.id, a.id, a.option);
    else if (a.op === "deleteOption") await deleteOption(admin.id, a.id);
    else await moveOption(admin.id, a.id, a.dir);
  } catch (e) {
    console.error("[catalog criteria]", e);
    return { ok: false, error: "Modification impossible. Réessaie." };
  }
  revalidatePath("/admin/catalogs", "layout");
  revalidatePath("/learn", "layout");
  return { ok: true };
}
