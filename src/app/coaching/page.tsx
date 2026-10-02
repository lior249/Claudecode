import { requireUser } from "@/server/auth/session";
import { getCoachingDashboard } from "@/server/coaching/progress";
import { listTicketsForLearner } from "@/server/coaching/tickets";
import { MAX_OPEN_LEARNER_TICKETS } from "@/server/coaching/rules";
import { CoachingHome } from "@/components/coaching/coaching-home";
import { accountBarData } from "@/server/profile/menu";

export default async function CoachingPage() {
  const user = await requireUser(["LEARNER"]);
  const dashboard = await getCoachingDashboard(user.id);
  const tickets = (await listTicketsForLearner(user.id)).map((t) => ({
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
    />
  );
}
