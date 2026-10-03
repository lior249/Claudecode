import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getEnv } from "@/server/env";
import { devLogin } from "@/app/actions/auth";

// Connexion de test, hors de la page de connexion : seulement en développement (introuvable en ligne).
export default async function DemoLoginPage() {
  await connection(); // lu à chaque visite, jamais pendant la compilation (pas de secrets à ce moment-là)
  if (!getEnv().devLoginEnabled) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <form action={devLogin} className="space-y-2 rounded-2xl border border-line p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Comptes de test</p>
        <div className="grid grid-cols-3 gap-2">
          <button name="as" value="learner" className="rounded-xl bg-card-2 py-3 text-sm font-medium">
            Élève
          </button>
          <button name="as" value="coaching" className="rounded-xl bg-card-2 py-3 text-sm font-medium">
            En coaching
          </button>
          <button name="as" value="coach" className="rounded-xl bg-card-2 py-3 text-sm font-medium">
            Coach
          </button>
        </div>
      </form>
    </main>
  );
}
