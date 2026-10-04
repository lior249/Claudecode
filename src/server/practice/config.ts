import { z } from "zod";

// Configuration d'un exercice de Pratique, saisie par l'Admin (stockée dans Lesson.config).
// Rien n'est prédéfini : l'Admin écrit 1 à 3 critères ; le coach ou l'admin corrige à la main.

export const MIN_CRITERIA = 1;
export const MAX_CRITERIA = 3;

export const criterionSchema = z.object({
  id: z.string().min(1).max(40),
  // Ce qui est vérifié (montré à l'élève avant l'envoi et au correcteur).
  instruction: z.string().trim().min(1).max(2000),
  // Points retirés à chaque fois que le critère n'est pas respecté.
  pointsPerMiss: z.number().min(0.5).max(10),
});
export type PracticeCriterion = z.infer<typeof criterionSchema>;

export const practiceConfigSchema = z.object({
  threshold: z.number().min(0).max(10).default(8),
  accept: z.array(z.enum(["video", "audio", "text"])).min(1).default(["video"]),
  criteria: z.array(criterionSchema).max(MAX_CRITERIA).default([]),
});

export type PracticeConfig = z.infer<typeof practiceConfigSchema>;

export function parsePracticeConfig(raw: unknown): PracticeConfig {
  const parsed = practiceConfigSchema.safeParse(raw ?? {});
  // Une ancienne configuration illisible = exercice pas prêt (plutôt qu'une erreur).
  return parsed.success ? parsed.data : practiceConfigSchema.parse({});
}

// Un exercice n'est ouvert aux élèves (et ne peut être rendu visible) qu'avec 1 à 3 critères.
export function isPracticeReady(config: PracticeConfig) {
  return config.criteria.length >= MIN_CRITERIA && config.criteria.length <= MAX_CRITERIA;
}

// Limites techniques (docs/SPEC.md § Entraînement).
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_MEDIA_SECONDS = 150; // 2 min 30
export const ACCEPTED_EXTENSIONS: Record<"video" | "audio", string[]> = {
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".m4a", ".aac"],
};
