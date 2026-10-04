"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BadgeCheck, ExternalLink, X } from "lucide-react";
import { reactAction } from "@/app/actions/results";
import { TrophyIcon } from "@/components/ui/icons";

export type ReactionKey = "FIRE" | "ROCKET" | "ANGRY" | "CRY";
const EMOJI: Record<ReactionKey, string> = { FIRE: "🔥", ROCKET: "🚀", ANGRY: "😡", CRY: "😢" };
const KEYS = Object.keys(EMOJI) as ReactionKey[];

export interface GalleryItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
  link?: string | null;
  tag?: string | null; // ex. « Meilleur mois » (affiché avec un trophée)
  status?: "ANALYZING" | "PENDING" | "APPROVED" | "REJECTED";
  reviewComment?: string | null;
  typeName?: string | null; // type de résultat (ex. « Résultat d'une vidéo »)
  points?: number | null; // points gagnés
  author?: string | null; // galerie de tous les résultats : nom du membre
  counts?: Record<ReactionKey, number>; // présent = post réagissable
  mine?: ReactionKey | null;
}

const STATUS_LABEL = { ANALYZING: "Lecture par l'IA…", PENDING: "En vérification", REJECTED: "Refusé" } as const;

// Cartes réparties en colonnes, dans l'ordre (le plus récent en haut à gauche) : même largeur, hauteur libre.
function ResultGrid({ items, columns, onOpen }: { items: GalleryItem[]; columns: number; onOpen: (id: string) => void }) {
  const cols = Array.from({ length: columns }, (_, c) => items.filter((_, i) => i % columns === c));
  return (
    <div className="grid items-start gap-2 lg:gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {cols.map((col, c) => (
        <div key={c} className="grid min-w-0 content-start gap-2 lg:gap-3">
          {col.map((it) => (
            <button key={it.id} onClick={() => onOpen(it.id)} className="block w-full overflow-hidden rounded-2xl bg-card-2 text-left transition hover:ring-2 hover:ring-gold/40">
              <span className="relative m-1.5 mb-0 block aspect-[4/5] overflow-hidden rounded-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl} alt="" loading="lazy" className="block h-full w-full object-cover object-top" />
                <span className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-card-2" />
                {it.status && it.status !== "APPROVED" && (
                  <span className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${it.status === "REJECTED" ? "bg-danger text-white" : "bg-gold text-black"}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                )}
                {!!it.points && <span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-gold">+{it.points} pt{it.points > 1 ? "s" : ""}</span>}
              </span>
              <span className="grid gap-1 px-2.5 pb-2.5 pt-1.5">
                {it.typeName && <span className="truncate text-xs font-medium text-muted">{it.typeName}</span>}
                <span className="flex items-start gap-1 text-sm font-semibold leading-tight">
                  <span className="min-w-0">{it.title}</span>
                  {it.status === "APPROVED" && <BadgeCheck size={15} className="mt-px shrink-0 text-success" aria-label="Validé" />}
                </span>
                {it.author && <span className="truncate text-xs text-muted">par {it.author}</span>}
                {it.tag && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-gold">
                    <TrophyIcon size={14} /> {it.tag}
                  </span>
                )}
                {it.body && <span className="line-clamp-2 text-xs leading-snug text-muted">{it.body}</span>}
                <span className="text-xs font-semibold">Voir plus</span>
                {it.counts && (
                  <span className="flex flex-wrap gap-1.5 text-xs text-muted">
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
  );
}

// Réactions modifiées localement (affichage immédiat), par-dessus les données du serveur.
function useGallery(items: GalleryItem[]) {
  const [overrides, setOverrides] = useState<Record<string, GalleryItem>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const list = items.map((i) => overrides[i.id] ?? i);
  const open = list.find((i) => i.id === openId) ?? null;
  const dialog = open && <PostDialog item={open} onClose={() => setOpenId(null)} onChange={(next) => setOverrides((o) => ({ ...o, [next.id]: next }))} />;
  return { list, open: setOpenId, dialog };
}

// Galerie de 2 colonnes dans une carte (profil, fiche d'un membre) : aperçu fondu, titre, 2 lignes de texte, « Voir plus ».
export function PostGallery({ title, items, empty }: { title: string; items: GalleryItem[]; empty: string }) {
  const g = useGallery(items);
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {g.list.length > 0 && <span className="text-xs text-muted">{g.list.length}</span>}
      </div>
      {g.list.length === 0 ? <p className="mt-2 text-xs text-muted">{empty}</p> : <div className="mt-3"><ResultGrid items={g.list} columns={2} onOpen={g.open} /></div>}
      {g.dialog}
    </section>
  );
}

// Nombre de colonnes selon la largeur de l'écran : 2 sur téléphone, plus sur PC (zoom compris).
function columnsFor(width: number) {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return Math.min(7, Math.max(3, Math.floor((width - 256 - 80) / 230)));
}
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

// Mur plein écran de tous les résultats (page « Résultats »).
export function GalleryWall({ items }: { items: GalleryItem[] }) {
  const columns = useSyncExternalStore(subscribeResize, () => columnsFor(window.innerWidth), () => 2);
  const g = useGallery(items);
  return (
    <>
      <ResultGrid items={g.list} columns={columns} onOpen={g.open} />
      {g.dialog}
    </>
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
        {item.tag && (
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gold">
            <TrophyIcon size={16} /> {item.tag}
          </p>
        )}
        {(item.typeName || item.author) && (
          <p className="mt-1 text-sm text-muted">
            {item.typeName}
            {item.author && ` · par ${item.author}`}
            {!!item.points && <b className="text-gold"> · +{item.points} pt{item.points > 1 ? "s" : ""}</b>}
          </p>
        )}
        {item.status === "ANALYZING" && <p className="mt-2 text-xs text-gold">L&apos;IA lit ta capture : visible seulement par toi pour l&apos;instant.</p>}
        {item.status === "PENDING" && <p className="mt-2 text-xs text-gold">En vérification par un coach : visible seulement par toi.</p>}
        {item.status === "REJECTED" && <p className="mt-2 text-xs text-danger">Refusé : {item.reviewComment}</p>}
        {item.body && <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-text/85">{item.body}</p>}
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
