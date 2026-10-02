"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewProofAction } from "@/app/actions/coaching";

export function ProofReview(props: { kind: "views" | "rank"; id: string; learner: string; imageUrl: string; title: string; hint: string; views?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState(String(props.views ?? ""));
  const [comment, setComment] = useState("");
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await reviewProofAction({
        kind: props.kind,
        proofId: props.id,
        approve,
        views: props.kind === "views" && views ? Number(views) : undefined,
        comment,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{props.learner}</p>
      <p className="font-semibold">{props.title}</p>
      <p className="truncate text-xs text-muted">{props.hint}</p>
      <a href={props.imageUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.imageUrl} alt="Capture envoyée" className="mt-3 max-h-80 w-full rounded-2xl object-contain bg-black" />
      </a>
      {props.kind === "views" && (
        <label className="mt-3 block text-xs text-muted">
          Vues lues sur la capture (corrige si besoin)
          <input value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-bg p-2.5 text-sm text-text" />
        </label>
      )}
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (obligatoire si refus)" className="mt-2 w-full rounded-xl border border-line bg-bg p-2.5 text-sm" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={pending || !comment.trim()} onClick={() => decide(false)} className="rounded-2xl border border-danger/60 py-3 text-sm font-semibold text-danger disabled:opacity-40">
          Refuser
        </button>
        <button disabled={pending} onClick={() => decide(true)} className="rounded-2xl bg-success py-3 text-sm font-semibold text-black disabled:opacity-40">
          Valider
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
