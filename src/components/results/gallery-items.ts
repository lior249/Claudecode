import type { GalleryItem } from "./post-gallery";
import { eur, monthLabel } from "@/components/profile/member-stats";

// Conversions vers la galerie : résultats du mois (validés) et posts de résultats.
export const monthItems = (months: { id: string; month: string; amountEur: number; imageUrl: string; description: string; isBest: boolean }[]): GalleryItem[] =>
  months.map((m) => ({
    id: m.id,
    title: `${monthLabel(m.month).replace(/^./, (c) => c.toUpperCase())} · ${eur(m.amountEur)}`,
    body: m.description,
    imageUrl: m.imageUrl,
    tag: m.isBest ? "🏆 Meilleur mois" : null,
    status: "APPROVED",
  }));

