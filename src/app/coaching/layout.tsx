import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { canParticipate, ensureTeamParticipation } from "@/server/coaching/team";
import { listTicketsForLearner } from "@/server/coaching/tickets";
import { availabilityFor } from "@/server/coaching/availability";
import { MAX_OPEN_LEARNER_TICKETS } from "@/server/coaching/rules";
import { userTimezone } from "@/server/notifications/service";
import { avatarOf } from "@/server/profile/service";
import { CoachDock, type DockData } from "@/components/coaching/coach-dock";

export default async function CoachingLayout({ children }: LayoutProps<"/coaching">) {
  const user = await requireUser();
  if (!canParticipate(user)) redirect("/learn");
  await ensureTeamParticipation(user);

  // « Mon coach » : seulement pour un élève qui a un coach.
  let dock: DockData | null = null;
  if (user.role === "LEARNER" && user.coachId && user.coachingStatus === "ACTIVE") {
    const coach = await prisma.user.findUniqueOrThrow({ where: { id: user.coachId }, select: { displayName: true, photoKey: true, avatarUrl: true } });
    const tickets = await listTicketsForLearner(user.id);
    const tz = userTimezone(user);
    dock = {
      coach: { name: coach.displayName, avatarUrl: avatarOf(coach) },
      tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, open: t.status === "OPEN", waitingCoach: t.waits.length > 0 })),
      canOpenTicket: tickets.filter((t) => t.origin === "LEARNER" && t.status === "OPEN").length < MAX_OPEN_LEARNER_TICKETS,
      availability: (await availabilityFor(user.coachId, tz)).lines,
      timezone: tz,
    };
  }
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-24">
      {children}
      {dock && <CoachDock data={dock} />}
    </main>
  );
}
