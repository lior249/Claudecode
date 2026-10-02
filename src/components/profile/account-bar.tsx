import { NotificationBell } from "@/components/notifications/bell";
import { UserMenu, type MenuUser } from "./user-menu";

// En-tête à droite : cloche + rond de la photo de profil.
export function AccountBar({ user, unread }: { user: MenuUser; unread: number }) {
  return (
    <div className="flex items-center gap-2">
      <NotificationBell unread={unread} />
      <UserMenu user={user} />
    </div>
  );
}
