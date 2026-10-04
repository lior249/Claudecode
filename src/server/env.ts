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
  // IA : "claude" en production (lecture des captures de résultats), "mock" (IA simulée) en développement.
  AI_PROVIDER: z.enum(["claude", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: optional,
  // Modèle Claude qui lit les captures (le plus précis par défaut).
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  // Plafond de lectures de captures par l'IA et par mois (au-delà, vérification à la main par le coach / l'admin).
  AI_MONTHLY_MAX_READS: z.coerce.number().int().min(0).default(300),
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
  if (parsed.NODE_ENV === "production" && parsed.AI_PROVIDER !== "claude") {
    throw new Error("En production, AI_PROVIDER doit valoir \"claude\" (l'IA simulée est réservée au développement).");
  }
  if (parsed.AI_PROVIDER === "claude" && !parsed.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquant.");
  cached = { ...parsed, devLoginEnabled, discordLoginEnabled, adminDiscordIds };
  return cached;
}
