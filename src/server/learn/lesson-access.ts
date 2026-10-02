import "server-only";
import { notFound, redirect } from "next/navigation";
import type { LessonType } from "@/generated/prisma/enums";
import { getLearnerProgression, getUnlockedWhopLinks } from "./service";

// Pour les pages d'exercice : la leçon doit exister, être du bon type et ne pas être verrouillée.
export async function loadOpenLesson(userId: string, lessonId: string, type: LessonType) {
  const { progression } = await getLearnerProgression(userId);
  const found = progression.levels
    .flatMap((l) => l.modules.map((m) => ({ m, lesson: m.lessons.find((x) => x.id === lessonId) })))
    .find((x) => x.lesson);
  if (!found?.lesson || found.lesson.type !== type) notFound();
  if (found.lesson.status === "LOCKED") redirect("/learn");
  const whop = await getUnlockedWhopLinks(progression);
  return { lesson: found.lesson, moduleId: found.m.id, moduleTitle: found.m.title, whopUrl: whop[found.m.id] ?? null };
}
