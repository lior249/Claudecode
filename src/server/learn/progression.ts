// Calcul pur de la progression Learn. Aucune requête, aucune date implicite : tout est passé en entrée.
// Règles : parcours strictement linéaire (niveau → module → leçon, par position),
// une validation acquise reste acquise, le verrouillage est dérivé et jamais stocké.

import type { LessonType } from "@/generated/prisma/enums";

export const LESSON_DEADLINE_MS = 24 * 60 * 60 * 1000;
export const DEADLINE_REMINDER_MS = 4 * 60 * 60 * 1000;

export type Rank = "E" | "D" | "C" | "B" | "A" | "S" | "SS" | "SSS";
const AUTO_RANKS: Rank[] = ["E", "D", "C", "B"];

export type Status = "COMPLETED" | "AVAILABLE" | "LOCKED";

export interface CurriculumLesson {
  id: string;
  title: string;
  type: LessonType;
  position: number;
}
export interface CurriculumModule {
  id: string;
  title: string;
  position: number;
  lessons: CurriculumLesson[];
}
export interface CurriculumLevel {
  id: string;
  title: string;
  position: number;
  modules: CurriculumModule[];
}

export interface ProgressionInput {
  levels: CurriculumLevel[];
  completions: { lessonId: string; completedAt: Date }[];
  learnStartedAt: Date | null;
  manualRank?: Exclude<Rank, "E" | "D" | "C" | "B"> | null;
  // Rang plancher (coachs et admins : au moins le rang de fin de formation).
  minRank?: Rank;
  now: Date;
}

export interface LessonState extends CurriculumLesson {
  status: Status;
  unlockedAt: Date | null;
  completedAt: Date | null;
  deadlineAt: Date | null;
  overdue: boolean; // leçon en cours dont les 24 h sont dépassées
}
export interface ModuleState {
  id: string;
  title: string;
  position: number;
  status: Status;
  lessons: LessonState[];
}
export interface LevelState {
  id: string;
  title: string;
  position: number;
  status: Status;
  modules: ModuleState[];
}

// Décrochage : une leçon restée ouverte plus de 24 h (signalée en rouge au coach).
export interface LateRemark {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  previousLessonTitle: string | null;
  previousModuleTitle: string | null;
  unlockedAt: Date;
  endedAt: Date; // date de validation, ou maintenant si toujours en cours
  durationMs: number;
  ongoing: boolean;
}

export interface Progression {
  levels: LevelState[];
  currentLessonId: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  completedLevels: number;
  rank: Rank;
  learnCompleted: boolean;
  lateRemarks: LateRemark[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function computeProgression(input: ProgressionInput): Progression {
  const completedAt = new Map(input.completions.map((c) => [c.lessonId, c.completedAt]));

  // Ordre global ; les modules sans leçon sont ignorés (ils ne bloquent personne).
  const levels = [...input.levels].sort(byPosition).map((level) => ({
    ...level,
    modules: [...level.modules]
      .sort(byPosition)
      .map((mod) => ({ ...mod, lessons: [...mod.lessons].sort(byPosition) }))
      .filter((mod) => mod.lessons.length > 0),
  })).filter((level) => level.modules.length > 0);

  let currentLessonId: string | null = null;
  let previous: { lesson: LessonState; moduleTitle: string } | null = null;
  const lateRemarks: LateRemark[] = [];
  let total = 0;
  let done = 0;

  const levelStates: LevelState[] = levels.map((level) => {
    const modules: ModuleState[] = level.modules.map((mod) => {
      const lessons: LessonState[] = mod.lessons.map((lesson) => {
        total++;
        const doneAt = completedAt.get(lesson.id) ?? null;
        let status: Status;
        if (doneAt) {
          status = "COMPLETED";
          done++;
        } else if (currentLessonId === null) {
          status = "AVAILABLE";
          currentLessonId = lesson.id;
        } else {
          status = "LOCKED";
        }

        // Une leçon s'ouvre quand la précédente est validée (ou au début du Learn pour la première).
        const unlockedAt =
          status === "LOCKED" ? null : previous ? previous.lesson.completedAt : input.learnStartedAt;
        const deadlineAt = unlockedAt ? new Date(unlockedAt.getTime() + LESSON_DEADLINE_MS) : null;
        const overdue = status === "AVAILABLE" && deadlineAt !== null && input.now > deadlineAt;

        const state: LessonState = { ...lesson, status, unlockedAt, completedAt: doneAt, deadlineAt, overdue };

        if (unlockedAt && status !== "LOCKED") {
          const endedAt = doneAt ?? input.now;
          const durationMs = endedAt.getTime() - unlockedAt.getTime();
          if (durationMs > LESSON_DEADLINE_MS) {
            lateRemarks.push({
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              moduleTitle: mod.title,
              previousLessonTitle: previous?.lesson.title ?? null,
              previousModuleTitle: previous?.moduleTitle ?? null,
              unlockedAt,
              endedAt,
              durationMs,
              ongoing: !doneAt,
            });
          }
        }

        previous = { lesson: state, moduleTitle: mod.title };
        return state;
      });
      return { id: mod.id, title: mod.title, position: mod.position, status: aggregate(lessons), lessons };
    });
    return { id: level.id, title: level.title, position: level.position, status: aggregate(modules), modules };
  });

  const completedLevels = levelStates.filter((l) => l.status === "COMPLETED").length;
  const autoRank = AUTO_RANKS[Math.min(completedLevels, AUTO_RANKS.length - 1)];

  return {
    levels: levelStates,
    currentLessonId,
    totalLessons: total,
    completedLessons: done,
    percent: total === 0 ? 0 : Math.floor((done / total) * 100),
    completedLevels,
    rank: input.manualRank ?? (input.minRank && AUTO_RANKS.indexOf(input.minRank) > AUTO_RANKS.indexOf(autoRank) ? input.minRank : autoRank),
    learnCompleted: total > 0 && done === total,
    lateRemarks,
  };
}

function aggregate(children: { status: Status }[]): Status {
  if (children.every((c) => c.status === "COMPLETED")) return "COMPLETED";
  if (children.some((c) => c.status !== "LOCKED")) return "AVAILABLE";
  return "LOCKED";
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} j`);
  if (hours) parts.push(`${hours} h`);
  if (!days && minutes) parts.push(`${minutes} min`);
  return parts.join(" ") || "moins d'une minute";
}
