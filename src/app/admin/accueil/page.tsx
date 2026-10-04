import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { getOnboardingVideo } from "@/server/onboarding/service";
import { OnboardingVideoEditor } from "@/components/admin/onboarding-video-editor";

// Accueil des nouveaux membres : la vidéo de l'étape 1.
export default async function AdminWelcome() {
  await requireUser(["ADMIN"]);
  const video = await getOnboardingVideo();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Accueil des nouveaux membres</h1>
        <p className="mt-1 text-sm text-muted">
          À leur première connexion, les membres passent par 4 étapes : ta vidéo, leur compte TikTok, leurs rappels, puis comment marche Creato.{" "}
          <Link href="/bienvenue" className="underline">
            Voir l&apos;accueil
          </Link>
        </p>
      </div>
      <OnboardingVideoEditor current={video?.name ?? null} />
    </div>
  );
}
