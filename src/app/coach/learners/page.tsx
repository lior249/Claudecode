import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getLearnerFile } from "@/server/admin/learner-file";
import { getCoachingDashboard } from "@/server/coaching/progress";
import { LearnerFilePanel } from "@/components/admin/learner-file-panel";
import { RankBadge } from "@/components/learn/badges";
import { Flame } from "@/components/coaching/flame";
import { ActivityGrid } from "@/components/coaching/activity-grid";
import { PostGallery } from "@/components/results/post-gallery";
import { listResultPosts } from "@/server/results/service";
import { MascotState } from "@/components/mascot";

const STATUS: Record<string, string> = { ACTIVE: "En coaching", REVOKED: "En pause (absence)", COMPLETED: "Terminé (SSS)", NONE: "Learn" };

export default async function CoachLearners({ searchParams }: PageProps<"/coach/learners">) {
  const user = await requireUser(["COACH", "ADMIN"]);
  const u = (await searchParams).u;
  const learners = await prisma.user.findMany({
    where: { coachId: user.id, role: "LEARNER" },
    orderBy: [{ coachingStatus: "asc" }, { displayName: "asc" }],
  });
  const rows = [];
  for (const l of learners) rows.push({ l, d: await getCoachingDashboard(l.id) });
  const active = rows.filter((r) => r.l.coachingStatus === "ACTIVE").length;

  // Fiche : uniquement pour un élève de ce coach (sinon introuvable).
  const selected = typeof u === "string" ? rows.find((r) => r.l.id === u) : undefined;
  const file = selected ? await getLearnerFile(selected.l.id) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mes élèves</h1>
        <p className="mt-1 text-sm text-muted">
          {active}/{user.coachCapacity} places occupées
        </p>
      </div>
      {rows.length === 0 && (
        <MascotState mood="neutre">
          Aucun élève pour l&apos;instant.
        </MascotState>
      )}
      <ul className="space-y-2">
        {rows.map(({ l, d }) => (
          <li key={l.id}>
            <Link href={`/coach/learners?u=${l.id}`} scroll={false} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
              <RankBadge rank={d.rank} size={40} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words leading-snug font-semibold">{l.displayName}</span>
                <span className="block text-xs text-muted">
                  {STATUS[l.coachingStatus]} · {d.points.total} pts{l.tiktokUsername ? ` · @${l.tiktokUsername}` : ""}
                </span>
              </span>
              <Flame level={d.streak.flame} days={d.streak.current} size={18} />
              <ChevronRight size={16} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {file && selected && (
        <LearnerFilePanel
          file={file}
          closeHref="/coach/learners"
          extra={
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Coaching</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-card p-3">
                  <Flame level={selected.d.streak.flame} days={selected.d.streak.current} size={20} />
                  <p className="text-xs text-muted">Streak (record {selected.d.streak.best})</p>
                </div>
                <div className="rounded-2xl bg-card p-3">
                  <p className="text-xl font-bold">{selected.d.points.total}</p>
                  <p className="text-xs text-muted">Points</p>
                </div>
                <div className="rounded-2xl bg-card p-3">
                  <p className="text-xl font-bold">{selected.d.posts.length}</p>
                  <p className="text-xs text-muted">Posts</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Statut : {STATUS[selected.l.coachingStatus]} · rang {selected.d.rank}
                {selected.d.proofs.filter((p) => p.status === "APPROVED" && p.kind === "MONTHLY").map((p) => ` · ${p.month} : ${p.amountEur} €`)}
              </p>
              <div className="mt-3">
                <ActivityGrid grid={selected.d.activity} current={selected.d.streak.current} best={selected.d.streak.best} />
              </div>
              <div className="mt-3">
                <PostGallery title="Ses résultats" items={await listResultPosts(selected.l.id, user.id)} empty="Aucun post de résultat pour l'instant." />
              </div>
            </section>
          }
        />
      )}
    </div>
  );
}
