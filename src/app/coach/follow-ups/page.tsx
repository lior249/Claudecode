import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { FOLLOW_UP_TEMPLATES } from "@/server/coaching/rules";
import { FollowUpSender } from "@/components/coaching/follow-up-sender";

export default async function CoachFollowUps() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const learners = await prisma.user.findMany({
    where: { coachId: user.id, coachingStatus: "ACTIVE" },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, ticketsAsLearner: { where: { origin: "COACH", status: "OPEN" }, select: { id: true } } },
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Questions de suivi</h1>
        <p className="mt-1 text-sm text-muted">Choisis une question et les élèves à qui l&apos;envoyer. Un seul suivi ouvert à la fois par élève.</p>
      </div>
      <FollowUpSender
        templates={FOLLOW_UP_TEMPLATES.map((t) => ({ key: t.key, subject: t.subject, body: t.body }))}
        learners={learners.map((l) => ({ id: l.id, name: l.displayName, busy: l.ticketsAsLearner.length > 0 }))}
      />
    </div>
  );
}
