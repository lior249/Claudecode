import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { coachInbox } from "@/server/coaching/tickets";

function dueLabel(left: number | null) {
  if (left === null) return { text: "Réponse envoyée", tone: "text-muted" };
  const h = Math.floor(Math.abs(left) / 3_600_000);
  const m = Math.floor((Math.abs(left) % 3_600_000) / 60_000);
  if (left < 0) return { text: `En retard de ${h} h ${String(m).padStart(2, "0")}`, tone: "text-danger" };
  return { text: `Reste ${h} h ${String(m).padStart(2, "0")}`, tone: left < 4 * 3_600_000 ? "text-gold" : "text-success" };
}

export default async function CoachInbox() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const tickets = await coachInbox(user.id);
  const waiting = tickets.filter((t) => t.msLeft !== null).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Demandes ouvertes</h1>
        <p className="mt-1 text-sm text-muted">
          {waiting} en attente de ta réponse. Tu as 12 h pour répondre ; en moins d&apos;1 h, tu gagnes des étoiles.
        </p>
      </div>
      {tickets.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Aucune demande ouverte. 🎉</p>}
      <ul className="space-y-2">
        {tickets.map((t) => {
          const due = dueLabel(t.msLeft);
          return (
            <li key={t.id}>
              <Link href={`/coach/tickets/${t.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.learner}</span>
                  <span className="block truncate text-sm text-muted">
                    {t.origin === "COACH" ? "Suivi · " : ""}
                    {t.subject}
                  </span>
                </span>
                <span className={`text-xs font-medium ${due.tone}`}>{t.origin === "LEARNER" ? due.text : "Suivi"}</span>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
