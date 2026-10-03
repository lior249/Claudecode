"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { availabilityAction } from "@/app/actions/coaching";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
type Slot = { weekday: number; start: string; end: string };

// Le coach coche ses jours et ses horaires ; à l'enregistrement, ses élèves reçoivent le planning.
export function AvailabilityEditor({ initial, timezone, learners }: { initial: Slot[]; timezone: string; learners: number }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      {DAYS.map((label, d) => {
        const day = slots.map((s, i) => ({ s, i })).filter((x) => x.s.weekday === d);
        return (
          <section key={d} className="rounded-3xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{label}</h2>
              {day.length === 0 && <span className="text-xs text-muted">Pas disponible</span>}
            </div>
            <div className="mt-2 space-y-2">
              {day.map(({ s, i }) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <input type="time" value={s.start} onChange={(e) => set(i, { start: e.target.value })} aria-label={`${label} : début`} className="rounded-xl border border-line bg-bg p-2" />
                  <span className="text-muted">à</span>
                  <input type="time" value={s.end} onChange={(e) => set(i, { end: e.target.value })} aria-label={`${label} : fin`} className="rounded-xl border border-line bg-bg p-2" />
                  <button onClick={() => setSlots((x) => x.filter((_, j) => j !== i))} className="rounded-full bg-card-2 p-1.5 text-muted" aria-label="Retirer ce créneau">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {day.length < 3 && (
                <button onClick={() => setSlots((x) => [...x, { weekday: d, start: "19:00", end: "21:00" }])} className="flex items-center gap-1 text-xs text-muted underline">
                  <Plus size={12} /> Ajouter un créneau
                </button>
              )}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-muted">Heures de ton fuseau ({timezone}). Chaque élève les reçoit converties dans son heure à lui.</p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await availabilityAction({ slots });
            if (res.ok) {
              setMsg({ ok: true, text: `Enregistré. ${learners} élève${learners > 1 ? "s ont" : " a"} reçu tes disponibilités.` });
              router.refresh();
            } else setMsg({ ok: false, text: res.error });
          })
        }
        className="w-full rounded-2xl bg-text py-3 font-semibold text-black disabled:opacity-40"
      >
        Enregistrer et envoyer à mes élèves
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
