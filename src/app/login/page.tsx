import { redirect } from "next/navigation";
import { getEnv } from "@/server/env";
import { getCurrentUser } from "@/server/auth/session";
import { devLogin } from "@/app/actions/auth";
import { ACCESS_ERRORS } from "@/server/discord/access";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/learn");
  const { devLoginEnabled, discordLoginEnabled } = getEnv();
  const code = (await searchParams).erreur;
  const error = typeof code === "string" ? (Object.hasOwn(ACCESS_ERRORS, code) ? ACCESS_ERRORS[code] : ACCESS_ERRORS.DISCORD) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-12">
      <div className="pt-16">
        <h1 className="logo text-6xl">Creato</h1>
        <p className="mt-4 text-lg text-muted">
          Apprends les bases. Fais tes choix.
          <br />
          Débloque ton coaching.
        </p>
      </div>

      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
            {error}
          </p>
        )}
        {discordLoginEnabled ? (
          <a
            href="/api/auth/discord/start"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] py-4 font-semibold"
          >
            <DiscordIcon />
            Se connecter avec Discord
          </a>
        ) : (
          <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted">Connexion Discord pas encore configurée.</p>
        )}
        <p className="text-center text-xs text-muted">Réservé aux membres du Discord qui ont le rôle @TikTok.</p>

        {devLoginEnabled && (
          <form action={devLogin} className="mt-8 space-y-2 rounded-2xl border border-line p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Démo</p>
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
        )}
      </div>
    </main>
  );
}

function DiscordIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4-2 1 1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}
