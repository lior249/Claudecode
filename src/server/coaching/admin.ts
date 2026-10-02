import "server-only";
import { prisma } from "@/server/db";
import { isoWeek } from "./rules";
import { CoachingError, listCoachesWithLoad } from "./lifecycle";

// Rapport des coachs pour l'Admin : étoiles, charge, délais, avis des élèves.
export async function coachReport(now = new Date()) {
  const coaches = await listCoachesWithLoad();
  const week = isoWeek(now);
  const rows = [];
  for (const c of coaches) {
    const answered = await prisma.responseWait.findMany({ where: { coachId: c.id, answeredAt: { not: null } }, select: { askedAt: true, answeredAt: true } });
    const avgMs = answered.length ? answered.reduce((s, w) => s + (w.answeredAt!.getTime() - w.askedAt.getTime()), 0) / answered.length : null;
    const [lateWeek, lateTotal, waiting, ratings, events] = [
      await prisma.responseWait.count({ where: { coachId: c.id, late: true, lateWeek: week } }),
      await prisma.responseWait.count({ where: { coachId: c.id, late: true } }),
      await prisma.responseWait.count({ where: { coachId: c.id, answeredAt: null } }),
      await prisma.ticket.findMany({
        where: { coachId: c.id, rating: { not: null } },
        orderBy: { ratedAt: "desc" },
        include: { learner: { select: { displayName: true } } },
      }),
      await prisma.coachStarEvent.findMany({ where: { coachId: c.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    ];
    rows.push({
      ...c,
      answeredCount: answered.length,
      avgResponseMinutes: avgMs === null ? null : Math.round(avgMs / 60000),
      lateWeek,
      lateTotal,
      waiting,
      ratingCounts: {
        GOOD: ratings.filter((r) => r.rating === "GOOD").length,
        NEUTRAL: ratings.filter((r) => r.rating === "NEUTRAL").length,
        BAD: ratings.filter((r) => r.rating === "BAD").length,
      },
      ratings: ratings.map((r) => ({
        ticketId: r.id,
        learner: r.learner.displayName,
        subject: r.subject,
        rating: r.rating!,
        comment: r.ratingComment,
        ratedAt: r.ratedAt!.toISOString(),
      })),
      starEvents: events.map((e) => ({ delta: e.delta, stars: e.stars, reason: e.reason, createdAt: e.createdAt.toISOString() })),
    });
  }
  return rows.sort((a, b) => b.coachStars - a.coachStars);
}

export async function setCoachCapacity(adminId: string, coachId: string, capacity: number) {
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 200) throw new CoachingError("Nombre de places invalide.");
  const coach = await prisma.user.findUnique({ where: { id: coachId } });
  if (!coach || coach.coachOrder === null) throw new CoachingError("Coach introuvable.");
  await prisma.user.update({ where: { id: coachId }, data: { coachCapacity: capacity } });
  await prisma.auditLog.create({ data: { actorUserId: adminId, action: "COACH_CAPACITY_CHANGED", entityType: "user", entityId: coachId, metadata: { capacity } } });
}

export async function listReactivationRequests(viewer: { id: string; role: string }) {
  const reqs = await prisma.reactivationRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { learner: { select: { id: true, displayName: true } } },
  });
  if (viewer.role === "ADMIN") return reqs;
  // Un coach voit les demandes de ses anciens élèves.
  const mine = [];
  for (const r of reqs) {
    const lastStart = await prisma.auditLog.findFirst({ where: { entityId: r.learnerId, action: "COACHING_STARTED" }, orderBy: { createdAt: "desc" } });
    if ((lastStart?.metadata as { coachId?: string } | null)?.coachId === viewer.id) mine.push(r);
  }
  return mine;
}
