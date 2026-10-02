import { requireUser } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { getLearnerProgression, getUnlockedWhopLinks } from "@/server/learn/service";
import { LearnView, type LearnViewData } from "@/components/learn/learn-view";

export default async function LearnPage() {
  const user = await requireUser();
  const { curriculum, progression } = await getLearnerProgression(user.id);
  const whop = await getUnlockedWhopLinks(progression);

  // Seules les données affichables partent au navigateur (pas de barème, pas de code, pas de lien verrouillé).
  const meta = new Map(
    curriculum.flatMap((l) => l.modules.flatMap((m) => [[m.id, m.description] as const, ...m.lessons.map((x) => [x.id, x.summary] as const)])),
  );
  const data: LearnViewData = {
    displayName: user.displayName,
    rank: progression.rank,
    percent: progression.percent,
    completedLessons: progression.completedLessons,
    totalLessons: progression.totalLessons,
    learnCompleted: progression.learnCompleted,
    currentLessonId: progression.currentLessonId,
    devTools: getEnv().devLoginEnabled,
    isAdmin: user.role === "ADMIN",
    levels: progression.levels.map((level) => ({
      id: level.id,
      title: level.title,
      position: level.position,
      status: level.status,
      modules: level.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: meta.get(m.id) ?? "",
        status: m.status,
        whopUrl: whop[m.id] ?? null,
        lessons: m.lessons.map((x) => ({
          id: x.id,
          title: x.title,
          summary: meta.get(x.id) ?? "",
          type: x.type,
          status: x.status,
          deadlineAt: x.deadlineAt?.toISOString() ?? null,
          completedAt: x.completedAt?.toISOString() ?? null,
        })),
      })),
    })),
  };

  return <LearnView data={data} />;
}
