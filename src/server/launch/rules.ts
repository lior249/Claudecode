import { z } from "zod";

// Validation du lancement (niveau 3) : règles pures.

export const MIN_ANSWER_CHARS = 30; // pousse l'élève à développer
export const MAX_FAILED_CODE_ATTEMPTS_PER_HOUR = 10;

export const DEFAULT_LAUNCH_QUESTIONS = [
  "Comment tu t'es senti en réalisant tes 5 premières vidéos ?",
  "Qu'est-ce qui a été le plus facile pour toi ?",
  "Qu'est-ce qui a été le plus difficile ?",
  "Comment s'est passé le montage ? Qu'est-ce qui t'a pris le plus de temps ?",
  "Qu'est-ce que tu penses de TikTok maintenant que tu as commencé ?",
  "Quelle vidéo est ta préférée, et pourquoi ?",
  "Qu'est-ce que tu ferais différemment sur ta prochaine vidéo ?",
  "Qu'est-ce que tu penses pouvoir réussir grâce à TikTok ?",
  "Qu'est-ce qui pourrait t'empêcher d'avancer ?",
  "Sur quoi aimerais-tu que ton coach t'aide en priorité ?",
];

export const launchConfigSchema = z.object({
  phrase: z.string().default("J'ai validé le module à 100 %"),
  code: z.string().default(""),
  questions: z.array(z.string().trim().min(1).max(300)).max(20).default(DEFAULT_LAUNCH_QUESTIONS),
  afterMessage: z.string().default("Envoie maintenant tes 5 vidéos à ton coach, comme expliqué dans le module sur Whop."),
});
export type LaunchConfig = z.infer<typeof launchConfigSchema>;

export function parseLaunchConfig(raw: unknown): LaunchConfig {
  const parsed = launchConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : launchConfigSchema.parse({});
}

// Comparaison tolérante : majuscules, espaces, apostrophes, accents, ponctuation finale.
export function normalizePhrase(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s*%/g, "%")
    .replace(/\s+/g, " ")
    .replace(/[.!\s]+$/g, "")
    .trim();
}
export const normalizeCode = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

export function isLaunchKeyValid(config: LaunchConfig, phrase: string, code: string) {
  if (!config.code) return false;
  return normalizePhrase(phrase) === normalizePhrase(config.phrase) && normalizeCode(code) === normalizeCode(config.code);
}
