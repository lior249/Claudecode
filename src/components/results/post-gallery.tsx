"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, ExternalLink, X } from "lucide-react";
import { reactAction } from "@/app/actions/results";

export type ReactionKey = "FIRE" | "ROCKET" | "ANGRY" | "CRY";
const EMOJI: Record<ReactionKey, string> = { FIRE: "🔥", ROCKET: "🚀", ANGRY: "😡", CRY: "😢" };
const KEYS = Object.keys(EMOJI) as ReactionKey[];

export interface GalleryItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  link?: string | null;
  tag?: string | null; // ex. « 🏆 Meilleur mois »
  status?: "PENDING" | "APPROVED" | "REJECTED";
  reviewComment?: string | null;
  counts?: Record<ReactionKey, number>; // présent = post réagissable
  mine?: ReactionKey | null;
}

// Galerie de 2 colonnes : aperçu de la capture (fondu vers le bas), titre, 2 lignes de texte, « Voir plus ».
export function PostGallery({ title, items, empty }: { title: string; items: GalleryItem[]; empty: string }) {
  // Réactions modifiées localement (affichage immédiat), par-dessus les données du serveur.
  const [overrides, setOverrides] = useState<Record<string, GalleryItem>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const list = items.map((i) => overrides[i.id] ?? i);
  const open = list.find((i) => i.id === openId) ?? null;
  const cols = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {list.length > 0 && <span className="text-xs text-muted">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 items-start gap-2">
          {cols.map((col, c) => (
            <div key={c} className="grid min-w-0 content-start gap-2">
              {col.map((it) => (
                <button key={it.id} onClick={() => setOpenId(it.id)} className="block w-full overflow-hidden rounded-2xl bg-card-2 text-left">
                  <span className="relative m-1.5 mb-0 block aspect-[4/5] overflow-hidden rounded-xl bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl} alt="" loading="lazy" className="block h-full w-full object-cover object-top" />
                    <span className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-card-2" />
                    {it.status && it.status !== "APPROVED" && (
                      <span className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${it.status === "PENDING" ? "bg-gold text-black" : "bg-danger text-white"}`}>
                        {it.status === "PENDING" ? "En validation" : "Refusé"}
                      </span>
                    )}
                  </span>
                  <span className="grid gap-1 px-2.5 pb-2.5 pt-1.5">
                    <span className="flex items-start gap-1 text-[13px] font-semibold leading-tight">
                      <span className="min-w-0">{it.title}</span>
                      {it.status === "APPROVED" && <BadgeCheck size={15} className="mt-px shrink-0 text-success" aria-label="Validé" />}
                    </span>
                    {it.tag && <span className="text-[11px] font-semibold text-gold">{it.tag}</span>}
                    {it.body && <span className="line-clamp-2 text-[11.5px] leading-snug text-muted">{it.body}</span>}
                    <span className="text-[11.5px] font-semibold">Voir plus</span>
                    {it.counts && (
                      <span className="flex flex-wrap gap-1.5 text-[11px] text-muted">
                        {KEYS.filter((k) => it.counts![k]).map((k) => (
                          <span key={k}>
                            {EMOJI[k]} {it.counts![k]}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && <PostDialog item={open} onClose={() => setOpenId(null)} onChange={(next) => setOverrides((o) => ({ ...o, [next.id]: next }))} />}
    </section>
  );
}

function PostDialog({ item, onClose, onChange }: { item: GalleryItem; onClose: () => void; onChange: (i: GalleryItem) => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  const react = (k: ReactionKey) => {
    if (!item.counts) return;
    const kind = item.mine === k ? null : k;
    const counts = { ...item.counts };
    if (item.mine) counts[item.mine]--;
    if (kind) counts[kind]++;
    onChange({ ...item, counts, mine: kind });
    start(async () => {
      const res = await reactAction({ postId: item.id, kind });
      if (!res.ok) onChange(item);
    });
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-bg p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-card p-2 text-muted" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt={item.title} className="mt-2 block h-auto w-full rounded-2xl border border-line" />
        <h3 className="mt-4 flex items-start gap-1.5 text-xl font-bold leading-tight">
          <span>{item.title}</span>
          {item.status === "APPROVED" && <BadgeCheck size={20} className="mt-1 shrink-0 text-success" aria-label="Validé" />}
        </h3>
        {item.tag && <p className="mt-1 text-sm font-semibold text-gold">{item.tag}</p>}
        {item.status === "PENDING" && <p className="mt-2 text-xs text-gold">En attente de validation : visible seulement par toi.</p>}
        {item.status === "REJECTED" && <p className="mt-2 text-xs text-danger">Refusé : {item.reviewComment}</p>}
        {item.body && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text/85">{item.body}</p>}
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-card py-3 text-sm font-semibold">
            Voir la vidéo <ExternalLink size={14} />
          </a>
        )}
        {item.counts && item.status === "APPROVED" && (
          <>
            <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Réagir">
              {KEYS.map((k) => (
                <button
                  key={k}
                  disabled={pending}
                  onClick={() => react(k)}
                  aria-pressed={item.mine === k}
                  className={`grid justify-items-center gap-1 rounded-2xl border py-2.5 text-sm font-semibold ${item.mine === k ? "border-gold bg-gold/15" : "border-line bg-card"}`}
                >
                  <span className="text-2xl leading-none">{EMOJI[k]}</span>
                  {item.counts![k]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted">Une réaction par membre. Touche-la encore pour l&apos;enlever.</p>
          </>
        )}
      </div>
    </div>
  );
}
