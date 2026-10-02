import "server-only";
import { prisma } from "@/server/db";
import { botConfigured, botSendDirectMessage } from "@/server/discord/api";

// Message privé Discord (au mieux : une panne Discord ne bloque jamais la progression).
export async function notifyLearner(userId: string, message: string) {
  if (!botConfigured()) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discordUserId: true } });
  if (!user?.discordUserId) return;
  try {
    await botSendDirectMessage(user.discordUserId, message);
  } catch (e) {
    console.error("[notify] message Discord non envoyé", e instanceof Error ? e.message : e);
  }
}
