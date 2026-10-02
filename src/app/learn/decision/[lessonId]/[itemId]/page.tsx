import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { loadOpenLesson } from "@/server/learn/lesson-access";
import { getCatalogItemForLesson, getDecisionView } from "@/server/decisions/service";
import { CatalogItemPage } from "@/components/decision/catalog-item-page";

export default async function DecisionItemPage({ params }: PageProps<"/learn/decision/[lessonId]/[itemId]">) {
  const user = await requireUser();
  const { lessonId, itemId } = await params;
  await loadOpenLesson(user.id, lessonId, "DECISION");
  const item = await getCatalogItemForLesson(lessonId, itemId);
  if (!item) notFound();
  const view = await getDecisionView(user.id, lessonId);
  return <CatalogItemPage item={item} lessonId={lessonId} catalog={view.catalog} chosen={view.chosen} />;
}
