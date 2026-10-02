import { z } from "zod";

// Configuration d'un exercice de Pratique, saisie par l'Admin (stockée dans Lesson.config).
// Rien n'est prédéfini : l'Admin écrit la consigne pour l'agent et 1 à 4 critères.
// Jamais envoyée telle quelle au navigateur (la consigne et la référence peuvent contenir la solution).

export const MIN_CRITERIA = 1;
export const MAX_CRITERIA = 4;

export const criterionSchema = z.object({
  id: z.string().min(1).max(40),
  // Ce que l'agent doit vérifier (montré aussi à l'élève).
  instruction: z.string().trim().min(1).max(2000),
  // Points retirés à chaque fois que le critère n'est pas respecté.
  pointsPerMiss: z.number().min(0.5).max(10),
});
export type PracticeCriterion = z.infer<typeof criterionSchema>;

export const practiceConfigSchema = z.object({
  threshold: z.number().min(0).max(10).default(8),
  accept: z.array(z.enum(["video", "audio", "text"])).min(1).default(["video"]),
  // Grand texte explicatif de l'exercice, lu par l'agent correcteur (jamais montré à l'élève).
  agentInstructions: z.string().max(20_000).default(""),
  criteria: z.array(criterionSchema).max(MAX_CRITERIA).default([]),
  // Éléments de référence (jamais montrés à l'élève).
  referenceText: z.string().max(20_000).default(""),
  referenceAssetId: z.string().nullable().default(null),
});

export type PracticeConfig = z.infer<typeof practiceConfigSchema>;

export function parsePracticeConfig(raw: unknown): PracticeConfig {
  const parsed = practiceConfigSchema.safeParse(raw ?? {});
  // Une ancienne configuration illisible = exercice pas prêt (plutôt qu'une erreur).
  return parsed.success ? parsed.data : practiceConfigSchema.parse({});
}

// Un exercice n'est ouvert aux élèves que si l'Admin a écrit la consigne pour l'agent et au moins un critère.
export function isPracticeReady(config: PracticeConfig) {
  return config.agentInstructions.trim().length > 0 && config.criteria.length >= MIN_CRITERIA;
}

// Limites techniques (docs/SPEC.md § Entraînement).
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_MEDIA_SECONDS = 150; // 2 min 30
export const ACCEPTED_EXTENSIONS: Record<"video" | "audio", string[]> = {
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".m4a", ".aac"],
};
