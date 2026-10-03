import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listPendingReviews } from "@/server/admin/reviews";
import { TypeBadge } from "@/components/learn/badges";
import { MascotState } from "@/components/mascot";

const ago = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / 1440)} j`;
};

export default async function AdminReviews() {
  const items = await listPendingReviews();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Validations en attente</h1>
        <p className="mt-1 text-sm text-muted">Réalisations dont l&apos;analyse automatique a échoué 3 fois : l&apos;élève a fait appel à un humain.</p>
      </div>
      {items.length === 0 && (
        <MascotState mood="content" title="Tout est à jour">
          Rien à valider.
        </MascotState>
      )}
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/reviews/${r.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
              <TypeBadge type="PRACTICE_AI" size={36} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.learner}</span>
                <span className="block truncate text-sm text-muted">
                  {r.module} — {r.lesson} · tentative {r.attemptNumber}
                </span>
              </span>
              <span className="text-xs text-muted">{ago(r.createdAt)}</span>
              <span className="rounded-xl bg-text px-3 py-1.5 text-sm font-semibold text-black">Voir</span>
              <ChevronRight size={16} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
