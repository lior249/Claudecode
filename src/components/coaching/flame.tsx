import { FlameIcon } from "@/components/ui/icons";

// Flamme du streak : plus la chaîne est longue, plus elle grossit et change de couleur.
export function Flame({ level, days, size = 28 }: { level: number; days: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <FlameIcon size={size * (1 + level * 0.08)} level={level} />
      <span className="font-bold tabular-nums">{days}</span>
    </span>
  );
}
