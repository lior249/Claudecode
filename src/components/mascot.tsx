import type { Mood } from "@/server/notifications/rules";

export type { Mood };

// La mascotte Creato et ses expressions (images dans public/mascotte).
export function Mascot({ mood, size = 96, className = "", label }: { mood: Mood | "logo"; size?: number; className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/mascotte/${mood}.png`} alt={label ?? ""} width={size} height={size} className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} draggable={false} />
  );
}

// Logo : la mascotte blanche suivie du nom.
export function Logo({ className = "text-3xl" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascotte/logo.png" alt="" className="h-[1.05em] w-[1.05em] shrink-0 object-contain" draggable={false} />
      <span className="logo">Creato</span>
    </span>
  );
}

// État vide ou message important : la mascotte au-dessus d'un texte centré.
export function MascotState({ mood, title, children, size = 96 }: { mood: Mood; title?: string; children?: React.ReactNode; size?: number }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-card p-6 text-center">
      <Mascot mood={mood} size={size} />
      {title && <p className="mt-3 text-lg font-semibold">{title}</p>}
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
