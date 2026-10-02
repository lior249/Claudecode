import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getLearnerProgression, getUnlockedWhopLinks } from "@/server/learn/service";
import { getPracticeView } from "@/server/practice/service";
import { PracticeScreen } from "@/components/practice/practice-screen";

export default async function PracticePage({ params }: PageProps<"/learn/practice/[lessonId]">) {
  const user = await requireUser();
  const { lessonId } = await params;
  const { progression } = await getLearnerProgression(user.id);
  const found = progression.levels
    .flatMap((l) => l.modules.map((m) => ({ m, lesson: m.lessons.find((x) => x.id === lessonId) })))
    .find((x) => x.lesson);
  if (!found?.lesson || found.lesson.type !== "PRACTICE_AI") notFound();
  if (found.lesson.status === "LOCKED") redirect("/learn");

  const view = await getPracticeView(user.id, lessonId);
  const whop = await getUnlockedWhopLinks(progression);
  return <PracticeScreen view={view} moduleTitle={found.m.title} whopUrl={whop[found.m.id] ?? null} />;
}
