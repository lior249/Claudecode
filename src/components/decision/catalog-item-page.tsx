"use client";

import { Check, ExternalLink } from "lucide-react";
import type { Catalog } from "@/generated/prisma/enums";
import type { CatalogItemView } from "@/server/decisions/service";
import { CATALOGS } from "@/server/decisions/catalog";
import { ChooseButton, DecisionHeader, TagList } from "./parts";

export function CatalogItemPage({
  item,
  lessonId,
  catalog,
  chosen,
}: {
  item: CatalogItemView;
  lessonId: string;
  catalog: Catalog;
  chosen: { itemId: string; title: string } | null;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-md lg:max-w-2xl lg:pt-6 px-4 pb-32">
      <DecisionHeader title={item.title} subtitle={CATALOGS[catalog].label} back={`/learn/decision/${lessonId}`} />
      {item.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt="" className="aspect-video w-full rounded-3xl object-cover" />
      )}
      <h2 className="mt-5 text-2xl font-semibold">{item.title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <TagList tags={item.tags} />
      </div>
      {item.summary && <p className="mt-4 text-text/90">{item.summary}</p>}
      {item.body && <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text/90">{item.body}</div>}

      {item.imageUrls.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          {item.imageUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            </a>
          ))}
        </div>
      )}

      {item.links.length > 0 && (
        <section className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-muted">Liens</h3>
          {item.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-between rounded-2xl bg-card p-4 text-sm">
              <span className="truncate">{l.label}</span>
              <ExternalLink size={14} className="shrink-0 text-muted" />
            </a>
          ))}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 lg:left-64 border-t border-line bg-bg/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md lg:max-w-2xl">
          {chosen ? (
            <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted">
              {chosen.itemId === item.id ? (
                <>
                  <Check size={16} className="text-success" /> C&apos;est ton choix
                </>
              ) : (
                <>Tu as choisi « {chosen.title} »</>
              )}
            </p>
          ) : (
            <ChooseButton lessonId={lessonId} itemId={item.id} itemTitle={item.title} catalog={catalog} />
          )}
        </div>
      </div>
    </main>
  );
}
