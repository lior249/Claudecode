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
  cached = { ...parsed, devLoginEnabled, discordLoginEnabled, adminDiscordIds };
  return cached;
}
