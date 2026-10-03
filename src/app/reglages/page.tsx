import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { viewsFor } from "@/server/profile/service";
import { accountBarData } from "@/server/profile/menu";
import { AccountBar } from "@/components/profile/account-bar";
import { TiktokSetting } from "@/components/profile/tiktok-setting";
import { ReminderSettings } from "@/components/notifications/notification-center";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <Link href={viewsFor(user)[0].href} className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold">Réglages</h1>
        </div>
        <AccountBar {...await accountBarData(user)} />
      </header>
      <div className="space-y-4">
        <TiktokSetting initial={user.tiktokUsername} />
        <ReminderSettings reminderHour={user.reminderHour} dmEnabled={user.dmEnabled} />
      </div>
    </main>
  );
}
