import { requireUser } from "@/server/auth/session";
import { loadOpenLesson } from "@/server/learn/lesson-access";
import { getDecisionView } from "@/server/decisions/service";
import { DecisionList } from "@/components/decision/decision-list";

export default async function DecisionPage({ params }: PageProps<"/learn/decision/[lessonId]">) {
  const user = await requireUser();
  const { lessonId } = await params;
  const { moduleTitle, whopUrl } = await loadOpenLesson(user.id, lessonId, "DECISION");
  const view = await getDecisionView(user.id, lessonId);
  return <DecisionList view={view} moduleTitle={moduleTitle} whopUrl={whopUrl} />;
}
