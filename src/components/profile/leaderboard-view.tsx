"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { MemberCard } from "@/server/profile/service";
import type { AnyRank } from "@/server/coaching/rules";
import { RankBadge } from "@/components/learn/badges";
import { Flame } from "@/components/coaching/flame";
import { LocalTime } from "@/components/local-time";
import { Avatar } from "./avatar";
import { ResultsAlbum, Revenue, StatTile } from "./member-stats";
import { ActivityGrid } from "@/components/coaching/activity-grid";

interface Row {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  tiktokUsername: string | null;
  rank: AnyRank;
  streak: number;
  flame: number;
  points: number;
}

export function LeaderboardView({ rows, cards, meId }: { rows: Row[]; cards: MemberCard[]; meId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const card = cards.find((c) => c.id === openId) ?? null;
  if (rows.length === 0) return <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Le classement démarre avec les premiers membres qui ont fini la formation.</p>;
  const podium = [rows[1], rows[0], rows[2]]; // 2e, 1er, 3e
  return (
    <>
      <div className="mb-8 grid grid-cols-3 items-end gap-2">
        {podium.map((r, i) =>
          r ? (
            <button
              key={r.id}
              onClick={() => setOpenId(r.id)}
              className={`relative flex flex-col items-center rounded-3xl border border-line px-2 pb-4 text-center ${i === 1 ? "bg-card-2 pt-10" : "bg-card pt-6"}`}
            >
              {i === 1 && <span className="absolute -top-5 text-4xl">👑</span>}
              <Avatar name={r.displayName} url={r.avatarUrl} size={i === 1 ? 64 : 52} />
              <span className="mt-1 text-xs text-muted">{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
              <span className="w-full truncate text-sm font-semibold">{r.displayName}</span>
              <span className="text-xs text-muted">{r.points} pts</span>
            </button>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button onClick={() => setOpenId(r.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${r.id === meId ? "bg-gold/10" : "hover:bg-card"}`}>
              <span className="w-6 text-center text-sm text-muted">{i + 1}</span>
              <Avatar name={r.displayName} url={r.avatarUrl} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.displayName}</span>
                <span className="block truncate text-xs text-muted">{r.tiktokUsername ? `@${r.tiktokUsername}` : ""}</span>
              </span>
              <Flame level={r.flame} days={r.streak} size={18} />
              <RankBadge rank={r.rank} size={30} />
              <span className="w-14 text-right font-semibold">{r.points}</span>
            </button>
          </li>
        ))}
      </ul>
      {card && <MemberPopup card={card} position={rows.findIndex((r) => r.id === card.id) + 1} onClose={() => setOpenId(null)} />}
    </>
  );
}

function MemberPopup({ card: c, position, onClose }: { card: MemberCard; position: number; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Fiche de ${c.displayName}`}>
      <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-line bg-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-card p-2 text-muted" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="-mt-4 flex flex-col items-center text-center">
          <Avatar name={c.displayName} url={c.avatarUrl} size={80} />
          <p className="mt-3 text-xl font-semibold">{c.displayName}</p>
          <p className="text-sm text-muted">
            {position}
            {position === 1 ? "er" : "e"} du classement
          </p>
          <div className="mt-3 flex items-center gap-3">
            <RankBadge rank={c.rank} size={40} />
            <Flame level={c.streak.flame} days={c.streak.current} />
          </div>
          {c.coachingSince && (
            <p className="mt-3 text-xs text-muted">
              En coaching depuis le <LocalTime iso={c.coachingSince} date />
            </p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <StatTile label="Points" value={c.points} />
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <ActivityGrid grid={c.activity} current={c.streak.current} best={c.streak.best} />
          <Revenue lastMonthEur={c.lastMonthEur} bestMonthEur={c.bestMonthEur} totalEur={c.totalEur} />
          <ResultsAlbum months={c.months} />
        </div>
      </div>
    </div>
  );
}
