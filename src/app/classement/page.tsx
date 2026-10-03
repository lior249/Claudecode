import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { leaderboard } from "@/server/coaching/progress";
import { memberCard, viewsFor } from "@/server/profile/service";
import { accountBarData } from "@/server/profile/menu";
import { AccountBar } from "@/components/profile/account-bar";
import { LeaderboardView } from "@/components/profile/leaderboard-view";

// Visible par tous les membres connectés ; seuls ceux qui ont fini la formation (en coaching) y figurent.
export default async function LeaderboardPage() {
  const user = await requireUser();
  const rows = await leaderboard();
  const cards = [];
  for (const r of rows) cards.push(await memberCard(r.id, new Date(), user.id));
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 lg:max-w-6xl lg:px-10 lg:pt-5">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <Link href={viewsFor(user)[0].href} className="rounded-full bg-card p-2 text-muted lg:hidden" aria-label="Retour">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-semibold lg:text-3xl lg:font-bold">Classement</h1>
        </div>
        <div className="lg:hidden">
          <AccountBar {...await accountBarData(user)} />
        </div>
      </header>
      <p className="mb-6 text-sm text-muted">Points = streak (régularité) + vues validées (qualité). Touche un membre pour voir sa fiche.</p>
      <LeaderboardView rows={rows} cards={cards} meId={user.id} />
    </main>
  );
}
