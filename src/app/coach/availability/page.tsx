import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getSlots } from "@/server/coaching/availability";
import { userTimezone } from "@/server/notifications/service";
import { AvailabilityEditor } from "@/components/coaching/availability-editor";

export default async function CoachAvailability() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const slots = await getSlots(user.id);
  const learners = await prisma.user.count({ where: { coachId: user.id, role: "LEARNER", coachingStatus: "ACTIVE" } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mes disponibilités</h1>
        <p className="mt-1 text-sm text-muted">Tes créneaux de coaching de la semaine. Pense à les mettre à jour chaque dimanche soir.</p>
      </div>
      <AvailabilityEditor initial={slots} timezone={userTimezone(user)} learners={learners} />
    </div>
  );
}
