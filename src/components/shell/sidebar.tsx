"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Flame,
  GraduationCap,
  Images,
  Inbox,
  LayoutGrid,
  ListTree,
  LogOut,
  MessageSquareText,
  RotateCcw,
  Settings,
  Star,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Avatar } from "@/components/profile/avatar";
import { Logo } from "@/components/mascot";
import { VIEW_COOKIE, type SidebarData, type ViewName } from "./view";

type Item = [href: string, label: string, icon: LucideIcon];

const NAV: Record<ViewName, (d: SidebarData) => Item[]> = {
  Élève: (d) => [
    ["/learn", "Parcours", BookOpen],
    ...(d.participant ? ([["/coaching", "Coaching", Flame]] as Item[]) : []),
    ["/resultats", "Résultats", Images],
    ["/classement", "Classement", Trophy],
    ["/profil", "Mon profil", User],
  ],
  Coach: () => [
    ["/coach", "Demandes", Inbox],
    ["/coach/learners", "Élèves", Users],
    ["/coach/proofs", "Résultats à vérifier", BadgeCheck],
    ["/coach/follow-ups", "Suivi", MessageSquareText],
    ["/coach/reactivations", "Retours", RotateCcw],
    ["/coach/availability", "Disponibilités", CalendarDays],
  ],
  Admin: () => [
    ["/admin", "Parcours", ListTree],
    ["/admin/learners", "Élèves", Users],
    ["/admin/reviews", "Validations", ClipboardCheck],
    ["/admin/catalogs", "Catalogues", LayoutGrid],
    ["/admin/results", "Types de résultats", Images],
    ["/admin/coaches", "Coachs", GraduationCap],
  ],
};

const viewOfPath = (path: string): ViewName | null =>
  path === "/admin" || path.startsWith("/admin/")
    ? "Admin"
    : path === "/coach" || path.startsWith("/coach/")
      ? "Coach"
      : path.startsWith("/learn") || path.startsWith("/coaching")
        ? "Élève"
        : null;

// Menu de gauche, seulement sur grand écran : sur téléphone, les en-têtes des pages restent en place.
export function Sidebar({ data }: { data: SidebarData }) {
  const path = usePathname();
  const fromPath = viewOfPath(path);
  // Pages communes (profil, classement, notifications, réglages) : on garde la dernière vue utilisée.
  const view = fromPath ?? data.lastView;
  useEffect(() => {
    if (fromPath) document.cookie = `${VIEW_COOKIE}=${encodeURIComponent(fromPath)}; path=/; max-age=31536000; samesite=lax`;
  }, [fromPath]);

  const items = NAV[view](data);
  const active = items.reduce<string | null>((best, [href]) => ((path === href || path.startsWith(href + "/")) && href.length > (best?.length ?? 0) ? href : best), null);
  const link = (on: boolean) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? "bg-gold font-semibold text-black" : "text-muted hover:bg-card hover:text-text"}`;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg px-4 py-6 lg:flex">
      <Link href={data.views.find((v) => v.label === view)?.href ?? "/learn"} className="px-2" aria-label="Creato">
        <Logo className="text-3xl" />
      </Link>

      {data.views.length > 1 && (
        <div className="mt-6 flex gap-1 rounded-xl bg-card p-1" aria-label="Changer de vue">
          {data.views.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              aria-current={v.label === view ? "true" : undefined}
              className={`flex-1 rounded-lg py-1.5 text-center text-sm ${v.label === view ? "bg-card-2 font-semibold text-text" : "text-muted hover:text-text"}`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      )}

      {view === "Coach" && data.coachStars !== null && (
        <p className="mt-4 flex items-center gap-1 px-3" title="Tes étoiles de coach" aria-label={`${data.coachStars} étoiles sur 6`}>
          {Array.from({ length: 6 }, (_, i) => (
            <Star key={i} size={14} className={i < data.coachStars! ? "text-gold" : "text-line"} fill={i < data.coachStars! ? "currentColor" : "none"} />
          ))}
        </p>
      )}

      <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label={`Menu ${view.toLowerCase()}`}>
        {items.map(([href, label, Icon]) => (
          <Link key={href} href={href} aria-current={href === active ? "page" : undefined} className={link(href === active)}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line pt-4">
        <Link href="/notifications" className={link(path === "/notifications")}>
          <Bell size={18} /> Notifications
          {data.unread > 0 && <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
        </Link>
        <Link href="/reglages" className={link(path === "/reglages")}>
          <Settings size={18} /> Réglages
        </Link>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-2.5">
          <Link href="/profil" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Mon profil">
            <Avatar name={data.name} url={data.avatarUrl} size={36} />
            <span className="line-clamp-2 break-words text-sm font-semibold leading-tight">{data.name}</span>
          </Link>
          <form action={logout}>
            <button className="rounded-full p-2 text-muted hover:bg-card-2 hover:text-danger" aria-label="Déconnexion" title="Déconnexion">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
