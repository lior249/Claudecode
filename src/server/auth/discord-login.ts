import "server-only";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { decideAccess } from "@/server/discord/access";
import { avatarUrl, exchangeCode, fetchCurrentUser, fetchOwnGuildMember } from "@/server/discord/api";
import { assignCoachIfNeeded } from "@/server/coaching/assign";

export type DiscordLoginResult = { ok: true; userId: string } | { ok: false; error: string };

// Connexion Discord : identité prouvée par Discord (OAuth2 + PKCE), puis contrôle du rôle @TikTok.
export async function loginWithDiscord(code: string, codeVerifier: string): Promise<DiscordLoginResult> {
  const env = getEnv();
  const accessToken = await exchangeCode(code, codeVerifier);
  const discordUser = await fetchCurrentUser(accessToken);
  const member = await fetchOwnGuildMember(accessToken);

  const decision = decideAccess({
    discordUserId: discordUser.id,
    memberRoles: member?.roles ?? null,
    tiktokRoleId: env.DISCORD_ROLE_TIKTOK_ID!,
    adminDiscordIds: env.adminDiscordIds,
  });

  const existing = await prisma.user.findUnique({ where: { discordUserId: discordUser.id } });
  if (!decision.allowed) {
    if (existing && existing.status === "ACTIVE" && existing.role === "LEARNER") {
      await prisma.user.update({ where: { id: existing.id }, data: { status: "REVOKED", lastRoleCheckAt: new Date() } });
      await audit(existing.id, "ACCESS_REVOKED", { reason: decision.reason });
    }
    return { ok: false, error: decision.reason };
  }

  const profile = {
    discordUsername: discordUser.username,
    displayName: member?.nick || discordUser.global_name || discordUser.username,
    avatarUrl: avatarUrl(discordUser),
    status: "ACTIVE" as const,
    lastRoleCheckAt: new Date(),
  };

  let user;
  if (existing) {
    // Un administrateur déclaré le reste ; un coach garde son rôle.
    const role = decision.role === "ADMIN" ? "ADMIN" : existing.role;
    user = await prisma.user.update({ where: { id: existing.id }, data: { ...profile, role } });
  } else {
    const isFirstAdmin = decision.role === "ADMIN" && (await prisma.user.count({ where: { coachOrder: { not: null } } })) === 0;
    user = await prisma.user.create({
      data: {
        ...profile,
        discordUserId: discordUser.id,
        role: decision.role,
        // Le premier administrateur devient le coach n° 1.
        coachOrder: isFirstAdmin ? 1 : null,
      },
    });
  }

  await assignCoachIfNeeded(user.id);
  await audit(user.id, "USER_LOGIN", { method: "discord" });
  return { ok: true, userId: user.id };
}

async function audit(actorUserId: string, action: string, metadata: Record<string, string>) {
  await prisma.auditLog.create({ data: { actorUserId, action, entityType: "user", entityId: actorUserId, metadata } });
}
