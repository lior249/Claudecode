"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCoachAction, removeCoachAction } from "@/app/actions/coaching";

export function AddCoach({ candidates }: { candidates: { id: string; label: string }[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askForce, setAskForce] = useState<string | null>(null);
  const nominate = (force: boolean) =>
    start(async () => {
      setError(null);
      const res = await addCoachAction({ userId, force });
      if (res.ok) {
        setUserId("");
        setAskForce(null);
        router.refresh();
      } else if ("needsForce" in res) setAskForce(res.error);
      else setError(res.error);
    });
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-semibold">Ajouter un coach</h2>
      <p className="mt-1 text-xs text-muted">Un coach doit normalement avoir terminé la formation (sinon, on te demande de confirmer). Il commence avec 3 étoiles et 20 places.</p>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Personne à ajouter pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <select value={userId} onChange={(e) => (setUserId(e.target.value), setAskForce(null))} className="min-w-0 flex-1 rounded-xl border border-line bg-bg p-2.5 text-sm" aria-label="Personne">
            <option value="">Choisir une personne…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending || !userId}
            onClick={() => nominate(false)}
            className="shrink-0 rounded-xl bg-text px-4 text-sm font-semibold text-black disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      )}
      {askForce && (
        <div className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <p>{askForce} Le nommer coach quand même ?</p>
          <p className="mt-1 text-xs text-muted">Il aura le rang de fin de formation (B) et rejoindra le classement.</p>
          <div className="mt-3 flex gap-2">
            <button disabled={pending} onClick={() => nominate(true)} className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">
              Nommer quand même
            </button>
            <button onClick={() => setAskForce(null)} className="rounded-xl bg-card-2 px-3 py-2 text-xs">
              Annuler
            </button>
          </div>
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
