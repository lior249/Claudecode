"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCoachAction, removeCoachAction } from "@/app/actions/coaching";

export function AddCoach({ candidates }: { candidates: { id: string; label: string }[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-semibold">Ajouter un coach</h2>
      <p className="mt-1 text-xs text-muted">Seuls les membres qui ont terminé toute la formation peuvent devenir coach. Ils commencent avec 3 étoiles et 20 places.</p>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Personne à ajouter pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-bg p-2.5 text-sm" aria-label="Personne">
            <option value="">Choisir une personne…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !userId}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await addCoachAction({ userId });
                if (res.ok) {
                  setUserId("");
                  router.refresh();
                } else setError(res.error);
              })
            }
            className="shrink-0 rounded-xl bg-text px-4 text-sm font-semibold text-black disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}

export function RemoveCoach({ coachId, name }: { coachId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Retirer ${name} de l'équipe de coachs ?`)) return;
          start(async () => {
            setError(null);
            const res = await removeCoachAction({ coachId });
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
        className="text-xs text-muted underline"
      >
        Retirer des coachs
      </button>
      {error && <span className="mt-1 max-w-56 text-right text-xs text-danger">{error}</span>}
    </span>
  );
}
