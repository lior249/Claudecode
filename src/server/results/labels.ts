// Libellés des résultats (purs, partagés serveur / navigateur).

export type Metric = "NONE" | "VIEWS" | "REVENUE_EUR" | "FOLLOWERS";
export type Special = "NONE" | "MONTHLY_REVENUE" | "FOLLOWERS_RANK";
export interface Tier {
  min: number;
  points: number;
}

export const METRIC_LABELS: Record<Metric, { label: string; unit: string; read: string }> = {
  NONE: { label: "Aucun chiffre", unit: "", read: "" },
  VIEWS: { label: "Vues", unit: "vues", read: "le nombre total de vues de la vidéo" },
  REVENUE_EUR: { label: "Revenus (€)", unit: "€", read: "le montant total gagné, en euros (arrondi à l'euro)" },
  FOLLOWERS: { label: "Abonnés", unit: "abonnés", read: "le nombre d'abonnés du compte" },
};

