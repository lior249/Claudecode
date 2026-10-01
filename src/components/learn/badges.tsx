import type { LessonType } from "@/generated/prisma/enums";
import type { Rank } from "@/server/learn/progression";

export const LESSON_TYPES: Record<LessonType, { letter: string; label: string; className: string; action: string }> = {
  UNDERSTANDING: { letter: "U", label: "Compréhension", className: "bg-type-u text-black", action: "Commencer le QCM" },
  PRACTICE_AI: { letter: "P", label: "Pratique", className: "bg-type-p text-white", action: "Envoyer ma réalisation" },
  PRACTICE_HUMAN: { letter: "P", label: "Pratique", className: "bg-type-p text-white", action: "Envoyer ma réalisation" },
  DECISION: { letter: "D", label: "Décision", className: "bg-type-d text-white", action: "Faire mon choix" },
  CODE_VALIDATION: { letter: "V", label: "Validation", className: "bg-type-v text-black", action: "Valider mon lancement" },
};

export function TypeBadge({ type, size = 32 }: { type: LessonType; size?: number }) {
  const t = LESSON_TYPES[type];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${t.className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-label={t.label}
    >
      {t.letter}
    </span>
  );
}

const RANK_STYLES: Record<Rank, string> = {
  E: "from-zinc-500 to-zinc-700",
  D: "from-emerald-400 to-emerald-700",
  C: "from-sky-400 to-blue-700",
  B: "from-violet-400 to-purple-700",
  A: "from-rose-400 to-red-700",
  S: "from-amber-300 to-yellow-600",
  SS: "from-amber-200 to-orange-500",
  SSS: "from-yellow-100 via-amber-300 to-orange-500",
};

export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-lg ${RANK_STYLES[rank]}`}
      style={{ width: size, height: size, fontSize: rank.length > 1 ? size * 0.32 : size * 0.48 }}
      aria-label={`Rang ${rank}`}
    >
      {rank}
    </span>
  );
}
