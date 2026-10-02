import { describe, expect, it } from "vitest";
import { evaluateCheck } from "./checks";
import { parsePracticeConfig } from "./config";
import { computeScore } from "./scoring";
import { firstSentence, textSimilarity } from "./text";

const cutsCheck = parsePracticeConfig({ checks: [{ type: "cuts", expected: [3, 5, 8, 13] }] }).checks[0];
const silencesCheck = parsePracticeConfig({ checks: [{ type: "silences" }] }).checks[0];

describe("note sur 10", () => {
  it("8/10 = réussite, 7,9/10 = échec", () => {
    const c = (lost: number) => [{ name: "x", maxPoints: 10, pointsLost: lost, comment: "", source: "AI" as const }];
    expect(computeScore(c(2), 8)).toEqual({ score: 8, passed: true });
    expect(computeScore(c(2.1), 8)).toEqual({ score: 7.9, passed: false });
    expect(computeScore(c(15), 8)).toEqual({ score: 0, passed: false });
  });
  it("une IA qui retire plus que le maximum d'un critère est plafonnée", () => {
    expect(computeScore([{ name: "x", maxPoints: 1, pointsLost: 9, comment: "", source: "AI" }], 8).score).toBe(9);
  });
});

describe("exercice Cuts (3 s, 5 s, 8 s, 13 s ± 0,5 s, −2 par cut raté)", () => {
  it("4 cuts justes : 0 point perdu", () => {
    expect(evaluateCheck(cutsCheck, { cuts: [3.1, 4.6, 8.4, 13] }, null).pointsLost).toBe(0);
  });
  it("1 cut raté = 8/10 (validé), 2 ratés = 6/10", () => {
    const one = evaluateCheck(cutsCheck, { cuts: [3, 5, 8, 14] }, null);
    expect(one.pointsLost).toBe(2);
    expect(one.comment).toContain("13 s");
    expect(evaluateCheck(cutsCheck, { cuts: [3, 6, 8, 14] }, null).pointsLost).toBe(4);
  });
  it("0,5 s pile reste dans la tolérance", () => {
    expect(evaluateCheck(cutsCheck, { cuts: [2.5, 5.5, 8, 13] }, null).pointsLost).toBe(0);
  });
  it("vidéo avec du son : pénalité", () => {
    const noAudio = parsePracticeConfig({ checks: [{ type: "noAudio" }] }).checks[0];
    expect(evaluateCheck(noAudio, { hasAudio: true }, null).pointsLost).toBe(10);
    expect(evaluateCheck(noAudio, { hasAudio: false }, null).pointsLost).toBe(0);
  });
});

describe("exercice Voix off (−1 par silence de 0,5 s ou plus)", () => {
  it("0,49 s toléré, 0,5 s compté", () => {
    const r = evaluateCheck(silencesCheck, { silences: [{ start: 1, end: 1.49, duration: 0.49 }, { start: 4, end: 4.5, duration: 0.5 }, { start: 9, end: 10.2, duration: 1.2 }] }, null);
    expect(r.pointsLost).toBe(2);
  });
});

describe("textes", () => {
  it("ressemblance insensible à la casse, aux accents et à la ponctuation", () => {
    expect(textSimilarity("Il est IMPOSSIBLE, pour un pilote !", "il est impossible pour un pilote")).toBe(1);
    expect(textSimilarity("un deux trois quatre", "un deux trois cinq")).toBe(0.75);
  });
  it("transcription : 96 % minimum", () => {
    const ref = Array.from({ length: 50 }, (_, i) => `mot${i}`).join(" ");
    const check = parsePracticeConfig({ checks: [{ type: "textSimilarity", reference: ref }] }).checks[0];
    const twoErrors = ref.replace("mot1 ", "x ").replace("mot2 ", "y ");
    const threeErrors = twoErrors.replace("mot3 ", "z ");
    expect(evaluateCheck(check, {}, twoErrors).pointsLost).toBe(0); // 96 %
    expect(evaluateCheck(check, {}, threeErrors).pointsLost).toBe(10); // 94 %
  });
  it("hook intact et script réduit", () => {
    const hook = "Il est impossible pour un pilote de survivre à un barrel roll.";
    expect(firstSentence(`${hook} Et pourtant.`)).toBe(hook);
    const hookCheck = parsePracticeConfig({ checks: [{ type: "hookUnchanged", hook }] }).checks[0];
    expect(evaluateCheck(hookCheck, {}, `${hook} Court.`).pointsLost).toBe(0);
    expect(evaluateCheck(hookCheck, {}, `Un pilote ne survit pas. Court.`).pointsLost).toBe(5);
  });
});
