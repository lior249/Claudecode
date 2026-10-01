"use client";

import { useEffect, useState } from "react";

const REMINDER_MS = 4 * 60 * 60 * 1000;

function format(ms: number) {
  const m = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} h ${String(m % 60).padStart(2, "0")}`;
  return `${m % 60} min`;
}

// Temps restant sur le délai de 24 h (affichage seulement : le serveur fait foi).
export function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="text-muted">…</span>;

  const left = new Date(deadlineAt).getTime() - now;
  if (left <= 0) return <span className="font-semibold text-danger">Délai dépassé de {format(left)}</span>;
  return (
    <span className={left < REMINDER_MS ? "font-semibold text-gold" : "text-muted"}>
      Il te reste <span className="font-semibold text-text">{format(left)}</span>
    </span>
  );
}
