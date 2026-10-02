import { z } from "zod";

// Configuration d'un exercice de Pratique (stockée dans Lesson.config, jamais envoyée telle quelle au navigateur).
// - accept : ce que l'élève envoie (vidéo, audio, texte)
// - checks : mesures automatiques faites par le serveur (ffmpeg, comparaison de texte)
// - rubric : barème en texte libre, corrigé par l'IA (critères qui demandent du jugement)

const check = z.discriminatedUnion("type", [
  // Aucune piste audio dans la vidéo.
  z.object({ type: z.literal("noAudio"), label: z.string().default("Vidéo sans son"), penalty: z.number().default(10) }),
  // Cuts attendus à des instants précis (secondes), avec une tolérance.
  z.object({
    type: z.literal("cuts"),
    label: z.string().default("Cuts au bon moment"),
    expected: z.array(z.number()).min(1),
    tolerance: z.number().default(0.5),
    penaltyPerMiss: z.number().default(2),
  }),
  // Silences trop longs (voix off).
  z.object({
    type: z.literal("silences"),
    label: z.string().default("Silences coupés"),
    minSilence: z.number().default(0.5),
    penaltyPerSilence: z.number().default(1),
    maxPenalty: z.number().default(10),
  }),
  // Durée totale visée.
  z.object({
    type: z.literal("duration"),
    label: z.string().default("Durée respectée"),
    target: z.number(),
    tolerance: z.number().default(1),
    penalty: z.number().default(2),
  }),
  // Durée maximale d'un plan (illustrations).
  z.object({
    type: z.literal("maxShotLength"),
    label: z.string().default("Plans de 3 s maximum"),
    max: z.number().default(3),
    penaltyPerShot: z.number().default(1),
    maxPenalty: z.number().default(4),
  }),
  // Texte proche d'un texte de référence (transcription).
  z.object({
    type: z.literal("textSimilarity"),
    label: z.string().default("Transcription fidèle"),
    reference: z.string().min(1),
    min: z.number().default(0.96),
    penalty: z.number().default(10),
  }),
  // Le hook (première phrase) n'a pas changé.
  z.object({ type: z.literal("hookUnchanged"), label: z.string().default("Hook intact"), hook: z.string().min(1), penalty: z.number().default(5) }),
  // Le texte est plus court que l'original.
  z.object({
    type: z.literal("shorterThan"),
    label: z.string().default("Script réduit"),
    reference: z.string().min(1),
    penalty: z.number().default(3),
  }),
]);

export type PracticeCheck = z.infer<typeof check>;

export const practiceConfigSchema = z.object({
  threshold: z.number().min(0).max(10).default(8),
  accept: z.array(z.enum(["video", "audio", "text"])).min(1).default(["video"]),
  rubric: z.string().default(""), // vide = pas d'appel à l'IA
  checks: z.array(check).default([]),
});

export type PracticeConfig = z.infer<typeof practiceConfigSchema>;

export function parsePracticeConfig(raw: unknown): PracticeConfig {
  return practiceConfigSchema.parse(raw ?? {});
}

// Limites techniques (docs/SPEC.md § Entraînement).
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
export const MAX_MEDIA_SECONDS = 150; // 2 min 30
export const ACCEPTED_MIME: Record<"video" | "audio", string[]> = {
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"],
};
export const ACCEPTED_EXTENSIONS: Record<"video" | "audio", string[]> = {
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".m4a", ".aac"],
};
