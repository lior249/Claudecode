import "server-only";
import { prisma } from "@/server/db";

// Attribution d'un coach : les coachs se remplissent dans l'ordre (coach 1 d'abord, 20 élèves maximum chacun).
export function pickCoach(coaches: { id: string; coachOrder: number | null; coachCapacity: number; learnerCount: number }[]) {
  return (
    [...coaches]
      .sort((a, b) => (a.coachOrder ?? Infinity) - (b.coachOrder ?? Infinity))
      .find((c) => c.learnerCount < c.coachCapacity)?.id ?? null
  );
}

export async function assignCoachIfNeeded(learnerId: string) {
  const learner = await prisma.user.findUniqueOrThrow({ where: { id: learnerId } });
  if (learner.role !== "LEARNER" || learner.coachId) return learner.coachId;
  const coaches = await prisma.user.findMany({
    where: { role: { in: ["COACH", "ADMIN"] }, coachOrder: { not: null }, status: "ACTIVE" },
    select: { id: true, coachOrder: true, coachCapacity: true, _count: { select: { learners: true } } },
  });
  const coachId = pickCoach(coaches.map((c) => ({ ...c, learnerCount: c._count.learners })));
  if (coachId) await prisma.user.update({ where: { id: learnerId }, data: { coachId } });
  return coachId;
}
