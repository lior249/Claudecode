// Règle d'accès (pure) : membre du serveur avec le rôle @TikTok, ou administrateur déclaré.

export type AccessDecision =
  | { allowed: true; role: "ADMIN" | "LEARNER" }
  | { allowed: false; reason: "NOT_MEMBER" | "MISSING_ROLE" };

export function decideAccess(input: {
  discordUserId: string;
  memberRoles: string[] | null; // null = pas membre du serveur
  tiktokRoleId: string;
  adminDiscordIds: string[];
}): AccessDecision {
  if (input.adminDiscordIds.includes(input.discordUserId)) return { allowed: true, role: "ADMIN" };
  if (input.memberRoles === null) return { allowed: false, reason: "NOT_MEMBER" };
  if (!input.memberRoles.includes(input.tiktokRoleId)) return { allowed: false, reason: "MISSING_ROLE" };
  return { allowed: true, role: "LEARNER" };
}

export const ACCESS_ERRORS: Record<string, string> = {
  NOT_MEMBER: "Tu dois être membre du serveur Discord pour accéder à Creato.",
  MISSING_ROLE: "Creato est réservé aux membres qui ont le rôle @TikTok. Contacte ton coach si tu penses que c'est une erreur.",
  REVOKED: "Ton accès a été retiré (rôle @TikTok absent). Contacte ton coach si tu penses que c'est une erreur.",
  STATE: "La connexion a expiré. Réessaie.",
  DISCORD: "Impossible de se connecter avec Discord pour le moment. Réessaie.",
  DENIED: "Connexion annulée.",
};
