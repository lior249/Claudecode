"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import type { Catalog } from "@/generated/prisma/enums";
import { CATALOGS, type CatalogTag, type OptionColor } from "@/server/decisions/catalog";
import { chooseItemAction } from "@/app/actions/decision";
import { TypeBadge } from "@/components/learn/badges";

const TAG_STYLE: Record<OptionColor, string> = {
  gray: "bg-card-2 text-text/90",
  green: "bg-success/15 text-success",
  yellow: "bg-gold/15 text-gold",
  red: "bg-danger/15 text-danger",
  blue: "bg-sky-400/15 text-sky-300",
  purple: "bg-violet-400/15 text-violet-300",
};

// Pastille d'une option de critère (ex. « Concurrence : Faible »).
export function TagBadge({ tag, bare = false }: { tag: CatalogTag; bare?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TAG_STYLE[tag.color]}`} title={tag.criterion}>
      {bare ? tag.label : `${tag.criterion} : ${tag.label}`}
    </span>
  );
}

export function TagList({ tags }: { tags: CatalogTag[] }) {
  return (
    <>
      {tags.map((t) => (
        <TagBadge key={`${t.criterion}-${t.label}`} tag={t} />
      ))}
    </>
  );
}

export function DecisionHeader({ title, subtitle, back }: { title: string; subtitle: string; back: string }) {
  return (
    <header className="flex items-center gap-3 py-5">
      <Link href={back} className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
        <ArrowLeft size={18} />
      </Link>
      <TypeBadge type="DECISION" size={32} />
      <div className="min-w-0">
        <p className="text-xs text-muted">{subtitle}</p>
        <h1 className="line-clamp-2 break-words leading-snug font-semibold">{title}</h1>
      </div>
    </header>
  );
}

// Bouton « Choisir cette niche » avec confirmation (le choix est définitif).
export function ChooseButton({ lessonId, itemId, itemTitle, catalog, compact }: { lessonId: string; itemId: string; itemTitle: string; catalog: Catalog; compact?: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = CATALOGS[catalog].choose;

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        className={compact ? "rounded-xl bg-text px-4 py-2.5 text-sm font-semibold text-black" : "w-full rounded-2xl bg-text py-4 font-semibold text-black"}
      >
        {label}
      </button>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => !pending && setConfirm(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-line bg-card p-6 pb-10 sm:rounded-3xl sm:pb-6">
            <p className="text-lg font-semibold">Tu choisis « {itemTitle} » ?</p>
            <p className="mt-2 text-sm text-muted">Ce choix est définitif : c&apos;est avec lui que tu vas travailler, et ton coach le verra.</p>
            <div className="mt-5 space-y-2">
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await chooseItemAction(lessonId, itemId);
                    if (res.ok) router.push(`/learn/decision/${lessonId}`);
                    else setError(res.error);
                  })
                }
                className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40"
              >
                {pending ? "Enregistrement…" : "Oui, je confirme"}
              </button>
              <button disabled={pending} onClick={() => setConfirm(false)} className="w-full rounded-2xl bg-card-2 py-3 text-sm text-muted">
                Je réfléchis encore
              </button>
              {error && <p className="text-center text-sm text-danger">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
