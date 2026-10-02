import type { AIEvaluation, AIEvaluationInput, AIProvider } from "./types";
import { AIError } from "./types";

// IA simulée (développement / tests) : valide tout, sauf si un fichier ou le texte contient « [FAIL] ».
// « [PANNE] » simule une panne de l'IA.
export class MockAIProvider implements AIProvider {
  async evaluate(input: AIEvaluationInput): Promise<AIEvaluation> {
    const haystack = [input.text ?? "", ...input.media.map((m) => m.originalName)].join(" ");
    if (haystack.includes("[PANNE]")) throw new AIError("panne simulée");
    const fail = haystack.includes("[FAIL]");
    return {
      criteria: [
        {
          name: "Barème de l'exercice (IA simulée)",
          maxPoints: 5,
          pointsLost: fail ? 3 : 0,
          comment: fail ? "Critère important non respecté (simulation)." : "Les critères du barème sont respectés (simulation).",
        },
      ],
      feedback: fail ? "Simulation : reprends les points signalés et renvoie une nouvelle réalisation." : "Simulation : bon travail !",
      model: "mock",
      raw: { simulated: true },
    };
  }
}
