import { describe, expect, it } from "vitest";
import { measureText, shotsFromCuts } from "./analysis";
import { isPracticeReady, parsePracticeConfig } from "./config";
import { computeScore, pointsLost } from "./scoring";
import { firstSentence, textSimilarity } from "./text";

describe("note sur 10 (calculée par le serveur)", () => {
  it("points retirés = nombre d'erreurs × points par erreur, sans plafond", () => {
    expect(pointsLost(3, 2)).toBe(6);
    expect(pointsLost(6, 2)).toBe(12);
    expect(pointsLost(-1, 2)).toBe(0);
    expect(pointsLost(1.7, 2)).toBe(2); // l'agent ne peut pas renvoyer de demi-erreur
  });
  it("8/10 = réussite, 7,5/10 = échec, jamais sous 0", () => {
    expect(computeScore([{ pointsLost: 2 }], 8)).toEqual({ score: 8, passed: true });
    expect(computeScore([{ pointsLost: 1 }, { pointsLost: 1.5 }], 8)).toEqual({ score: 7.5, passed: false });
    expect(computeScore([{ pointsLost: 12 }], 8)).toEqual({ score: 0, passed: false });
  });
});

describe("configuration d'un exercice", () => {
  it("prêt seulement avec une consigne pour l'agent et au moins un critère", () => {
    expect(isPracticeReady(parsePracticeConfig({}))).toBe(false);
    expect(isPracticeReady(parsePracticeConfig({ agentInstructions: "x" }))).toBe(false);
    expect(isPracticeReady(parsePracticeConfig({ agentInstructions: "x", criteria: [{ id: "a", instruction: "y", pointsPerMiss: 2 }] }))).toBe(true);
  });
  it("4 critères maximum ; une ancienne configuration devient « pas prêt »", () => {
    const c = { id: "a", instruction: "y", pointsPerMiss: 1 };
    expect(isPracticeReady(parsePracticeConfig({ agentInstructions: "x", criteria: [c, c, c, c, c] }))).toBe(false);
    expect(parsePracticeConfig({ rubric: "ancien format", checks: [{ type: "cuts" }] }).criteria).toEqual([]);
  });
});

describe("mesures exactes", () => {
  it("plans calculés à partir des cuts", () => {
    expect(shotsFromCuts([3, 5], 9)).toEqual([
      { start: 0, end: 3, duration: 3 },
      { start: 3, end: 5, duration: 2 },
      { start: 5, end: 9, duration: 4 },
    ]);
  });
  it("ressemblance de texte et première phrase (transcription, hook)", () => {
    expect(textSimilarity("Il est IMPOSSIBLE, pour un pilote !", "il est impossible pour un pilote")).toBe(1);
    const ref = "Il est impossible pour un pilote de survivre. Pourtant certains y arrivent tous les jours.";
    const m = measureText("Il est impossible pour un pilote de survivre. Certains y arrivent.", ref);
    expect(m.reference).toMatchObject({ firstSentenceIdentical: true, wordCount: 15 });
    expect(m.reference!.similarityPercent).toBeLessThan(96);
    expect(firstSentence("Phrase un. Phrase deux.")).toBe("Phrase un.");
    expect(measureText("abc", "")).toEqual({ wordCount: 1 });
  });
});
