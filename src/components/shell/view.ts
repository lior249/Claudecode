// Partagé entre le layout (serveur) et la barre latérale (navigateur).
export type ViewName = "Élève" | "Coach" | "Admin";
export const VIEWS: ViewName[] = ["Élève", "Coach", "Admin"];
/** Dernière vue utilisée : les pages communes (profil, classement…) gardent le menu de cette vue. */
export const VIEW_COOKIE = "creato_view";

export interface SidebarData {
  name: string;
  avatarUrl: string | null;
  unread: number;
  views: { href: string; label: string }[];
  participant: boolean; // accès à l'espace coaching
  coachStars: number | null;
  lastView: ViewName;
}
