import { z } from "zod";

// Toutes les variables d'environnement passent par ici.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  DEV_LOGIN_ENABLED: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema> & { devLoginEnabled: boolean };

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  // La connexion de démonstration est refusée en production.
  const devLoginEnabled = parsed.DEV_LOGIN_ENABLED === "true" && parsed.NODE_ENV !== "production";
  cached = { ...parsed, devLoginEnabled };
  return cached;
}
