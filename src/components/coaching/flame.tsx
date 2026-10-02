import { Flame as FlameIcon } from "lucide-react";

// Flamme du streak : plus la chaîne est longue, plus elle grossit et change de couleur.
const STYLES = [
  "text-muted",
  "text-orange-400",
  "text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.7)]",
  "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]",
  "text-fuchsia-400 drop-shadow-[0_0_10px_rgba(232,121,249,0.9)] animate-pulse",
];

export function Flame({ level, days, size = 28 }: { level: number; days: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <FlameIcon size={size * (1 + level * 0.08)} className={STYLES[level] ?? STYLES[0]} fill={level ? "currentColor" : "none"} />
      <span className="font-bold tabular-nums">{days}</span>
    </span>
  );
}
