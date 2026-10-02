import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getLearnerProgression, getUnlockedWhopLinks } from "@/server/learn/service";
import { getQuizState, QuizError } from "@/server/quizzes/service";
import { prisma } from "@/server/db";
import { QuizPlayer } from "@/components/quiz/quiz-player";

export default async function QuizPage({ params }: PageProps<"/learn/quiz/[lessonId]">) {
  const user = await requireUser();
  const { lessonId } = await params;

  const { progression } = await getLearnerProgression(user.id);
  const lesson = progression.levels.flatMap((l) => l.modules.flatMap((m) => m.lessons.map((x) => ({ ...x, moduleId: m.id }))))
    .find((x) => x.id === lessonId);
  if (!lesson || lesson.type !== "UNDERSTANDING") notFound();
  if (lesson.status === "LOCKED") redirect("/learn");

  let state;
  try {
    state = await getQuizState(user.id, lessonId);
  } catch (e) {
    if (e instanceof QuizError) notFound();
    throw e;
  }
  const whop = await getUnlockedWhopLinks(progression);
  const moduleTitle = (await prisma.module.findUnique({ where: { id: lesson.moduleId }, select: { title: true } }))?.title ?? "";

  return <QuizPlayer state={state} moduleTitle={moduleTitle} whopUrl={whop[lesson.moduleId] ?? null} />;
}
