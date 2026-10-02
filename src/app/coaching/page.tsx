import { requireUser } from "@/server/auth/session";
import { getCoachingDashboard } from "@/server/coaching/progress";
import { listTicketsForLearner } from "@/server/coaching/tickets";
import { MAX_OPEN_LEARNER_TICKETS } from "@/server/coaching/rules";
import { CoachingHome } from "@/components/coaching/coaching-home";
import { accountBarData } from "@/server/profile/menu";
import { isTeam } from "@/server/coaching/team";

export default async function CoachingPage() {
  const user = await requireUser();
  const team = isTeam(user) ? (user.role as "ADMIN" | "COACH") : null;
  const dashboard = await getCoachingDashboard(user.id);
  const tickets = (team ? [] : await listTicketsForLearner(user.id)).map((t) => ({
    id: t.id,
    subject: t.subject,
    origin: t.origin,
    status: t.status,
    needsRating: t.status === "CLOSED" && t.origin === "LEARNER" && !t.rating,
    waitingCoach: t.waits.length > 0,
    lastMessageAt: (t.messages[0]?.createdAt ?? t.createdAt).toISOString(),
  }));
  const openLearnerTickets = tickets.filter((t) => t.origin === "LEARNER" && t.status === "OPEN").length;
  return (
    <CoachingHome
      name={user.displayName}
      dashboard={dashboard}
      tickets={tickets}
      canOpenTicket={openLearnerTickets < MAX_OPEN_LEARNER_TICKETS}
      maxTickets={MAX_OPEN_LEARNER_TICKETS}
      account={await accountBarData(user)}
      team={team}
    />
  );
}
