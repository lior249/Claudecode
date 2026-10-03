// Icônes colorées pleines (même style partout) : flamme, couronne, trophée, gel.
// Dégradés SVG à identifiants fixes : plusieurs icônes identiques sur une page partagent la même définition.

type IconProps = { size?: number; className?: string };

const FLAME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z";
const FLAME_CORE = "M12 13.2c.9 1.3 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.2.6-1.9 1.2-2.6.6-.6 1.3-1.2 1.4-2Z";

// Palette par niveau de flamme : 0 éteinte, 1 orange, 2 brûlante, 3 bleue, 4 violette.
const FLAMES = [
  null,
  { id: "fl1", outer: ["#ffd23f", "#ff8a00", "#ff4d00"], core: "#ffe9a6", glow: "" },
  { id: "fl2", outer: ["#ffe066", "#ff6a00", "#e8210b"], core: "#fff1b8", glow: "drop-shadow(0 0 5px rgba(255,106,0,.7))" },
  { id: "fl3", outer: ["#c9f1ff", "#38bdf8", "#1d4ed8"], core: "#ecfbff", glow: "drop-shadow(0 0 7px rgba(56,189,248,.8))" },
  { id: "fl4", outer: ["#ffd1f5", "#e879f9", "#7c3aed"], core: "#fff0fd", glow: "drop-shadow(0 0 9px rgba(232,121,249,.9))" },
];

export function FlameIcon({ size = 24, level = 1, className = "" }: IconProps & { level?: number }) {
  const f = FLAMES[Math.min(level, 4)];
  if (!f)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
        <path d={FLAME} fill="#2a2a2c" stroke="#636366" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`${className} ${level >= 4 ? "animate-pulse" : ""}`} style={{ filter: f.glow || undefined }} aria-hidden>
      <defs>
        <linearGradient id={f.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={f.outer[0]} />
          <stop offset=".5" stopColor={f.outer[1]} />
          <stop offset="1" stopColor={f.outer[2]} />
        </linearGradient>
      </defs>
      <path d={FLAME} fill={`url(#${f.id})`} />
      <path d={FLAME_CORE} fill={f.core} opacity=".9" />
    </svg>
  );
}

const GOLD = (
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#fff2a8" />
    <stop offset=".45" stopColor="#f5b301" />
    <stop offset="1" stopColor="#b97800" />
  </linearGradient>
);

export function CrownIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ filter: "drop-shadow(0 0 6px rgba(245,179,1,.55))" }} aria-hidden>
      <defs>{GOLD}</defs>
      <path d="M2.5 7.5 7.4 11 12 3.5l4.6 7.5 4.9-3.5-1.9 10.5H4.4L2.5 7.5Z" fill="url(#gold)" stroke="#8a5a00" strokeWidth=".8" strokeLinejoin="round" />
      <rect x="4.4" y="18" width="15.2" height="2.6" rx="1" fill="url(#gold)" stroke="#8a5a00" strokeWidth=".8" />
      <circle cx="12" cy="13.6" r="1.5" fill="#ff4d6d" />
      <circle cx="7.6" cy="14.6" r="1" fill="#38bdf8" />
      <circle cx="16.4" cy="14.6" r="1" fill="#30d158" />
    </svg>
  );
}

export function TrophyIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>{GOLD}</defs>
      <path d="M6.5 5H3.8v1.6A4 4 0 0 0 7.6 11M17.5 5h2.7v1.6a4 4 0 0 1-3.8 4.4" fill="none" stroke="#d99a00" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.3 3h11.4v5.2a5.7 5.7 0 0 1-11.4 0V3Z" fill="url(#gold)" stroke="#8a5a00" strokeWidth=".8" />
      <path d="M10.6 13.6h2.8v3.6h-2.8z" fill="#d99a00" />
      <rect x="7" y="17.2" width="10" height="3.6" rx="1.2" fill="url(#gold)" stroke="#8a5a00" strokeWidth=".8" />
      <path d="M9 5.2v3" stroke="#fff8d6" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}
