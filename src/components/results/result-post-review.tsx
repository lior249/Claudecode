"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { reviewResultPostAction } from "@/app/actions/results";

// Validation d'un post de résultat par le coach (ou l'admin pour les coachs).
export function ResultPostReview(p: { id: string; author: string; title: string; body: string; link: string | null; imageUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await reviewResultPostAction({ postId: p.id, approve, comment });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{p.author} · post de résultat</p>
      <p className="font-semibold">{p.title}</p>
      {p.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{p.body}</p>}
      {p.link && (
        <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-sm underline">
          Ouvrir le lien <ExternalLink size={12} />
        </a>
      )}
      <a href={p.imageUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.imageUrl} alt="Capture du post" className="mt-3 max-h-80 w-full rounded-2xl bg-black object-contain" />
      </a>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (obligatoire si refus)" className="mt-3 w-full rounded-xl border border-line bg-bg p-2.5 text-sm" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={pending || !comment.trim()} onClick={() => decide(false)} className="rounded-2xl border border-danger/60 py-3 text-sm font-semibold text-danger disabled:opacity-40">
          Refuser
        </button>
        <button disabled={pending} onClick={() => decide(true)} className="rounded-2xl bg-success py-3 text-sm font-semibold text-black disabled:opacity-40">
          Publier
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
