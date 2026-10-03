"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import type { MyProfile } from "@/server/profile/service";
import { resetPhotoAction, tiktokAction } from "@/app/actions/profile";
import { RankBadge } from "@/components/learn/badges";
import { Flame } from "@/components/coaching/flame";
import { LocalTime } from "@/components/local-time";
import { ReminderSettings } from "@/components/notifications/notification-center";
import { Avatar } from "./avatar";
import { Revenue, StatTile } from "./member-stats";
import { PostGallery } from "@/components/results/post-gallery";
import { NewResultPost } from "@/components/results/new-result-post";
import { monthItems } from "@/components/results/gallery-items";
import { ActivityGrid } from "@/components/coaching/activity-grid";

export function ProfileView({ profile: p }: { profile: MyProfile }) {
  const c = p.coaching;
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-card p-5 text-center">
        <Photo name={p.displayName} url={p.avatarUrl} custom={p.hasCustomPhoto} />
        <p className="mt-3 text-xl font-semibold">{p.displayName}</p>
        {p.discordUsername && <p className="text-sm text-muted">@{p.discordUsername} · nom Discord</p>}
        <div className="mt-3 flex items-center justify-center gap-3">
          <RankBadge rank={p.rank} size={40} />
          {c && <Flame level={c.streak.flame} days={c.streak.current} />}
        </div>
        <p className="mt-3 text-xs text-muted">
          Membre depuis le <LocalTime iso={p.joinedAt} date />
          {c?.coachingSince && (
            <>
              {" "}
              · en coaching depuis le <LocalTime iso={c.coachingSince} date />
            </>
          )}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <StatTile label="Parcours" value={`${p.percent} %`} />
        <StatTile label="Points" value={c ? c.points : "—"} />
        <StatTile label="Flamme actuelle" value={c ? `${c.streak.current} j` : "—"} />
        <StatTile label="Record de flamme" value={c ? `${c.streak.best} j` : "—"} />
      </section>
      {!c && <p className="text-center text-xs text-muted">Flamme, points et résultats démarrent après la formation, avec le coaching.</p>}
      {c && <ActivityGrid grid={c.activity} current={c.streak.current} best={c.streak.best} />}
      {c && <NewResultPost autoApproved={p.autoApprovedPosts} />}
      {c && <PostGallery title="Mes résultats" items={c.posts} empty="Publie ton premier résultat : vues, tableau de bord, RPM…" />}
      {c && <Revenue lastMonthEur={c.lastMonthEur} bestMonthEur={c.bestMonthEur} totalEur={c.totalEur} />}
      {c && <PostGallery title="Résultats du mois" items={monthItems(c.months)} empty="Aucun résultat du mois validé pour l'instant." />}

      <Tiktok initial={p.tiktokUsername} />
      <ReminderSettings reminderHour={p.reminderHour} dmEnabled={p.dmEnabled} />
    </div>
  );
}

function Photo({ name, url, custom }: { name: string; url: string | null; custom: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upload = (file: File) => {
    if (file.size > 10 * 1024 * 1024) return setError("Image trop lourde : 10 Mo maximum.");
    setBusy(true);
    setError(null);
    fetch("/api/profile/photo", { method: "POST", body: file })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Envoi impossible. Réessaie.");
        router.refresh();
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="flex flex-col items-center">
      <button onClick={() => input.current?.click()} disabled={busy} className="relative" aria-label="Changer ma photo">
        <Avatar name={name} url={url} size={96} />
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-text text-black">
          <Camera size={14} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Photo de profil"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <p className="mt-2 text-xs text-muted">{busy ? "Envoi…" : custom ? "Photo choisie sur Creato" : "Photo Discord"}</p>
      {custom && (
        <button disabled={pending} onClick={() => start(async () => void (await resetPhotoAction(), router.refresh()))} className="mt-1 text-xs text-muted underline">
          Reprendre ma photo Discord
        </button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function Tiktok({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-semibold">Mon compte TikTok</h2>
      <div className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="@ton_compte" className="min-w-0 flex-1 rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold" />
        <button
          disabled={pending || !value.trim() || value === initial}
          onClick={() =>
            start(async () => {
              const res = await tiktokAction(value);
              setMsg(res.ok ? { ok: true, text: "Enregistré." } : { ok: false, text: res.error });
            })
          }
          className="shrink-0 rounded-2xl bg-text px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          Enregistrer
        </button>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
