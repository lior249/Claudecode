"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { capacityAction } from "@/app/actions/coaching";

export function CapacityEditor({ coachId, active, capacity }: { coachId: string; active: number; capacity: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(capacity));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">{active} /</span>
      <input value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-14 rounded-xl border border-line bg-bg p-2 text-center" aria-label="Nombre de places" />
      <span className="text-muted">places</span>
      {value !== String(capacity) && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await capacityAction({ coachId, capacity: Number(value) });
              if (res.ok) router.refresh();
              else setError(res.error);
            })
          }
          className="rounded-xl bg-text px-3 py-2 text-xs font-semibold text-black"
        >
          OK
        </button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
