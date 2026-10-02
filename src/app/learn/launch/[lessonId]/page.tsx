import { requireUser } from "@/server/auth/session";
import { loadOpenLesson } from "@/server/learn/lesson-access";
import { getLaunchView } from "@/server/launch/service";
import { LaunchFlow } from "@/components/launch/launch-flow";

export default async function LaunchPage({ params }: PageProps<"/learn/launch/[lessonId]">) {
  const user = await requireUser();
  const { lessonId } = await params;
  const { moduleTitle, whopUrl } = await loadOpenLesson(user.id, lessonId, "CODE_VALIDATION");
  const view = await getLaunchView(user.id, lessonId);
  return <LaunchFlow view={view} moduleTitle={moduleTitle} whopUrl={whopUrl} />;
}
