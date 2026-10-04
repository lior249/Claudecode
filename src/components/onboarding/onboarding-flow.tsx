"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { tiktokAction } from "@/app/actions/profile";
import { completeOnboardingAction } from "@/app/actions/onboarding";
import { ReminderSettings } from "@/components/notifications/notification-center";
import { Mascot, type Mood } from "@/components/mascot";
import { FlameIcon, TrophyIcon } from "@/components/ui/icons";
import { RankBadge } from "@/components/learn/badges";

const STEPS = 4;

// Accueil en 4 étapes à la première connexion : vidéo, compte TikTok, rappels, comment ça marche.
export function OnboardingFlow(p: { name: string; hasVideo: boolean; tiktok: string | null; reminderHour: number; dmEnabled: boolean; next: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tiktok, setTiktok] = useState(p.tiktok ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = () => (setError(null), setStep((s) => Math.min(STEPS, s + 1)));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8 lg:max-w-2xl lg:py-12">
      <div className="flex items-center gap-3">
        {step > 1 ? (
          <button onClick={() => setStep(step - 1)} className="rounded-full bg-card p-2 text-muted" aria-label="Étape précédente">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className="w-9" />
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Étape ${step} sur ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-gold" : "bg-card-2"}`} />
          ))}
        </div>
        <span className="w-9 text-right text-xs text-muted">
          {step}/{STEPS}
        </span>
      </div>

      <div className="flex flex-1 flex-col py-8">
        {step === 1 && (
          <Step mood="amour" title={`Bienvenue sur Creato, ${p.name}\u00a0!`}>
            {p.hasVideo ? (
              <video src="/api/onboarding-video" controls playsInline preload="metadata" className="mt-4 aspect-video w-full rounded-2xl bg-black" />
            ) : null}
            <p className="mt-4 text-muted">
              Creato complète le Discord : tu y apprends les bases, tu fais tes choix, tu suis ta progression, tu échanges avec ton coach et tu partages tes
              résultats avec les autres membres.
            </p>
          </Step>
        )}
        {step === 2 && (
          <Step mood="clin-oeil" title="Ton compte TikTok">
            <p className="mt-2 text-muted">Il sert à vérifier tes posts (ta flamme) et tes résultats. On t&apos;accompagne sur un seul compte.</p>
            <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@ton_compte" className="mt-4 w-full rounded-2xl border border-line bg-bg p-4 outline-none focus:border-gold" />
          </Step>
        )}
        {step === 3 && (
          <Step mood="motive" title="Tes rappels">
            <p className="mb-4 mt-2 text-muted">Un petit rappel par jour pour garder le rythme. Tu pourras le changer dans Réglages.</p>
            <ReminderSettings reminderHour={p.reminderHour} dmEnabled={p.dmEnabled} />
          </Step>
        )}
        {step === 4 && (
          <Step mood="wow" title="Comment ça marche">
            <ul className="mt-4 space-y-3">
              <Item icon={<RankBadge rank="D" size={36} />} title="Le parcours">
                Niveau par niveau : regarde le module sur Whop, puis valide la leçon (QCM, exercice, choix). Les rangs E → B arrivent avec la formation.
              </Item>
              <Item icon={<FlameIcon size={34} />} title="Ta flamme">
                Avec le coaching : un post TikTok par jour (colle son lien) pour garder ta flamme et gagner des points.
              </Item>
              <Item icon={<TrophyIcon size={34} />} title="Tes résultats">
                Une vidéo qui marche, tes revenus, tes abonnés : envoie la capture avec ton code du jour. Points, classement et rangs A → SSS.
              </Item>
            </ul>
          </Step>
        )}
      </div>

      {error && <p className="mb-3 text-center text-sm text-danger">{error}</p>}
      <div className="grid gap-2">
        {step === 2 ? (
          <>
            <button
              disabled={pending || !tiktok.trim()}
              onClick={() =>
                start(async () => {
                  const res = await tiktokAction(tiktok);
                  if (!res.ok) return setError(res.error);
                  next();
                })
              }
              className="rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40"
            >
              Enregistrer et continuer
            </button>
            <button onClick={next} className="py-2 text-sm text-muted underline">
              Je n&apos;ai pas encore de compte
            </button>
          </>
        ) : step < STEPS ? (
          <button onClick={next} className="rounded-2xl bg-text py-4 font-semibold text-black">
            Continuer
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await completeOnboardingAction();
                router.replace(p.next);
              })
            }
            className="rounded-2xl bg-gold py-4 font-semibold text-black disabled:opacity-40"
          >
            C&apos;est parti !
          </button>
        )}
      </div>
    </main>
  );
}

function Step({ mood, title, children }: { mood: Mood; title: string; children: React.ReactNode }) {
  return (
    <section>
      <Mascot mood={mood} size={88} />
      <h1 className="mt-4 text-balance text-3xl font-bold leading-tight">{title}</h1>
      {children}
    </section>
  );
}

function Item({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-card p-4">
      <span className="shrink-0">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
