"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Plus } from "lucide-react";
import type { MyProfile } from "@/server/profile/service";
import { resetPhotoAction } from "@/app/actions/profile";
import { RankBadge } from "@/components/learn/badges";
import { LocalTime } from "@/components/local-time";
import { Avatar } from "./avatar";
import { Revenue, StatTile } from "./member-stats";
import { PostGallery } from "@/components/results/post-gallery";
import { monthItems } from "@/components/results/gallery-items";
import { ActivityGrid } from "@/components/coaching/activity-grid";

export function ProfileView({ profile: p }: { profile: MyProfile }) {
  const c = p.coaching;
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* PC : identité à gauche (fixe), régularité et résultats à droite. Téléphone : une seule colonne. */}
      <div className="contents lg:sticky lg:top-10 lg:flex lg:flex-col lg:gap-4">
      <section className="rounded-3xl border border-line bg-card p-5 text-center">
        <Photo name={p.displayName} url={p.avatarUrl} custom={p.hasCustomPhoto} />
        <p className="mt-3 break-words text-2xl font-bold">{p.displayName}</p>
        {p.discordUsername && <p className="text-sm text-muted">@{p.discordUsername} · nom Discord</p>}
        <div className="mt-3 flex items-center justify-center gap-2">
          <RankBadge rank={p.rank} size={44} />
          <span className="text-sm font-semibold">Rang {p.rank}</span>
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
      </section>
      {!c && <p className="text-center text-xs text-muted">Flamme, points et résultats démarrent après la formation, avec le coaching.</p>}
      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-4">
      {c && <ActivityGrid grid={c.activity} current={c.streak.current} best={c.streak.best} />}
      {c && (
        <Link href="/resultats/publier" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted hover:text-text">
          <Plus size={16} /> Publier un résultat
        </Link>
      )}
      {c && <PostGallery title="Mes résultats" items={c.posts} empty="Publie ton premier résultat : une vidéo qui marche, tes revenus, tes abonnés…" />}
      {c && <Revenue lastMonthEur={c.lastMonthEur} bestMonthEur={c.bestMonthEur} totalEur={c.totalEur} />}
      {c && <PostGallery title="Résultats du mois" items={monthItems(c.months)} empty="Aucun revenu du mois publié pour l'instant." />}
      </div>

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
