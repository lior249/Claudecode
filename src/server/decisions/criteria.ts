import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import type { Catalog } from "@/generated/prisma/enums";
import { asOptionColor, OPTION_COLORS } from "./catalog";

// Critères des catalogues et leurs options : ajoutés, renommés, déplacés et supprimés par l'admin.

export const criterionLabel = z.string().trim().min(1, "Le nom est obligatoire.").max(40);
export const optionInput = z.object({ label: z.string().trim().min(1, "Le nom est obligatoire.").max(40), color: z.enum(OPTION_COLORS) });

export async function listCriteria(catalog: Catalog) {
  const rows = await prisma.catalogCriterion.findMany({
    where: { catalog },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { options: { orderBy: [{ position: "asc" }, { id: "asc" }], include: { _count: { select: { items: true } } } } },
  });
  return rows.map((c) => ({
    id: c.id,
    label: c.label,
    options: c.options.map((o) => ({ id: o.id, label: o.label, color: asOptionColor(o.color), used: o._count.items })),
  }));
}
export type CriterionView = Awaited<ReturnType<typeof listCriteria>>[number];

const audit = (actorId: string, action: string, entityId: string, metadata: object) =>
  prisma.auditLog.create({ data: { actorUserId: actorId, action, entityType: "catalogCriterion", entityId, metadata } });

export async function createCriterion(actorId: string, catalog: Catalog, label: string) {
  const position = (await prisma.catalogCriterion.count({ where: { catalog } })) + 1;
  const c = await prisma.catalogCriterion.create({ data: { catalog, label, position } });
  await audit(actorId, "CATALOG_CRITERION_CREATED", c.id, { catalog, label });
  return c;
}

export async function renameCriterion(actorId: string, id: string, label: string) {
  await prisma.catalogCriterion.update({ where: { id }, data: { label } });
  await audit(actorId, "CATALOG_CRITERION_UPDATED", id, { label });
}

// Supprimer un critère retire aussi ses options des fiches.
export async function deleteCriterion(actorId: string, id: string) {
  const c = await prisma.catalogCriterion.delete({ where: { id } });
  await audit(actorId, "CATALOG_CRITERION_DELETED", id, { label: c.label });
}

export async function moveCriterion(actorId: string, id: string, dir: -1 | 1) {
  const c = await prisma.catalogCriterion.findUniqueOrThrow({ where: { id } });
  const list = await prisma.catalogCriterion.findMany({ where: { catalog: c.catalog }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((x, k) => prisma.catalogCriterion.update({ where: { id: x.id }, data: { position: k + 1 } })));
  await audit(actorId, "CATALOG_CRITERION_MOVED", id, { dir });
}

export async function createOption(actorId: string, criterionId: string, input: z.infer<typeof optionInput>) {
  const position = (await prisma.catalogOption.count({ where: { criterionId } })) + 1;
  const o = await prisma.catalogOption.create({ data: { criterionId, label: input.label, color: input.color, position } });
  await audit(actorId, "CATALOG_OPTION_CREATED", o.id, { criterionId, label: input.label });
  return o;
}

export async function updateOption(actorId: string, id: string, input: z.infer<typeof optionInput>) {
  await prisma.catalogOption.update({ where: { id }, data: { label: input.label, color: input.color } });
  await audit(actorId, "CATALOG_OPTION_UPDATED", id, input);
}

export async function deleteOption(actorId: string, id: string) {
  const o = await prisma.catalogOption.delete({ where: { id } });
  await audit(actorId, "CATALOG_OPTION_DELETED", id, { label: o.label });
}

export async function moveOption(actorId: string, id: string, dir: -1 | 1) {
  const o = await prisma.catalogOption.findUniqueOrThrow({ where: { id } });
  const list = await prisma.catalogOption.findMany({ where: { criterionId: o.criterionId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((x, k) => prisma.catalogOption.update({ where: { id: x.id }, data: { position: k + 1 } })));
  await audit(actorId, "CATALOG_OPTION_MOVED", id, { dir });
}
