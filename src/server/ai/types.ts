import type { PracticeCriterion } from "@/server/practice/config";
import type { MediaMeasurements, TextMeasurements } from "@/server/practice/analysis";

// Deux rôles distincts :
// 1. l'ANALYSTE décrit objectivement la réalisation (ce qu'on voit, entend, à quels moments) — il ne juge pas ;
// 2. le CORRECTEUR lit la consigne, les critères et le rapport, et compte les erreurs par critère — il ne calcule pas la note.

export interface MediaInput {
  path: string;
  mimeType: string;
  originalName: string;
}

export interface AIAnalysis {
  summary: string;
  transcript: { start: number; end: number; text: string }[];
  shots: { start: number; end: number; description: string }[];
  soundEvents: { time: number; description: string }[];
  onScreenText: { time: number; text: string }[];
  comparisonWithReference: string;
  model: string;
}

export interface AnalysisReport {
  media: MediaMeasurements | null; // mesures exactes (ffmpeg)
  text: TextMeasurements | null; // mesures exactes (comparaison de texte)
  ai: AIAnalysis | null; // description par l'analyste
}

export interface AnalyzeInput {
  lessonTitle: string;
  agentInstructions: string;
  criteria: PracticeCriterion[];
  media: MediaInput;
  reference: MediaInput | null;
  measurements: MediaMeasurements;
}

export interface GradeInput {
  lessonTitle: string;
  learnerInstructions: string;
  agentInstructions: string;
  criteria: PracticeCriterion[];
  report: AnalysisReport;
  text: string | null;
  referenceText: string;
}

export interface Grading {
  criteria: { criterionId: string; misses: number; evidence: { time: number | null; detail: string }[]; comment: string }[];
  feedback: string;
  model: string;
}

export interface Analyst {
  analyze(input: AnalyzeInput): Promise<AIAnalysis>;
}
export interface Grader {
  grade(input: GradeInput): Promise<Grading>;
}

export class AIError extends Error {}
