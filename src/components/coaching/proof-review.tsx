"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { reviewProofAction } from "@/app/actions/coaching";

interface Props {
  kind: "views" | "rank";
  id: string;
  learner: string;
  imageUrl: string;
  title: string;
  hint: string;
  /** Chiffres déclarés par l'élève, à comparer avec la capture et la vidéo. */
  declared: { label: string; value: string }[];
  /** Vidéos (ou profil) à ouvrir pour vérifier. */
  links: { label: string; url: string }[];
  views?: number;
}

export function ProofReview(props: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState(String(props.views ?? ""));
  const [comment, setComment] = useState("");
  const [verified, setVerified] = useState(false);
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await reviewProofAction({
        kind: props.kind,
        proofId: props.id,
        approve,
        views: props.kind === "views" && views ? Number(views) : undefined,
        comment,
        verified,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <p className="text-sm text-muted">{props.learner}</p>
      <p className="font-semibold">{props.title}</p>
      <p className="text-xs text-muted">{props.hint}</p>

      {props.declared.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {props.declared.map((d) => (
            <div key={d.label} className="rounded-2xl bg-card-2 p-2">
              <p className="text-sm font-bold">{d.value}</p>
              <p className="text-[11px] text-muted">{d.label}</p>
            </div>
          ))}
        </div>
      )}

      {props.links.length > 0 && (
        <ul className="mt-3 space-y-1">
          {props.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-sm underline">
                {l.label} <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}

      <a href={props.imageUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.imageUrl} alt="Capture envoyée" className="mt-3 max-h-80 w-full rounded-2xl bg-black object-contain" />
      </a>
      {props.kind === "views" && (
        <label className="mt-3 block text-xs text-muted">
          Vues réelles (corrige si besoin)
          <input value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-bg p-2.5 text-sm text-text" />
        </label>
      )}
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-success)]" />
        <span>J&apos;ai ouvert {props.kind === "views" ? "la vidéo" : "les liens"} : la capture et les chiffres déclarés concordent.</span>
      </label>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (obligatoire si refus)" className="mt-2 w-full rounded-xl border border-line bg-bg p-2.5 text-sm" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={pending || !comment.trim()} onClick={() => decide(false)} className="rounded-2xl border border-danger/60 py-3 text-sm font-semibold text-danger disabled:opacity-40">
          Refuser
        </button>
        <button disabled={pending || !verified} onClick={() => decide(true)} className="rounded-2xl bg-success py-3 text-sm font-semibold text-black disabled:opacity-40">
          Valider
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}
