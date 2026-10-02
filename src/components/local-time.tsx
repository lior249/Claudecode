"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Date affichée dans le fuseau de la personne qui regarde (calculée dans son navigateur, jamais sur le serveur).
export function LocalTime({ iso, date = false }: { iso: string; date?: boolean }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!isClient) return <span className="opacity-0">00/00/0000</span>;
  const d = new Date(iso);
  return <>{date ? d.toLocaleDateString("fr-FR") : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</>;
}
