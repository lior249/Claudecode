"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { reviewResultAction } from "@/app/actions/results";
import { Mascot } from "@/components/mascot";

export interface PendingResult {
  id: string;
  author: string;
  typeName: string;
  metric: "NONE" | "VIEWS" | "REVENUE_EUR" | "FOLLOWERS";
  metricLabel: string;
  title: string;
  body: string;
  link: string | null;
  imageUrl: string;
  dailyCode: string;
  metricValue: number | null;
  aiProblems: string[];
  aiCodeFound: boolean | null;
}

// Vérification à la main d'un résultat que l'IA n'a pas validé (ou n'a pas pu lire).
export function ResultPostReview({ p }: { p: PendingResult }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [comment, setComment] = useState("");
  const [value, setValue] = useState(p.metricValue === null ? "" : String(p.metricValue));
  const [error, setError] = useState<string | null>(null);
  const needsValue = p.metric !== "NONE";
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await reviewResultAction({ postId: p.id, approve, comment, metricValue: needsValue && value ? Number(value) : null });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  return (
    <section className="rounded-3xl border border-line bg-card p-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
      <div>
        <p className="text-sm text-muted">
          {p.author} · {p.typeName}
        </p>
        <p className="font-semibold">{p.title}</p>
        {p.body && <p className="mt-1 whitespace-pre-line text-sm text-muted">{p.body}</p>}
        {p.link && (
          <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-sm underline">
            Ouvrir le lien <ExternalLink size={12} />
          </a>
        )}
        <a href={p.imageUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt="Capture envoyée" className="mt-3 max-h-96 w-full rounded-2xl bg-black object-contain lg:max-h-[30rem]" />
        </a>
      </div>
      <div className="mt-3 space-y-3 lg:mt-0">
        <div className="flex gap-3 rounded-2xl bg-card-2 p-3 text-sm">
          <Mascot mood="doute" size={40} />
          <div>
            <p className="font-semibold">Ce que l&apos;IA a relevé</p>
            {p.aiProblems.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                {p.aiProblems.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted">Rien de précis.</p>
            )}
            <p className="mt-1 text-muted">
              Code du jour attendu : <b className="font-mono text-gold">{p.dailyCode}</b>
              {p.aiCodeFound === false && " (non trouvé par l'IA)"}
            </p>
          </div>
        </div>
        {needsValue && (
          <label className="block text-xs text-muted">
            {p.metricLabel} lus sur la capture (corrige si besoin)
            <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-bg p-2.5 text-sm text-text" />
          </label>
        )}
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (obligatoire si refus)" className="w-full rounded-xl border border-line bg-bg p-2.5 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <button disabled={pending || !comment.trim()} onClick={() => decide(false)} className="rounded-2xl border border-danger/60 py-3 text-sm font-semibold text-danger disabled:opacity-40">
            Refuser
          </button>
          <button disabled={pending || (needsValue && !value)} onClick={() => decide(true)} className="rounded-2xl bg-success py-3 text-sm font-semibold text-black disabled:opacity-40">
            Publier
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
