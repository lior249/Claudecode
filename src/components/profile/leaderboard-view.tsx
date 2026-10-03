"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { MemberCard } from "@/server/profile/service";
import type { AnyRank } from "@/server/coaching/rules";
import { RankBadge } from "@/components/learn/badges";
import { Flame } from "@/components/coaching/flame";
import { CrownIcon, FlameIcon } from "@/components/ui/icons";
import { LocalTime } from "@/components/local-time";
import { Avatar } from "./avatar";
import { Revenue, StatTile, eur } from "./member-stats";
import { PostGallery } from "@/components/results/post-gallery";
import { monthItems } from "@/components/results/gallery-items";
import { ActivityGrid } from "@/components/coaching/activity-grid";
import { MascotState } from "@/components/mascot";

// Podium : or, argent, bronze (contour de la photo, points, marche).
const MEDALS = [
  { ring: "linear-gradient(135deg,#fff2a8,#f5b301,#a86b00)", text: "#f5b301", step: 88, step_bg: "linear-gradient(180deg,#ffe27a,#f5b301 45%,#a86b00)" },
  { ring: "linear-gradient(135deg,#ffffff,#c9d1d9,#7d8794)", text: "#c9d1d9", step: 64, step_bg: "linear-gradient(180deg,#ffffff,#c9d1d9 45%,#7d8794)" },
  { ring: "linear-gradient(135deg,#f6c08e,#c47a3d,#7a4119)", text: "#e09a5e", step: 48, step_bg: "linear-gradient(180deg,#f6c08e,#c47a3d 45%,#7a4119)" },
];

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
  if (rows.length === 0)
    return (
      <MascotState mood="neutre" title="Classement vide">
        Le classement démarre avec les premiers membres qui ont fini la formation.
      </MascotState>
    );
  const podium = [rows[1], rows[0], rows[2]]; // 2e, 1er, 3e
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-10">
      <div className="mb-6 grid grid-cols-3 items-end gap-2 pt-6 lg:sticky lg:top-10 lg:mb-0">
        {podium.map((r, i) => {
          const place = i === 1 ? 1 : i === 0 ? 2 : 3;
          const m = MEDALS[place - 1];
          return r ? (
            <button key={r.id} onClick={() => setOpenId(r.id)} className="flex min-w-0 flex-col items-center text-center" aria-label={`${place}e : ${r.displayName}`}>
              <span className="relative">
                {place === 1 && <CrownIcon size={34} className="absolute -top-7 left-1/2 -translate-x-1/2" />}
                <span className="block rounded-full p-[3px]" style={{ background: m.ring }}>
                  <span className="block rounded-full bg-bg p-[2px]">
                    <Avatar name={r.displayName} url={r.avatarUrl} size={place === 1 ? 72 : 56} />
                  </span>
                </span>
              </span>
              <span className="mt-2 line-clamp-2 w-full break-words px-1 text-sm font-semibold leading-tight">{r.displayName}</span>
              <span className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: m.text }}>
                {r.points} pt{r.points > 1 ? "s" : ""}
              </span>
              <span
                className="mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 text-3xl font-extrabold text-black/45"
                style={{ height: m.step, background: m.step_bg }}
              >
                {place}
              </span>
            </button>
          ) : (
            <div key={i} />
          );
        })}
      </div>
      <div>
      <div className="flex items-center gap-3 px-3 pb-1 text-xs text-muted">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Membre</span>
        <span className="w-12 text-center">Flamme</span>
        <span className="w-9 text-center">Rang</span>
        <span className="w-12 text-right">Points</span>
      </div>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r.id}>
            <button onClick={() => setOpenId(r.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${r.id === meId ? "bg-gold/10 ring-1 ring-gold/40" : "hover:bg-card"}`}>
              <span className="w-6 text-center text-sm font-semibold text-muted">{i + 1}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Avatar name={r.displayName} url={r.avatarUrl} size={40} />
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words font-semibold leading-tight">{r.displayName}</span>
                  {r.tiktokUsername && <span className="block truncate text-xs text-muted">@{r.tiktokUsername}</span>}
                </span>
              </span>
              <span className="flex w-12 justify-center">
                <Flame level={r.flame} days={r.streak} size={18} />
              </span>
              <span className="flex w-9 justify-center">
                <RankBadge rank={r.rank} size={32} />
              </span>
              <span className="w-12 text-right text-lg font-bold tabular-nums">{r.points}</span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      {card && <MemberPopup card={card} position={rows.findIndex((r) => r.id === card.id) + 1} onClose={() => setOpenId(null)} />}
    </div>
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
          <p className="mt-3 break-words text-2xl font-bold">{c.displayName}</p>
          <p className="text-sm text-muted">
            {position}
            {position === 1 ? "er" : "e"} du classement
          </p>
          <div className="mt-3 flex items-center gap-2">
            <RankBadge rank={c.rank} size={44} />
            <span className="text-sm font-semibold">Rang {c.rank}</span>
          </div>
          {c.coachingSince && (
            <p className="mt-3 text-xs text-muted">
              En coaching depuis le <LocalTime iso={c.coachingSince} date />
            </p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile label="Points" value={c.points} />
          <StatTile
            label="Flamme"
            value={
              <>
                <FlameIcon size={22} level={c.streak.flame} /> {c.streak.current}
              </>
            }
          />
          <StatTile label="Meilleur mois" value={eur(c.bestMonthEur)} gold={c.bestMonthEur > 0} />
        </div>
        <div className="mt-4 grid gap-3">
          <ActivityGrid grid={c.activity} current={c.streak.current} best={c.streak.best} />
          <PostGallery title="Ses résultats" items={c.posts} empty="Aucun post de résultat pour l'instant." />
          <Revenue lastMonthEur={c.lastMonthEur} bestMonthEur={c.bestMonthEur} totalEur={c.totalEur} />
          <PostGallery title="Résultats du mois" items={monthItems(c.months)} empty="Aucun résultat du mois validé pour l'instant." />
        </div>
      </div>
    </div>
  );
}
