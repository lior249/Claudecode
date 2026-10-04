"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Images, LogOut, Settings, Trophy, User } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Avatar } from "./avatar";

export interface MenuUser {
  name: string;
  avatarUrl: string | null;
  views: { href: string; label: string }[];
}

// Rond de la photo de profil : un clic ouvre le menu (profil, classement, changer de vue, déconnexion).
export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const current = path.startsWith("/admin") ? "Admin" : path.startsWith("/coach/") || path === "/coach" ? "Coach" : "Élève";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-card-2";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Mon compte" aria-expanded={open} className="block rounded-full ring-2 ring-transparent transition hover:ring-line">
        <Avatar name={user.name} url={user.avatarUrl} size={36} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-card p-1.5 shadow-2xl shadow-black/60" role="menu">
          <p className="line-clamp-2 break-words leading-snug px-3 pb-2 pt-1.5 text-sm font-semibold">{user.name}</p>
          <Link href="/profil" className={item} onClick={() => setOpen(false)} role="menuitem">
            <User size={16} className="text-muted" /> Mon profil
          </Link>
          <Link href="/classement" className={item} onClick={() => setOpen(false)} role="menuitem">
            <Trophy size={16} className="text-muted" /> Classement
          </Link>
          <Link href="/resultats" className={item} onClick={() => setOpen(false)} role="menuitem">
            <Images size={16} className="text-muted" /> Résultats
          </Link>
          <Link href="/reglages" className={item} onClick={() => setOpen(false)} role="menuitem">
            <Settings size={16} className="text-muted" /> Réglages
          </Link>
          {user.views.length > 1 && (
            <div className="my-1 border-y border-line py-1">
              <p className="px-3 pb-1 pt-1.5 text-xs uppercase tracking-wider text-muted">Changer de vue</p>
              {user.views.map((v) => (
                <Link key={v.href} href={v.href} className={item} onClick={() => setOpen(false)} role="menuitem">
                  <span className="w-4">{v.label === current && <Check size={16} className="text-gold" />}</span>
                  Vue {v.label.toLowerCase()}
                </Link>
              ))}
            </div>
          )}
          <form action={logout}>
            <button className={`${item} text-danger`} role="menuitem">
              <LogOut size={16} /> Déconnexion
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
