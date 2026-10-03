import "server-only";
import { prisma } from "@/server/db";
import { notify, userTimezone } from "@/server/notifications/service";
import { CoachingError } from "./lifecycle";
import { formatOccurrence, nextOccurrences, validateSlots, type Slot } from "./availability-rules";

// Disponibilités hebdomadaires des coachs : saisies dans le fuseau du coach, envoyées à ses élèves dans leur fuseau.

export async function getSlots(coachId: string): Promise<Slot[]> {
  const rows = await prisma.coachAvailability.findMany({ where: { coachId }, orderBy: [{ weekday: "asc" }, { start: "asc" }] });
  return rows.map((r) => ({ weekday: r.weekday, start: r.start, end: r.end }));
}

// Créneaux à venir du coach, lisibles par quelqu'un dans le fuseau `viewerTz`.
export async function availabilityFor(coachId: string, viewerTz: string, now = new Date()) {
  const coach = await prisma.user.findUniqueOrThrow({ where: { id: coachId }, select: { timezone: true, availabilityUpdatedAt: true } });
  const slots = await getSlots(coachId);
  return {
    lines: nextOccurrences(slots, userTimezone(coach), now).map((o) => formatOccurrence(o, viewerTz)),
    updatedAt: coach.availabilityUpdatedAt?.toISOString() ?? null,
  };
}

export async function setAvailability(coachId: string, slots: Slot[], now = new Date()) {
  const error = validateSlots(slots);
  if (error) throw new CoachingError(error);
  await prisma.$transaction(async (tx) => {
    await tx.coachAvailability.deleteMany({ where: { coachId } });
    for (const s of slots) await tx.coachAvailability.create({ data: { coachId, ...s } });
    await tx.user.update({ where: { id: coachId }, data: { availabilityUpdatedAt: now } });
  });
  // Message privé à chaque élève, avec les heures dans son propre fuseau.
  const coach = await prisma.user.findUniqueOrThrow({ where: { id: coachId }, select: { displayName: true } });
  const learners = await prisma.user.findMany({ where: { coachId, role: "LEARNER", coachingStatus: "ACTIVE" }, select: { id: true, timezone: true } });
  for (const l of learners) {
    const { lines } = await availabilityFor(coachId, userTimezone(l), now);
    const text = lines.length
      ? `Disponibilités de ton coach ${coach.displayName} cette semaine :\n${lines.map((x) => `• ${x}`).join("\n")}\nPasse le voir quand tu es prêt !`
      : `Ton coach ${coach.displayName} n'a pas de créneau de coaching cette semaine.`;
    await notify(l.id, { kind: "coach.availability", href: "/coaching", text });
  }
  return learners.length;
}
