"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Onglets de l'espace coach / admin : l'onglet actif est mis en avant et reste visible ; un fondu à droite indique qu'on peut faire défiler.
export function TabNav({ tabs }: { tabs: [href: string, label: string][] }) {
  const path = usePathname();
  const active = tabs.reduce<string | null>((best, [href]) => ((path === href || path.startsWith(href + "/")) && href.length > (best?.length ?? 0) ? href : best), null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>("[aria-current=page]");
    if (el && nav.current) nav.current.scrollLeft = el.offsetLeft - (nav.current.clientWidth - el.clientWidth) / 2;
  }, [active]);
  return (
    <div className="relative mb-6 lg:hidden">
      <nav ref={nav} className="flex gap-1 overflow-x-auto rounded-2xl bg-card p-1 text-sm [scrollbar-width:none]">
        {tabs.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={href === active ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-center transition ${href === active ? "bg-gold font-semibold text-black" : "text-muted hover:text-text"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <span className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-card to-transparent" aria-hidden />
    </div>
  );
}
