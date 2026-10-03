"use client";

import Link from "next/link";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import type { getDecisionView } from "@/server/decisions/service";
import { CATALOGS } from "@/server/decisions/catalog";
import { ChooseButton, CompetitionBadge, DecisionHeader, EquipmentBadge } from "./parts";

type View = Awaited<ReturnType<typeof getDecisionView>>;

export function DecisionList({ view, moduleTitle, whopUrl }: { view: View; moduleTitle: string; whopUrl: string | null }) {
  const c = CATALOGS[view.catalog];
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <DecisionHeader title={view.title} subtitle={`${moduleTitle} · Décision`} back="/learn" />

      {view.chosen ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-success/50 bg-card p-6 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-2 text-sm text-muted">Ton choix</p>
            <p className="text-xl font-semibold">{view.chosen.title}</p>
            <p className="mt-1 text-sm text-muted">Enregistré. Ton coach le verra sur ta fiche.</p>
          </div>
          <Link href="/learn" className="block w-full rounded-2xl bg-text py-4 text-center font-semibold text-black">
            Retour à ma progression
          </Link>
        </section>
      ) : (
        <section className="rounded-3xl border border-line bg-card p-5">
          <p className="text-sm leading-relaxed">{view.summary}</p>
          <p className="mt-2 text-xs text-muted">Tu choisis {c.one}, une seule fois. Ouvre les fiches pour comparer.</p>
          {whopUrl && (
            <a href={whopUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-card-2 py-3 text-sm font-medium">
              Voir le module sur Whop <ExternalLink size={14} />
            </a>
          )}
        </section>
      )}

      <div className="mt-4 space-y-3">
        {view.items.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Les fiches arrivent bientôt.</p>}
        {view.items.map((item) => {
          const isChosen = view.chosen?.itemId === item.id;
          return (
            <article key={item.id} className={`overflow-hidden rounded-3xl border bg-card ${isChosen ? "border-success/60" : "border-line"}`}>
              <Link href={`/learn/decision/${view.lessonId}/${item.id}`} className="flex gap-4 p-4">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-2xl font-bold text-muted">{item.title.slice(0, 1)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="line-clamp-2 break-words leading-snug">{item.title}</span>
                    {isChosen && <Check size={16} className="shrink-0 text-success" />}
                  </span>
                  {item.summary && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{item.summary}</span>}
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <CompetitionBadge value={item.competition} />
                    <EquipmentBadge value={item.equipment} />
                  </span>
                </span>
                <ChevronRight size={18} className="mt-1 shrink-0 text-muted" />
              </Link>
              {!view.chosen && (
                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                  <Link href={`/learn/decision/${view.lessonId}/${item.id}`} className="text-sm text-muted underline">
                    Voir la fiche
                  </Link>
                  <ChooseButton lessonId={view.lessonId} itemId={item.id} itemTitle={item.title} catalog={view.catalog} compact />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
