import Link from "next/link";
import { Bell } from "lucide-react";

// Cloche des notifications (utilisable côté serveur et côté client).
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link href="/notifications" className="relative rounded-full bg-card p-2 text-muted" aria-label={unread ? `${unread} notification(s) non lue(s)` : "Notifications"}>
      <Bell size={16} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
