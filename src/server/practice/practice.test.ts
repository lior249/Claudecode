import { describe, expect, it } from "vitest";
import { isPracticeReady, parsePracticeConfig } from "./config";
import { computeScore, pointsLost } from "./scoring";

describe("note sur 10 (calculée par le serveur)", () => {
  it("points retirés = nombre d'erreurs × points par erreur, sans plafond", () => {
    expect(pointsLost(3, 2)).toBe(6);
    expect(pointsLost(6, 2)).toBe(12);
    expect(pointsLost(-1, 2)).toBe(0);
    expect(pointsLost(1.7, 2)).toBe(2); // pas de demi-erreur
  });
  it("8/10 = réussite, 7,5/10 = échec, jamais sous 0", () => {
    expect(computeScore([{ pointsLost: 2 }], 8)).toEqual({ score: 8, passed: true });
    expect(computeScore([{ pointsLost: 1 }, { pointsLost: 1.5 }], 8)).toEqual({ score: 7.5, passed: false });
    expect(computeScore([{ pointsLost: 12 }], 8)).toEqual({ score: 0, passed: false });
  });
});

describe("configuration d'un exercice", () => {
  it("prêt seulement avec au moins un critère", () => {
    expect(isPracticeReady(parsePracticeConfig({}))).toBe(false);
    expect(isPracticeReady(parsePracticeConfig({ criteria: [{ id: "a", instruction: "y", pointsPerMiss: 2 }] }))).toBe(true);
  });
  it("3 critères maximum ; une ancienne configuration devient « pas prêt »", () => {
    const c = { id: "a", instruction: "y", pointsPerMiss: 1 };
    expect(isPracticeReady(parsePracticeConfig({ criteria: [c, c, c] }))).toBe(true);
    expect(isPracticeReady(parsePracticeConfig({ criteria: [c, c, c, c] }))).toBe(false);
    expect(parsePracticeConfig({ rubric: "ancien format", checks: [{ type: "cuts" }] }).criteria).toEqual([]);
  });
});
