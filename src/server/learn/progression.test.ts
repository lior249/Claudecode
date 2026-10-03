import { describe, expect, it } from "vitest";
import { computeProgression, formatDuration, type CurriculumLevel } from "./progression";

const H = 60 * 60 * 1000;
const t0 = new Date("2026-10-01T10:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * H);

// 2 niveaux : N1 (M1: a, b ; M2: c) ; N2 (M3: d)
const levels: CurriculumLevel[] = [
  {
    id: "N2", title: "Positionnement", position: 2,
    modules: [{ id: "M3", title: "Niche", position: 1, lessons: [{ id: "d", title: "Choix", type: "DECISION", position: 1 }] }],
  },
  {
    id: "N1", title: "Les bases", position: 1,
    modules: [
      { id: "M2", title: "Scripting", position: 2, lessons: [{ id: "c", title: "Transcription", type: "PRACTICE_AI", position: 1 }] },
      {
        id: "M1", title: "Montage", position: 1,
        lessons: [
          { id: "b", title: "Voix off", type: "PRACTICE_AI", position: 2 },
          { id: "a", title: "Cuts", type: "PRACTICE_AI", position: 1 },
        ],
      },
      { id: "EMPTY", title: "Vide", position: 3, lessons: [] },
    ],
  },
];

const statuses = (p: ReturnType<typeof computeProgression>) =>
  Object.fromEntries(p.levels.flatMap((l) => l.modules.flatMap((m) => m.lessons.map((x) => [x.id, x.status]))));

describe("computeProgression", () => {
  it("ouvre uniquement la première leçon au départ", () => {
    const p = computeProgression({ levels, completions: [], learnStartedAt: t0, now: at(1) });
    expect(statuses(p)).toEqual({ a: "AVAILABLE", b: "LOCKED", c: "LOCKED", d: "LOCKED" });
    expect(p.currentLessonId).toBe("a");
    expect(p.rank).toBe("E");
    expect(p.percent).toBe(0);
    expect(p.levels[0].modules.map((m) => m.id)).toEqual(["M1", "M2"]); // module vide ignoré
  });

  it("une validation débloque la leçon suivante, puis le module suivant", () => {
    const p = computeProgression({
      levels,
      completions: [{ lessonId: "a", completedAt: at(2) }, { lessonId: "b", completedAt: at(3) }],
      learnStartedAt: t0,
      now: at(4),
    });
    expect(statuses(p)).toEqual({ a: "COMPLETED", b: "COMPLETED", c: "AVAILABLE", d: "LOCKED" });
    expect(p.levels[0].modules[0].status).toBe("COMPLETED");
    expect(p.levels[0].modules[1].status).toBe("AVAILABLE");
    expect(p.levels[1].status).toBe("LOCKED");
    expect(p.percent).toBe(50);
  });

  it("fin d'un niveau = rang D, fin du Learn = rang C ici et learnCompleted", () => {
    const n1 = computeProgression({
      levels,
      completions: ["a", "b", "c"].map((id, i) => ({ lessonId: id, completedAt: at(i + 1) })),
      learnStartedAt: t0,
      now: at(5),
    });
    expect(n1.rank).toBe("D");
    expect(n1.levels[1].status).toBe("AVAILABLE");

    const all = computeProgression({
      levels,
      completions: ["a", "b", "c", "d"].map((id, i) => ({ lessonId: id, completedAt: at(i + 1) })),
      learnStartedAt: t0,
      now: at(5),
    });
    expect(all.learnCompleted).toBe(true);
    expect(all.rank).toBe("C");
    expect(all.currentLessonId).toBeNull();
  });

  it("une validation acquise reste acquise même si une leçon est insérée avant", () => {
    const p = computeProgression({
      levels,
      completions: [{ lessonId: "b", completedAt: at(2) }],
      learnStartedAt: t0,
      now: at(3),
    });
    expect(statuses(p)).toEqual({ a: "AVAILABLE", b: "COMPLETED", c: "LOCKED", d: "LOCKED" });
  });

  it("coach ou admin : rang plancher B même sans formation terminée", () => {
    expect(computeProgression({ levels, completions: [], learnStartedAt: t0, minRank: "B", now: at(1) }).rank).toBe("B");
    expect(computeProgression({ levels, completions: [], learnStartedAt: t0, minRank: "B", manualRank: "A", now: at(1) }).rank).toBe("A");
  });

  it("le rang manuel (A–SSS) prime sur le rang calculé", () => {
    const p = computeProgression({ levels, completions: [], learnStartedAt: t0, manualRank: "S", now: at(1) });
    expect(p.rank).toBe("S");
  });

  it("délai de 24 h en continu : échéance, retard en cours et décrochages passés", () => {
    const p = computeProgression({
      levels,
      completions: [{ lessonId: "a", completedAt: at(30) }], // a mis 30 h
      learnStartedAt: t0,
      now: at(30 + 25), // b ouverte depuis 25 h
    });
    const b = p.levels[0].modules[0].lessons[1];
    expect(b.unlockedAt).toEqual(at(30));
    expect(b.deadlineAt).toEqual(at(54));
    expect(b.overdue).toBe(true);
    expect(p.lateRemarks).toHaveLength(2);
    expect(p.lateRemarks[0]).toMatchObject({ lessonId: "a", durationMs: 30 * H, ongoing: false, previousLessonTitle: null });
    expect(p.lateRemarks[1]).toMatchObject({ lessonId: "b", durationMs: 25 * H, ongoing: true, previousLessonTitle: "Cuts" });
  });

  it("pas de remarque sous 24 h", () => {
    const p = computeProgression({
      levels,
      completions: [{ lessonId: "a", completedAt: at(23.9) }],
      learnStartedAt: t0,
      now: at(24),
    });
    expect(p.lateRemarks).toHaveLength(0);
    expect(p.levels[0].modules[0].lessons[1].overdue).toBe(false);
  });
});

describe("formatDuration", () => {
  it("formate en jours, heures et minutes", () => {
    expect(formatDuration(76 * H)).toBe("3 j 4 h");
    expect(formatDuration(25 * H + 30 * 60000)).toBe("1 j 1 h");
    expect(formatDuration(2 * H + 5 * 60000)).toBe("2 h 5 min");
    expect(formatDuration(1000)).toBe("moins d'une minute");
  });
});
