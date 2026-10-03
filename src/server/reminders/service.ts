import "server-only";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { DEADLINE_REMINDER_MS } from "@/server/learn/progression";
import { markReminder, notify } from "@/server/notifications/service";

export { markReminder };

// Rappel (urgent : le délai tourne même la nuit) 4 h avant la fin des 24 h de la leçon en cours.
export async function sendDeadlineReminders(now = new Date()) {
  const learners = await prisma.user.findMany({
    where: { role: "LEARNER", status: "ACTIVE", learnStartedAt: { not: null }, learnCompletedAt: null },
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of learners) {
    const { progression } = await getLearnerProgression(id, now, { startClock: false });
    const current = progression.levels.flatMap((l) => l.modules.flatMap((m) => m.lessons)).find((l) => l.id === progression.currentLessonId);
    if (!current?.deadlineAt) continue;
    const left = current.deadlineAt.getTime() - now.getTime();
    if (left <= 0 || left > DEADLINE_REMINDER_MS) continue;
    if (!(await markReminder(id, `deadline4h:${current.id}`))) continue;
    const hours = Math.max(1, Math.ceil(left / 3_600_000));
    await notify(id, { kind: "learn.deadline", href: "/learn", urgent: true, text: `Il te reste moins de ${hours} h pour valider « ${current.title} ». Tu peux le faire !` });
    sent++;
  }
  return sent;
}
