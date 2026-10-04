"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { gradeSubmissionAction } from "@/app/actions/admin-review";
import { computeScore, pointsLost } from "@/server/practice/scoring";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

// Correction critère par critère : nombre d'erreurs + commentaire ; la note s'affiche en direct (calcul du serveur à l'envoi).
export function GradeForm({ id, criteria, threshold, backHref }: { id: string; criteria: { id: string; instruction: string; pointsPerMiss: number }[]; threshold: number; backHref: string }) {
  const router = useRouter();
  const [misses, setMisses] = useState<Record<string, number>>(Object.fromEntries(criteria.map((c) => [c.id, 0])));
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preview = computeScore(criteria.map((c) => ({ pointsLost: pointsLost(misses[c.id] ?? 0, c.pointsPerMiss) })), threshold);
  const set = (cid: string, n: number) => setMisses((m) => ({ ...m, [cid]: Math.max(0, Math.min(99, n)) }));

  return (
    <section className="space-y-4 rounded-3xl border border-gold/40 bg-card p-4 lg:p-5">
      <h2 className="font-semibold">Ta correction</h2>
      {criteria.map((c, i) => (
        <div key={c.id} className="rounded-2xl bg-card-2/60 p-3">
          <p className="text-sm">
            <b>Critère {i + 1}.</b> {c.instruction} <span className="text-danger">(−{fmt(c.pointsPerMiss)} par erreur)</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted">Erreurs</span>
            <button type="button" onClick={() => set(c.id, (misses[c.id] ?? 0) - 1)} className="rounded-lg bg-card p-1.5" aria-label="Une erreur de moins">
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
              {misses[c.id] ?? 0}
            </span>
            <button type="button" onClick={() => set(c.id, (misses[c.id] ?? 0) + 1)} className="rounded-lg bg-card p-1.5" aria-label="Une erreur de plus">
              <Plus size={14} />
            </button>
            <span className="ml-auto text-sm text-danger">−{fmt(pointsLost(misses[c.id] ?? 0, c.pointsPerMiss))}</span>
          </div>
          <input
            value={comments[c.id] ?? ""}
            onChange={(e) => setComments((m) => ({ ...m, [c.id]: e.target.value }))}
            placeholder="Commentaire pour l'élève (où, quoi corriger…)"
            className="mt-2 w-full rounded-xl border border-line bg-bg p-2.5 text-sm"
          />
        </div>
      ))}
      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Mot général pour l'élève (facultatif si tu as commenté les critères)" className="w-full rounded-xl border border-line bg-bg p-3 text-sm" />
      <div className="flex items-center justify-between rounded-2xl bg-card-2 p-3">
        <span className="text-sm text-muted">Note</span>
        <span className={`text-2xl font-bold ${preview.passed ? "text-success" : "text-danger"}`}>
          {fmt(preview.score)}/10 · {preview.passed ? "validé" : `il faut ${fmt(threshold)}`}
        </span>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await gradeSubmissionAction({ id, grades: criteria.map((c) => ({ criterionId: c.id, misses: misses[c.id] ?? 0, comment: comments[c.id] ?? "" })), feedback });
            if (res.ok) router.push(backHref);
            else setError(res.error);
          })
        }
        className="w-full rounded-2xl bg-text py-3.5 font-semibold text-black disabled:opacity-40"
      >
        {pending ? "Envoi…" : "Envoyer la correction"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
