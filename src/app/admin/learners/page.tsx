import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { getLearnerFile, listLearners } from "@/server/admin/learner-file";
import { RankBadge } from "@/components/learn/badges";
import { LearnerFilePanel } from "@/components/admin/learner-file-panel";

export default async function AdminLearners({ searchParams }: PageProps<"/admin/learners">) {
  const u = (await searchParams).u;
  const learners = await listLearners();
  const file = typeof u === "string" ? await getLearnerFile(u) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Élèves</h1>
      {learners.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Aucun élève pour l&apos;instant.</p>}
      <ul className="space-y-2">
        {learners.map((l) => (
          <li key={l.id}>
            <Link href={`/admin/learners?u=${l.id}`} scroll={false} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
              <RankBadge rank={l.rank} size={40} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words leading-snug font-semibold">{l.displayName}</span>
                <span className="block truncate text-xs text-muted">
                  {l.learnCompleted ? "Learn terminé" : l.currentLesson ? `En cours : ${l.currentLesson}` : "Pas commencé"}
                  {l.status === "REVOKED" && <span className="text-danger"> · accès retiré</span>}
                </span>
              </span>
              {(l.overdue || l.lateCount > 0) && (
                <span className="flex items-center gap-1 rounded-full bg-danger/15 px-2 py-1 text-xs text-danger" title="Décrochages de plus de 24 h">
                  <AlertTriangle size={12} /> {l.lateCount}
                </span>
              )}
              <span className="w-12 text-right font-semibold">{l.percent}%</span>
              <ChevronRight size={16} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {file && <LearnerFilePanel file={file} closeHref="/admin/learners" />}
    </div>
  );
}
