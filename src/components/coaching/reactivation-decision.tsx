"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reactivationDecisionAction } from "@/app/actions/coaching";

export function ReactivationDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (accept: boolean) =>
    start(async () => {
      const res = await reactivationDecisionAction({ requestId, accept });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <button disabled={pending} onClick={() => decide(false)} className="rounded-2xl border border-line py-3 text-sm">
          Refuser
        </button>
        <button disabled={pending} onClick={() => decide(true)} className="rounded-2xl bg-success py-3 text-sm font-semibold text-black">
          Réactiver
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
