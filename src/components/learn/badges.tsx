import type { LessonType } from "@/generated/prisma/enums";
import type { Rank } from "@/server/learn/progression";
import { BookOpen, Clapperboard, Compass, Flag, type LucideIcon } from "lucide-react";

export const LESSON_TYPES: Record<LessonType, { letter: string; label: string; className: string; action: string }> = {
  UNDERSTANDING: { letter: "U", label: "Compréhension", className: "bg-type-u text-black", action: "Commencer le QCM" },
  PRACTICE_AI: { letter: "P", label: "Pratique", className: "bg-type-p text-white", action: "Envoyer ma réalisation" },
  PRACTICE_HUMAN: { letter: "P", label: "Pratique", className: "bg-type-p text-white", action: "Envoyer ma réalisation" },
  DECISION: { letter: "D", label: "Décision", className: "bg-type-d text-white", action: "Faire mon choix" },
  CODE_VALIDATION: { letter: "V", label: "Validation", className: "bg-type-v text-black", action: "Valider mon lancement" },
};

export const TYPE_ICONS: Record<LessonType, LucideIcon> = {
  UNDERSTANDING: BookOpen,
  PRACTICE_AI: Clapperboard,
  PRACTICE_HUMAN: Clapperboard,
  DECISION: Compass,
  CODE_VALIDATION: Flag,
};

// Rond coloré avec l'icône du type de leçon (livre, clap, boussole, drapeau).
export function TypeBadge({ type, size = 32 }: { type: LessonType; size?: number }) {
  const t = LESSON_TYPES[type];
  const Icon = TYPE_ICONS[type];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full ${t.className}`} style={{ width: size, height: size }} role="img" aria-label={t.label}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.4} />
    </span>
  );
}

// Rangs en métaux : bois, bronze, argent, or, platine, diamant, rubis, légendaire.
const METALS: Record<Rank, { name: string; stops: string[]; rim: string; ink: string; glow?: string }> = {
  E: { name: "Bois", stops: ["#d9a066", "#9a6532", "#5e3a17"], rim: "#3d2410", ink: "#fff3e0" },
  D: { name: "Bronze", stops: ["#f6c08e", "#c47a3d", "#7a4119"], rim: "#4f2a10", ink: "#ffffff" },
  C: { name: "Argent", stops: ["#ffffff", "#c9d1d9", "#7d8794"], rim: "#4b535c", ink: "#1f2933" },
  B: { name: "Or", stops: ["#fff2a8", "#f5b301", "#a86b00"], rim: "#5e3c00", ink: "#3b2500" },
  A: { name: "Platine", stops: ["#f4fffd", "#b9d9d6", "#6f9995"], rim: "#36524f", ink: "#173331" },
  S: { name: "Diamant", stops: ["#c9f1ff", "#38bdf8", "#1d4ed8"], rim: "#102a6b", ink: "#ffffff", glow: "rgba(56,189,248,.6)" },
  SS: { name: "Rubis", stops: ["#ffb3c0", "#f43f5e", "#9f1239"], rim: "#4c0519", ink: "#ffffff", glow: "rgba(244,63,94,.6)" },
  SSS: { name: "Légendaire", stops: ["#fff7ae", "#ff9ad5", "#8b9bff", "#5ef2d6"], rim: "#3b1d6e", ink: "#ffffff", glow: "rgba(255,154,213,.75)" },
};
const SHIELD = "M22 1.5 40 8.5V23c0 10.5-7.6 17.6-18 21.5C11.6 40.6 4 33.5 4 23V8.5L22 1.5Z";
const INNER = "M22 5.6 36.4 11.3V23c0 8.4-6 14.3-14.4 17.6C13.6 37.3 7.6 31.4 7.6 23V11.3L22 5.6Z";

export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const m = METALS[rank];
  const id = `rk-${rank}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 46"
      className="shrink-0"
      style={m.glow ? { filter: `drop-shadow(0 0 ${Math.max(3, size / 9)}px ${m.glow})` } : undefined}
      role="img"
      aria-label={`Rang ${rank} (${m.name})`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {m.stops.map((c, i) => (
            <stop key={i} offset={i / (m.stops.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.stops[0]} />
          <stop offset="1" stopColor={m.rim} />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${id}-rim)`} />
      <path d={INNER} fill={`url(#${id})`} />
      <path d="M7.6 11.3 22 5.6l14.4 5.7V17C27 13 17 13 7.6 19Z" fill="#fff" opacity=".22" />
      <text
        x="22"
        y={rank.length > 2 ? 28.5 : 30}
        textAnchor="middle"
        fontSize={rank.length > 2 ? 12 : rank.length > 1 ? 15 : 20}
        fontWeight="800"
        fill={m.ink}
        stroke={m.rim}
        strokeWidth=".6"
        paintOrder="stroke"
        letterSpacing={rank.length > 1 ? "-0.5" : "0"}
        fontFamily="var(--font-poppins), system-ui, sans-serif"
      >
        {rank}
      </text>
    </svg>
  );
}

export const RANK_METAL: Record<Rank, string> = Object.fromEntries(Object.entries(METALS).map(([r, m]) => [r, m.name])) as Record<Rank, string>;
