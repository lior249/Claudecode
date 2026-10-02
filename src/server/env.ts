import { z } from "zod";

// Toutes les variables d'environnement passent par ici.
const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  DEV_LOGIN_ENABLED: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DISCORD_CLIENT_ID: optional,
  DISCORD_CLIENT_SECRET: optional,
  DISCORD_GUILD_ID: optional,
  DISCORD_ROLE_TIKTOK_ID: optional,
  DISCORD_ROLE_ELITE_ID: optional,
  DISCORD_BOT_TOKEN: optional,
  ADMIN_DISCORD_IDS: z.string().default(""),
  // Fichiers envoyés (disque du serveur).
  STORAGE_DIR: z.string().default("./storage"),
  // IA : "gemini" en production, "mock" (IA simulée) en développement.
  AI_PROVIDER: z.enum(["gemini", "mock"]).default("mock"),
  GEMINI_API_KEY: optional,
  // Analyste (regarde la vidéo) et correcteur (compte les erreurs) : les modèles les plus précis.
  GEMINI_ANALYST_MODEL: z.string().default("gemini-2.5-pro"),
  GEMINI_GRADER_MODEL: z.string().default("gemini-2.5-pro"),
  // Images analysées par seconde de vidéo (plus = plus précis sur les timings, mais plus cher).
  GEMINI_VIDEO_FPS: z.coerce.number().min(0.1).max(24).default(2),
  // Fuseau par défaut (élèves qui ne l'ont pas encore donné, horaires des coachs et admins).
  APP_TIMEZONE: z.string().default("Europe/Paris"),
  // Pour les tests uniquement : faux serveur Discord.
  DISCORD_API_BASE: z.string().url().default("https://discord.com"),
});

type Parsed = z.infer<typeof schema>;
export type Env = Parsed & {
  devLoginEnabled: boolean;
  discordLoginEnabled: boolean;
  adminDiscordIds: string[];
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  // La connexion de démonstration est refusée en production.
  const devLoginEnabled = parsed.DEV_LOGIN_ENABLED === "true" && parsed.NODE_ENV !== "production";
  const discordLoginEnabled = Boolean(
    parsed.DISCORD_CLIENT_ID && parsed.DISCORD_CLIENT_SECRET && parsed.DISCORD_GUILD_ID && parsed.DISCORD_ROLE_TIKTOK_ID,
  );
  const adminDiscordIds = parsed.ADMIN_DISCORD_IDS.split(",").map((s) => s.trim()).filter(Boolean);
  if (parsed.NODE_ENV === "production" && parsed.AI_PROVIDER !== "gemini") {
    throw new Error("En production, AI_PROVIDER doit valoir \"gemini\" (l'IA simulée est réservée au développement).");
  }
  if (parsed.AI_PROVIDER === "gemini" && !parsed.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquant.");
  cached = { ...parsed, devLoginEnabled, discordLoginEnabled, adminDiscordIds };
  return cached;
}
