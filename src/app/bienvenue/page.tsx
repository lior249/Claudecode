import { requireUser } from "@/server/auth/session";
import { getOnboardingVideo } from "@/server/onboarding/service";
import { viewsFor } from "@/server/profile/service";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

// Accueil en 4 étapes (première connexion ; il reste accessible ensuite).
export default async function WelcomePage() {
  const user = await requireUser();
  return (
    <OnboardingFlow
      name={user.displayName}
      hasVideo={Boolean(await getOnboardingVideo())}
      tiktok={user.tiktokUsername}
      reminderHour={user.reminderHour}
      dmEnabled={user.dmEnabled}
      next={viewsFor(user)[0].href}
    />
  );
}
