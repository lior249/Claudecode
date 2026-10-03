import "server-only";
import { prisma } from "@/server/db";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";
import type { Catalog } from "@/generated/prisma/enums";
import { asOptionColor, catalogOfLesson, parseKeys, parseLinks, type CatalogTag } from "./catalog";

export class DecisionError extends Error {}

async function loadDecisionLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.type !== "DECISION") throw new DecisionError("Décision introuvable.");
  const catalog = catalogOfLesson(lesson.config);
  if (!catalog) throw new DecisionError("Cette décision n'est pas encore prête.");
  return { lesson, catalog };
}

// À inclure dans les requêtes de fiches : les options retenues et leur critère.
export const ITEM_TAGS = { options: { include: { option: { include: { criterion: true } } } } } as const;

type TaggedOption = { option: { label: string; color: string; position: number; criterion: { label: string; position: number } } };

// Pastilles d'une fiche, dans l'ordre des critères puis des options.
export function itemTags(options: TaggedOption[]): CatalogTag[] {
  return [...options]
    .sort((a, b) => a.option.criterion.position - b.option.criterion.position || a.option.position - b.option.position)
    .map(({ option: o }) => ({ criterion: o.criterion.label, label: o.label, color: asOptionColor(o.color) }));
}

export function toItemView(item: {
  id: string;
  title: string;
  summary: string;
  body: string;
  options: TaggedOption[];
  thumbnailKey: string | null;
  imageKeys: unknown;
  links: unknown;
}) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    tags: itemTags(item.options),
    thumbnailUrl: item.thumbnailKey ? fileUrl(item.thumbnailKey) : null,
    imageUrls: parseKeys(item.imageKeys).map(fileUrl),
    links: parseLinks(item.links),
  };
}
export type CatalogItemView = ReturnType<typeof toItemView>;

// Les images du catalogue sont servies par /api/files (connexion requise).
export function fileUrl(key: string) {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function getDecisionView(userId: string, lessonId: string) {
  const { lesson, catalog } = await loadDecisionLesson(lessonId);
  const [items, choice] = [
    await prisma.catalogItem.findMany({ where: { catalog, isPublished: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: ITEM_TAGS }),
    await prisma.decisionResponse.findUnique({ where: { userId_lessonId: { userId, lessonId } } }),
  ];
  return {
    lessonId,
    title: lesson.title,
    summary: lesson.summary,
    catalog: catalog as Catalog,
    items: items.map(toItemView),
    chosen: choice ? { itemId: choice.catalogItemId, title: choice.itemTitle, chosenAt: choice.chosenAt.toISOString() } : null,
  };
}

export async function getCatalogItemForLesson(lessonId: string, itemId: string) {
  const { catalog } = await loadDecisionLesson(lessonId);
  const item = await prisma.catalogItem.findFirst({ where: { id: itemId, catalog, isPublished: true }, include: ITEM_TAGS });
  return item ? toItemView(item) : null;
}

// Choix unique et définitif : valide la leçon.
export async function chooseCatalogItem(userId: string, lessonId: string, itemId: string) {
  try {
    await assertCanStartLesson(userId, lessonId);
  } catch (e) {
    if (e instanceof LessonLockedError) throw new DecisionError(e.message);
    throw e;
  }
  const { catalog } = await loadDecisionLesson(lessonId);
  const item = await prisma.catalogItem.findFirst({ where: { id: itemId, catalog, isPublished: true } });
  if (!item) throw new DecisionError("Ce choix n'est plus disponible.");

  try {
    await prisma.decisionResponse.create({ data: { userId, lessonId, catalogItemId: item.id, itemTitle: item.title } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new DecisionError("Tu as déjà fait ton choix.");
    throw e;
  }
  await prisma.auditLog.create({
    data: { actorUserId: userId, action: "DECISION_MADE", entityType: "lesson", entityId: lessonId, metadata: { catalog, itemId: item.id, title: item.title } },
  });
  await completeLesson(userId, lessonId, null);
}
