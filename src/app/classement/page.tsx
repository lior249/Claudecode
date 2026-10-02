import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { leaderboard } from "@/server/coaching/progress";
import { RankBadge } from "@/components/learn/badges";
import { Flame } from "@/components/coaching/flame";

function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full bg-card-2 font-bold text-muted" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default async function LeaderboardPage() {
  const user = await requireUser();
  const rows = await leaderboard();
  const podium = [rows[1], rows[0], rows[2]]; // 2e, 1er, 3e
  const back = user.role === "LEARNER" ? (user.coachingStatus === "NONE" ? "/learn" : "/coaching") : "/coach";

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <header className="flex items-center gap-3 py-5">
        <Link href={back} className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold">Classement</h1>
      </header>
      <p className="mb-6 text-sm text-muted">Points = streak (régularité) + vues validées (qualité).</p>

      {rows.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Le classement démarre avec les premiers élèves en coaching.</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-3 items-end gap-2">
            {podium.map((r, i) =>
              r ? (
                <div
                  key={r.id}
                  className={`relative flex flex-col items-center rounded-3xl border border-line px-2 pb-4 text-center ${i === 1 ? "bg-card-2 pt-10" : "bg-card pt-6"}`}
                >
                  {i === 1 && <span className="absolute -top-5 text-4xl">👑</span>}
                  <Avatar name={r.displayName} url={r.avatarUrl} size={i === 1 ? 64 : 52} />
                  <span className="mt-1 text-xs text-muted">{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
                  <span className="w-full truncate text-sm font-semibold">{r.displayName}</span>
                  <span className="text-xs text-muted">{r.points} pts</span>
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${r.id === user.id ? "bg-gold/10" : ""}`}>
                <span className="w-6 text-center text-sm text-muted">{i + 1}</span>
                <Avatar name={r.displayName} url={r.avatarUrl} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.displayName}</span>
                  <span className="block truncate text-xs text-muted">{r.tiktokUsername ? `@${r.tiktokUsername}` : ""}</span>
                </span>
                <Flame level={r.flame} days={r.streak} size={18} />
                <RankBadge rank={r.rank} size={30} />
                <span className="w-14 text-right font-semibold">{r.points}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
