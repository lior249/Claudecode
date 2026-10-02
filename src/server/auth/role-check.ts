import "server-only";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { botConfigured, botFetchMemberRoles } from "@/server/discord/api";

const RECHECK_MS = 60 * 60 * 1000;

// Revérifie le rôle @TikTok au plus une fois par heure. Si Discord est injoignable, on ne bloque pas l'élève.
// Renvoie false si l'accès vient d'être retiré.
export async function recheckRoleIfDue(user: {
  id: string;
  role: string;
  discordUserId: string | null;
  lastRoleCheckAt: Date | null;
}): Promise<boolean> {
  if (user.role !== "LEARNER" || !user.discordUserId || !botConfigured()) return true;
  if (user.lastRoleCheckAt && Date.now() - user.lastRoleCheckAt.getTime() < RECHECK_MS) return true;

  let roles: string[] | null;
  try {
    roles = await botFetchMemberRoles(user.discordUserId);
  } catch (e) {
    console.error("[role-check] Discord injoignable", e);
    return true;
  }

  if (roles && roles.includes(getEnv().DISCORD_ROLE_TIKTOK_ID!)) {
    await prisma.user.update({ where: { id: user.id }, data: { lastRoleCheckAt: new Date() } });
    return true;
  }
  await prisma.user.update({ where: { id: user.id }, data: { status: "REVOKED", lastRoleCheckAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.auditLog.create({
    data: { actorUserId: user.id, action: "ACCESS_REVOKED", entityType: "user", entityId: user.id, metadata: { reason: roles ? "MISSING_ROLE" : "NOT_MEMBER" } },
  });
  return false;
}
