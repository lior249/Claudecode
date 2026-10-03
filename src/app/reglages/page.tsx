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
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 lg:max-w-2xl lg:pt-5">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <Link href={viewsFor(user)[0].href} className="rounded-full bg-card p-2 text-muted lg:hidden" aria-label="Retour">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold lg:text-3xl lg:font-bold">Réglages</h1>
        </div>
        <div className="lg:hidden">
          <AccountBar {...await accountBarData(user)} />
        </div>
      </header>
      <div className="space-y-4">
        <TiktokSetting initial={user.tiktokUsername} />
        <ReminderSettings reminderHour={user.reminderHour} dmEnabled={user.dmEnabled} />
      </div>
    </main>
  );
}
