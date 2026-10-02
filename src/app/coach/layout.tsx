import Link from "next/link";
import { Star } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { unreadCount } from "@/server/notifications/service";
import { NotificationBell } from "@/components/notifications/bell";
import { TimezoneSync } from "@/components/notifications/timezone-sync";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const user = await requireUser(["COACH", "ADMIN"]);
  const tabs = [
    ["/coach", "Demandes"],
    ["/coach/learners", "Élèves"],
    ["/coach/proofs", "Preuves"],
    ["/coach/follow-ups", "Suivi"],
    ["/coach/reactivations", "Retours"],
  ];
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16">
      <TimezoneSync known={!!user.timezone} />
      <header className="flex items-center justify-between py-5">
        <Link href="/coach" className="flex items-baseline gap-2">
          <span className="logo text-3xl">Creato</span>
          <span className="text-sm font-medium text-gold">Coach</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell unread={await unreadCount(user.id)} />
          <span className="flex items-center gap-0.5 rounded-full bg-card px-3 py-2 text-xs" title="Tes étoiles de coach">
            {Array.from({ length: 6 }, (_, i) => (
              <Star key={i} size={12} className={i < user.coachStars ? "text-gold" : "text-line"} fill={i < user.coachStars ? "currentColor" : "none"} />
            ))}
          </span>
          {user.role === "ADMIN" && (
            <Link href="/admin" className="rounded-full bg-card px-3 py-2 text-xs text-muted">
              Admin
            </Link>
          )}
        </div>
      </header>
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 text-sm">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className="flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-center">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
