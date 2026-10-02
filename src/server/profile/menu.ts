import "server-only";
import { unreadCount } from "@/server/notifications/service";
import { avatarOf, viewsFor } from "./service";

// Données de l'en-tête (cloche + menu) pour l'utilisateur connecté.
export async function accountBarData(u: { id: string; displayName: string; photoKey: string | null; avatarUrl: string | null; role: string; coachingStatus: string }) {
  return {
    user: { name: u.displayName, avatarUrl: avatarOf(u), views: viewsFor(u) },
    unread: await unreadCount(u.id),
  };
}
