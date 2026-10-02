import { AIError, type AIAnalysis, type Analyst, type AnalyzeInput, type Grader, type GradeInput, type Grading } from "./types";

// IA simulée (développement / tests).
// Analyste : décrit les plans à partir des mesures ffmpeg.
// Correcteur : aucune erreur, sauf si un nom de fichier ou le texte contient « [FAIL] » (1 erreur sur chaque critère).
// « [PANNE] » simule une panne.

export class MockAnalyst implements Analyst {
  async analyze(input: AnalyzeInput): Promise<AIAnalysis> {
    if (input.media.originalName.includes("[PANNE]")) throw new AIError("panne simulée (analyste)");
    const m = input.measurements;
    return {
      summary: `Simulation (${input.media.originalName}) : ${m.shots.length} plan(s), ${m.durationSeconds.toFixed(1)} s, ${m.hasAudio ? "avec" : "sans"} son.`,
      transcript: [],
      shots: m.shots.map((s, i) => ({ ...s, description: `Plan ${i + 1} (simulation)` })),
      soundEvents: [],
      onScreenText: [],
      comparisonWithReference: input.reference ? "Simulation : comparaison non réalisée." : "",
      model: "mock-analyst",
    };
  }
}

export class MockGrader implements Grader {
  async grade(input: GradeInput): Promise<Grading> {
    const haystack = [input.text ?? "", input.report.ai?.summary ?? ""].join(" ");
    if (haystack.includes("[PANNE]")) throw new AIError("panne simulée (correcteur)");
    const fail = haystack.includes("[FAIL]");
    return {
      criteria: input.criteria.map((c) => ({
        criterionId: c.id,
        misses: fail ? 1 : 0,
        evidence: fail ? [{ time: null, detail: "Erreur simulée." }] : [],
        comment: fail ? "Critère non respecté (simulation)." : "Respecté (simulation).",
      })),
      feedback: fail ? "Simulation : reprends les points signalés et renvoie une nouvelle réalisation." : "Simulation : bon travail !",
      model: "mock-grader",
    };
  }
}
