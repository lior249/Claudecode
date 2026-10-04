"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import type { SidebarData } from "./view";

// Cadre de l'application : sur PC, menu à gauche et contenu décalé ; sur téléphone, rien ne change.
export function AppShell({ data, children }: { data: SidebarData | null; children: React.ReactNode }) {
  const path = usePathname();
  if (!data || path.startsWith("/login") || path === "/bienvenue") return <>{children}</>;
  return (
    <>
      <Sidebar data={data} />
      <div className="lg:pl-64">{children}</div>
    </>
  );
}
