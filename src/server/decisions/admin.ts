import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { deleteFile } from "@/server/storage/storage";
import { linkSchema, parseKeys } from "./catalog";

export const catalogItemInput = z.object({
  id: z.string().max(64).nullable(),
  catalog: z.enum(["NICHE", "COUNTRY", "METHOD_10K"]),
  title: z.string().trim().min(1, "Le nom est obligatoire.").max(120),
  summary: z.string().trim().max(300),
  body: z.string().trim().max(20_000),
  competition: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  equipment: z.enum(["PC", "PHONE", "BOTH"]).nullable(),
  thumbnailKey: z.string().regex(/^catalog\/[0-9a-f-]{36}\.(jpg|png|webp)$/).nullable(),
  imageKeys: z.array(z.string().regex(/^catalog\/[0-9a-f-]{36}\.(jpg|png|webp)$/)).max(12),
  links: z.array(linkSchema).max(10),
  isPublished: z.boolean(),
});
export type CatalogItemInput = z.infer<typeof catalogItemInput>;

export async function saveCatalogItem(actorId: string, input: CatalogItemInput) {
  const { id, ...data } = input;
  let item;
  if (id) {
    const before = await prisma.catalogItem.findUnique({ where: { id } });
    if (!before) throw new Error("fiche introuvable");
    item = await prisma.catalogItem.update({ where: { id }, data });
    // Images retirées de la fiche : fichiers supprimés.
    const kept = new Set([data.thumbnailKey, ...data.imageKeys]);
    for (const key of [before.thumbnailKey, ...parseKeys(before.imageKeys)]) if (key && !kept.has(key)) await deleteFile(key);
  } else {
    const position = (await prisma.catalogItem.count({ where: { catalog: data.catalog } })) + 1;
    item = await prisma.catalogItem.create({ data: { ...data, position } });
  }
  await prisma.auditLog.create({
    data: { actorUserId: actorId, action: id ? "CATALOG_ITEM_UPDATED" : "CATALOG_ITEM_CREATED", entityType: "catalogItem", entityId: item.id, metadata: { title: item.title } },
  });
  return item;
}

// Une fiche déjà choisie par un élève ne peut pas être supprimée (seulement masquée).
export async function deleteCatalogItem(actorId: string, id: string) {
  const item = await prisma.catalogItem.findUnique({ where: { id }, include: { _count: { select: { choices: true } } } });
  if (!item) return { ok: false as const, error: "Fiche introuvable." };
  if (item._count.choices > 0) return { ok: false as const, error: "Des élèves ont choisi cette fiche : masque-la plutôt que de la supprimer." };
  await prisma.catalogItem.delete({ where: { id } });
  for (const key of [item.thumbnailKey, ...parseKeys(item.imageKeys)]) if (key) await deleteFile(key);
  await prisma.auditLog.create({ data: { actorUserId: actorId, action: "CATALOG_ITEM_DELETED", entityType: "catalogItem", entityId: id, metadata: { title: item.title } } });
  return { ok: true as const };
}
