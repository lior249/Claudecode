import "server-only";
import { prisma } from "@/server/db";

// L'équipe (coachs et admins) participe au classement : posts, flamme, résultats du mois.
// Pas de coach ni de tickets pour l'équipe ; leurs preuves sont validées par l'admin.
// Coachs et admins participent sans condition (un coach nommé sans formation terminée a été forcé par l'admin).

export const isTeam = (u: { role: string }) => u.role === "ADMIN" || u.role === "COACH";

export function canParticipate(u: { role: string; coachingStatus: string; learnCompletedAt: Date | null }) {
  if (u.role === "ADMIN") return true;
  if (u.role === "COACH") return true;
  return u.coachingStatus !== "NONE";
}

// Ouvre l'espace « mes posts, mes résultats » d'un membre de l'équipe (une seule fois).
export async function ensureTeamParticipation(u: { id: string; role: string; coachingStatus: string; learnCompletedAt: Date | null }) {
  if (!isTeam(u) || !canParticipate(u) || u.coachingStatus !== "NONE") return false;
  const { count } = await prisma.user.updateMany({
    where: { id: u.id, coachingStatus: "NONE" },
    data: { coachingStatus: "ACTIVE", coachingStartedAt: new Date(), coachId: null },
  });
  return count > 0;
}

// Filtre Prisma des membres qui figurent au classement.
export const leaderboardWhere = {
  coachingStatus: { in: ["ACTIVE" as const, "COMPLETED" as const] },
  status: "ACTIVE" as const,
  OR: [{ role: "LEARNER" as const }, { role: "ADMIN" as const }, { role: "COACH" as const }],
};
