import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications/service";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { TimezoneSync } from "@/components/notifications/timezone-sync";
import { isMood, stripLeadingEmoji } from "@/server/notifications/rules";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const back = user.role === "LEARNER" ? (user.coachingStatus === "NONE" ? "/learn" : "/coaching") : "/coach";
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <TimezoneSync known={!!user.timezone} />
      <header className="flex items-center gap-3 py-5">
        <Link href={back} className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold">Notifications</h1>
      </header>
      <NotificationCenter
        items={items.map((n) => ({ id: n.id, text: stripLeadingEmoji(n.text), href: n.href, mood: isMood(n.mood) ? n.mood : "neutre", createdAt: n.createdAt.toISOString(), unread: !n.readAt }))}
      />
    </main>
  );
}
