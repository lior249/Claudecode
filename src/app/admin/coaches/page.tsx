import Link from "next/link";
import { Star } from "lucide-react";
import { coachReport, listCoachCandidates } from "@/server/coaching/admin";
import { AddCoach, RemoveCoach } from "@/components/coaching/coach-team";
import { CapacityEditor } from "@/components/coaching/capacity-editor";

const EMOJI = { GOOD: "🙂", NEUTRAL: "😐", BAD: "😞" } as const;

export default async function AdminCoaches() {
  const coaches = await coachReport();
  const candidates = (await listCoachCandidates()).map((u) => ({
    id: u.id,
    label: `${u.displayName}${u.discordUsername ? ` (@${u.discordUsername})` : ""}${u.role === "ADMIN" ? " · admin" : ""}`,
  }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Coachs</h1>
        <p className="mt-1 text-sm text-muted">Étoiles de 1 à 6 : +1 toutes les 10 réponses en moins d&apos;1 h, −1 toutes les 5 réponses en retard dans la semaine.</p>
      </div>
      <AddCoach candidates={candidates} />
      {coaches.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Aucun coach.</p>}
      {coaches.map((c) => (
        <section key={c.id} className={`rounded-3xl border bg-card p-4 ${c.coachStars <= 2 ? "border-danger/50" : "border-line"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{c.displayName}</p>
              <p className="flex items-center gap-0.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <Star key={i} size={16} className={i < c.coachStars ? "text-gold" : "text-line"} fill={i < c.coachStars ? "currentColor" : "none"} />
                ))}
                {c.coachStars <= 2 && <span className="ml-2 text-xs text-danger">à surveiller</span>}
              </p>
            </div>
            <CapacityEditor coachId={c.id} active={c.active} capacity={c.coachCapacity} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <Metric label="Réponse moyenne" value={c.avgResponseMinutes === null ? "—" : c.avgResponseMinutes < 60 ? `${c.avgResponseMinutes} min` : `${Math.round(c.avgResponseMinutes / 6) / 10} h`} />
            <Metric label="En attente" value={c.waiting} />
            <Metric label="Retards (semaine)" value={c.lateWeek} danger={c.lateWeek > 0} />
            <Metric label="Avis" value={`🙂${c.ratingCounts.GOOD} 😐${c.ratingCounts.NEUTRAL} 😞${c.ratingCounts.BAD}`} />
          </div>
          {c.ratings.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Avis des élèves</p>
              <ul className="space-y-2">
                {c.ratings.map((r) => (
                  <li key={r.ticketId}>
                    <Link href={`/admin/tickets/${r.ticketId}`} className="flex gap-3 rounded-2xl bg-bg/40 p-3 text-sm">
                      <span className="text-2xl">{EMOJI[r.rating]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {r.learner} · « {r.subject} »
                        </span>
                        <span className="block text-muted">{r.comment ?? "Sans commentaire"}</span>
                      </span>
                      <span className="self-center text-xs text-muted underline">Voir l&apos;échange</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <RemoveCoach coachId={c.id} name={c.displayName} />
          </div>
          {c.starEvents.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              Dernier changement d&apos;étoiles : {c.starEvents[0].delta > 0 ? "+" : ""}
              {c.starEvents[0].delta} ({c.starEvents[0].reason})
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-card-2 p-2.5">
      <p className={`font-bold ${danger ? "text-danger" : ""}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
