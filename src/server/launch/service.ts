import "server-only";
import { prisma } from "@/server/db";
import { assertCanStartLesson, completeLesson, LessonLockedError } from "@/server/learn/service";
import { notify } from "@/server/notifications/service";
import { botAddRole, botConfigured } from "@/server/discord/api";
import { getEnv } from "@/server/env";
import { startCoaching } from "@/server/coaching/lifecycle";
import { isLaunchKeyValid, MAX_FAILED_CODE_ATTEMPTS_PER_HOUR, MIN_ANSWER_CHARS, parseLaunchConfig } from "./rules";

export class LaunchError extends Error {}

async function loadLaunchLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.type !== "CODE_VALIDATION") throw new LaunchError("Étape introuvable.");
  return { lesson, config: parseLaunchConfig(lesson.config) };
}

async function assertCurrent(userId: string, lessonId: string) {
  try {
    await assertCanStartLesson(userId, lessonId);
  } catch (e) {
    if (e instanceof LessonLockedError) throw new LaunchError(e.message);
    throw e;
  }
}

// Vue élève : jamais la phrase ni le code.
export async function getLaunchView(userId: string, lessonId: string) {
  const { lesson, config } = await loadLaunchLesson(lessonId);
  const report = await prisma.launchReport.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { eliteGrantedAt: true } });
  return {
    lessonId,
    title: lesson.title,
    summary: lesson.summary,
    ready: Boolean(config.code),
    questions: config.questions,
    minAnswerChars: MIN_ANSWER_CHARS,
    done: report ? { submittedAt: report.submittedAt.toISOString(), afterMessage: config.afterMessage, eliteGranted: Boolean(user.eliteGrantedAt) } : null,
  };
}

async function assertNotRateLimited(userId: string) {
  const failures = await prisma.auditLog.count({
    where: { actorUserId: userId, action: "LAUNCH_CODE_FAILED", createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (failures >= MAX_FAILED_CODE_ATTEMPTS_PER_HOUR) throw new LaunchError("Trop d'essais. Réessaie dans une heure.");
}

// Étape 1 : vérifie la phrase et le code (rien n'est révélé en cas d'erreur).
export async function checkLaunchKey(userId: string, lessonId: string, phrase: string, code: string) {
  await assertCurrent(userId, lessonId);
  await assertNotRateLimited(userId);
  const { config } = await loadLaunchLesson(lessonId);
  if (!config.code) throw new LaunchError("Cette étape n'est pas encore prête.");
  if (!isLaunchKeyValid(config, phrase, code)) {
    await prisma.auditLog.create({ data: { actorUserId: userId, action: "LAUNCH_CODE_FAILED", entityType: "lesson", entityId: lessonId } });
    throw new LaunchError("La phrase ou le code ne sont pas bons. Vérifie dans la vidéo du module.");
  }
}

// Étape 2 : ressenti + envoi au coach. Revérifie la phrase et le code.
export async function submitLaunch(userId: string, lessonId: string, input: { phrase: string; code: string; answers: string[] }) {
  await checkLaunchKey(userId, lessonId, input.phrase, input.code);
  const { lesson, config } = await loadLaunchLesson(lessonId);
  if (input.answers.length !== config.questions.length) throw new LaunchError("Réponds à toutes les questions.");
  const short = input.answers.findIndex((a) => a.trim().length < MIN_ANSWER_CHARS);
  if (short !== -1) throw new LaunchError(`Question ${short + 1} : développe un peu plus ta réponse (${MIN_ANSWER_CHARS} caractères minimum).`);

  try {
    await prisma.launchReport.create({
      data: { userId, lessonId, answers: config.questions.map((question, i) => ({ question, answer: input.answers[i].trim().slice(0, 5000) })) },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new LaunchError("Tu as déjà envoyé ton rapport.");
    throw e;
  }
  await prisma.auditLog.create({ data: { actorUserId: userId, action: "LAUNCH_SUBMITTED", entityType: "lesson", entityId: lessonId } });
  await completeLesson(userId, lessonId, null);

  // Entrée en coaching : coach attribué selon les étoiles, rôle @Élite demandé au bot.
  await startCoaching(userId);
  void lesson;
}

// Tâche worker : ajoute le rôle @Élite sur Discord.
export async function grantEliteRole(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.eliteGrantedAt) return;
  const roleId = getEnv().DISCORD_ROLE_ELITE_ID;
  if (!user.discordUserId || !roleId || !botConfigured()) {
    console.warn(`[elite] rôle non attribué à ${userId} : Discord non configuré ou compte sans Discord`);
    return;
  }
  await botAddRole(user.discordUserId, roleId); // lève une erreur → nouvel essai par la file
  await prisma.user.update({ where: { id: userId }, data: { eliteGrantedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorUserId: userId, action: "ELITE_ROLE_GRANTED", entityType: "user", entityId: userId } });
  await notify(userId, { kind: "learn.completed", href: "/coaching", text: "🏆 Bravo ! Tu as terminé ton parcours Learn. Le rôle @Élite est à toi : les salons de coaching sont ouverts." });
}
