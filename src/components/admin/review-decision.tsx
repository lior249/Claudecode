"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideReviewAction } from "@/app/actions/admin-review";

export function ReviewDecision({ id }: { id: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (decision: "APPROVE" | "REJECT") =>
    start(async () => {
      setError(null);
      const res = await decideReviewAction({ id, decision, comment });
      if (res.ok) router.push("/admin/reviews");
      else setError(res.error);
    });
  return (
    <section className="space-y-3 rounded-3xl border border-gold/40 bg-card p-4">
      <h2 className="font-semibold">Ta décision</h2>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="Commentaire pour l'élève (obligatoire en cas de refus : ce qu'il doit corriger)"
        className="w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold"
      />
      <div className="grid grid-cols-2 gap-2">
        <button disabled={pending} onClick={() => decide("REJECT")} className="rounded-2xl border border-danger/60 py-3 font-semibold text-danger disabled:opacity-40">
          Refuser
        </button>
        <button disabled={pending} onClick={() => decide("APPROVE")} className="rounded-2xl bg-success py-3 font-semibold text-black disabled:opacity-40">
          Valider
        </button>
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </section>
  );
}
