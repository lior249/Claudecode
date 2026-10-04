import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { deleteFile } from "@/server/storage/storage";
import { parseTiers } from "./rules";

// Types de résultats : créés, modifiés, réordonnés et masqués par l'admin.

export class ResultTypeError extends Error {}

const EXAMPLE_KEY = /^(catalog\/[0-9a-f-]{36}\.(jpg|png|webp)|exemples\/[a-z0-9-]+\.(jpg|png|webp))$/;

export const resultTypeInput = z.object({
  id: z.string().max(64).nullable(),
  name: z.string().trim().min(2, "Donne un nom au type de résultat.").max(60),
  instructions: z.string().trim().max(3000),
  exampleKey: z.string().regex(EXAMPLE_KEY).nullable(),
  aiMustHave: z.string().trim().max(3000),
  aiMustNotHave: z.string().trim().max(3000),
  aiIdentifier: z.string().trim().max(300),
  points: z.number().int().min(0, "Les points ne peuvent pas être négatifs.").max(1000),
  metric: z.enum(["NONE", "VIEWS", "REVENUE_EUR", "FOLLOWERS"]),
  tiers: z.array(z.object({ min: z.number().int().min(0), points: z.number().int().min(0).max(1000) })).max(12),
  isActive: z.boolean(),
});
export type ResultTypeInput = z.infer<typeof resultTypeInput>;

export async function saveResultType(actorId: string, input: ResultTypeInput) {
  const { id, tiers, ...data } = input;
  const clean = { ...data, tiers: (input.metric === "NONE" ? [] : parseTiers(tiers)) as unknown as object[] };
  let row;
  if (id) {
    const before = await prisma.resultType.findUnique({ where: { id } });
    if (!before) throw new ResultTypeError("Type introuvable.");
    // Les types spéciaux gardent leur chiffre (euros pour les revenus, abonnés pour le rang A).
    if (before.special !== "NONE" && clean.metric !== before.metric) throw new ResultTypeError("Le chiffre lu d'un type spécial ne peut pas changer.");
    row = await prisma.resultType.update({ where: { id }, data: clean });
    if (before.exampleKey && before.exampleKey !== clean.exampleKey && before.exampleKey.startsWith("catalog/")) await deleteFile(before.exampleKey);
  } else {
    const position = (await prisma.resultType.count()) + 1;
    row = await prisma.resultType.create({ data: { ...clean, position } });
  }
  await prisma.auditLog.create({
    data: { actorUserId: actorId, action: id ? "RESULT_TYPE_UPDATED" : "RESULT_TYPE_CREATED", entityType: "resultType", entityId: row.id, metadata: { name: row.name } },
  });
  return row;
}

// Un type déjà utilisé (ou spécial) n'est pas supprimé : il est seulement masqué.
export async function deleteResultType(actorId: string, id: string) {
  const t = await prisma.resultType.findUnique({ where: { id }, include: { _count: { select: { posts: true } } } });
  if (!t) throw new ResultTypeError("Type introuvable.");
  if (t.special !== "NONE") throw new ResultTypeError("Ce type spécial ne peut pas être supprimé : masque-le si tu ne veux plus l'utiliser.");
  if (t._count.posts > 0) {
    await prisma.resultType.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({ data: { actorUserId: actorId, action: "RESULT_TYPE_HIDDEN", entityType: "resultType", entityId: id, metadata: { name: t.name } } });
    return { hidden: true };
  }
  await prisma.resultType.delete({ where: { id } });
  if (t.exampleKey?.startsWith("catalog/")) await deleteFile(t.exampleKey);
  await prisma.auditLog.create({ data: { actorUserId: actorId, action: "RESULT_TYPE_DELETED", entityType: "resultType", entityId: id, metadata: { name: t.name } } });
  return { hidden: false };
}

export async function moveResultType(actorId: string, id: string, dir: -1 | 1) {
  const list = await prisma.resultType.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((x, k) => prisma.resultType.update({ where: { id: x.id }, data: { position: k + 1 } })));
  await prisma.auditLog.create({ data: { actorUserId: actorId, action: "RESULT_TYPE_MOVED", entityType: "resultType", entityId: id, metadata: { dir } } });
}
