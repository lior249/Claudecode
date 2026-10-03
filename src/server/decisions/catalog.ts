import { z } from "zod";
import type { Catalog } from "@/generated/prisma/enums";

// Libellés et règles des catalogues (purs, partagés serveur/navigateur).

export const CATALOGS: Record<Catalog, { label: string; plural: string; one: string; choose: string; add: string; configKey: string }> = {
  NICHE: { label: "Niche", plural: "Niches", one: "une niche", choose: "Choisir cette niche", add: "Ajouter une niche", configKey: "niches" },
  COUNTRY: { label: "Pays", plural: "Pays", one: "un pays", choose: "Choisir ce pays", add: "Ajouter un pays", configKey: "countries" },
  METHOD_10K: {
    label: "Méthode 10K",
    plural: "Méthodes 10K",
    one: "une méthode",
    choose: "Choisir cette méthode",
    add: "Ajouter une méthode 10K",
    configKey: "methods10k",
  },
};

// Couleurs possibles d'une option de critère (pastille dans la liste et la fiche).
export const OPTION_COLORS = ["gray", "green", "yellow", "red", "blue", "purple"] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];
export const OPTION_COLOR_LABELS: Record<OptionColor, string> = { gray: "Gris", green: "Vert", yellow: "Jaune", red: "Rouge", blue: "Bleu", purple: "Violet" };
export const asOptionColor = (c: string): OptionColor => ((OPTION_COLORS as readonly string[]).includes(c) ? (c as OptionColor) : "gray");

/** Une pastille de fiche : l'option retenue pour un critère. */
export interface CatalogTag {
  criterion: string;
  label: string;
  color: OptionColor;
}

// Une seule option par critère : garde la première option de chaque critère.
export function onePerCriterion<T extends { criterionId: string }>(options: T[]) {
  const seen = new Set<string>();
  return options.filter((o) => (seen.has(o.criterionId) ? false : (seen.add(o.criterionId), true)));
}

// Catalogue d'une leçon Décision, à partir de Lesson.config.catalog.
export function catalogOfLesson(config: unknown): Catalog | null {
  const key = (config as { catalog?: unknown } | null)?.catalog;
  const found = (Object.keys(CATALOGS) as Catalog[]).find((c) => CATALOGS[c].configKey === key || c === key);
  return found ?? null;
}

export const linkSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "Lien http(s) uniquement"),
});
export type CatalogLink = z.infer<typeof linkSchema>;

export function parseLinks(raw: unknown): CatalogLink[] {
  const parsed = z.array(linkSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}
export function parseKeys(raw: unknown): string[] {
  const parsed = z.array(z.string()).safeParse(raw);
  return parsed.success ? parsed.data : [];
}
