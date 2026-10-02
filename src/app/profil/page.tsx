import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { myProfile, viewsFor } from "@/server/profile/service";
import { accountBarData } from "@/server/profile/menu";
import { AccountBar } from "@/components/profile/account-bar";
import { ProfileView } from "@/components/profile/profile-view";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await myProfile(user.id);
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <Link href={viewsFor(user)[0].href} className="rounded-full bg-card p-2 text-muted" aria-label="Retour">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold">Mon profil</h1>
        </div>
        <AccountBar {...await accountBarData(user)} />
      </header>
      <ProfileView profile={profile} />
    </main>
  );
}
