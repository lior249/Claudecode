import type { Measurements } from "@/server/practice/checks";
import type { CriterionResult } from "@/server/practice/scoring";

// Contrat d'un correcteur IA. Il renvoie des critères (points perdus + commentaire), jamais un statut.
export interface AIEvaluationInput {
  lessonTitle: string;
  instructions: string; // consigne affichée à l'élève
  rubric: string; // barème en texte libre (Admin)
  measuredCriteria: CriterionResult[]; // déjà évalués par le serveur : l'IA ne les recompte pas
  measurements: Measurements;
  text: string | null;
  media: { path: string; mimeType: string; originalName: string }[];
}

export interface AIEvaluation {
  criteria: { name: string; maxPoints: number; pointsLost: number; comment: string }[];
  feedback: string;
  model: string;
  raw: unknown;
}

export interface AIProvider {
  evaluate(input: AIEvaluationInput): Promise<AIEvaluation>;
}

export class AIError extends Error {}
