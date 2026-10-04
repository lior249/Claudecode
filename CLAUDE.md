@AGENTS.md

# Creato Learn — guide pour les agents

Référence produit : `docs/DECISIONS.md` (prioritaire) puis `docs/SPEC.md`. Interface en français, tutoiement.

## Règles
1. Aucune règle métier dans React : progression, validation, scores et délais vivent dans `src/server/**`.
2. Parcours strictement linéaire (niveau → module → leçon), calculé par la fonction pure `computeProgression`
   (`src/server/learn/progression.ts`). Le verrouillage est dérivé, jamais stocké. Toute action revérifie
   l'accès avec `assertCanStartLesson`.
3. Une validation acquise reste acquise (`completeLesson` est idempotent).
4. Ne jamais envoyer au navigateur : `Lesson.config` (barèmes, code de lancement), liens Whop de modules verrouillés.
5. Chaque action serveur vérifie la session (`requireUser`).
6. Pas de traitement long dans une requête HTTP : la lecture des captures de résultats passe par la file `Job` (`result.read`)
   et le worker (`npm run worker`, `src/worker/index.ts`). Seul `src/server/retention/service.ts` supprime des fichiers d'élèves.
7. Exercices pratiques : corrigés à la main (`src/server/admin/reviews.ts`, 1 à 3 critères) ; la note et le statut sont calculés
   par `src/server/practice/scoring.ts`. Résultats : Claude (`src/server/ai/screenshot.ts`) dit seulement si la capture est
   conforme et lit le chiffre ; les points sont calculés par `src/server/results/rules.ts`, jamais par l'IA.
   Types de résultats gérés par l'admin dans `results/types-admin.ts`.
8. Coaching : règles pures dans `src/server/coaching/rules.ts` (streak, vues, rangs, fenêtre mensuelle, étoiles) ; tickets,
   délais de 12 h et étoiles dans `tickets.ts` ; entrée / révocation / réactivation dans `lifecycle.ts`. Un coach n'accède
   qu'à ses élèves (sinon « introuvable »). Les dates affichées côté navigateur passent par `LocalTime` (fuseau du lecteur).
9. Notifications : toujours `notify()` (`src/server/notifications/service.ts`), jamais Discord directement. La notification
   va dans la cloche ; le worker envoie le message privé (heures calmes 22 h–8 h, 3 par jour, sauf `urgent`). Les relances
   programmées vivent dans `engagement.ts` avec une `onceKey` (pas de doublon). Textes et règles pures dans `rules.ts`,
   dont l'expression de la mascotte (`mood`, images `public/mascotte/`).
10. Posts de résultats : `src/server/results/service.ts` (validation coach / admin, 2 par jour, réactions). Disponibilités
   des coachs : règles pures (fuseaux) dans `coaching/availability-rules.ts`, service dans `coaching/availability.ts`.

## Pièges
- Next.js 16 : `proxy.ts` (pas `middleware.ts`), `params`/`cookies()` sont des Promises. Lire `node_modules/next/dist/docs/`.
- `getEnv()` ne doit jamais être appelé au chargement d'un module (la compilation de production n'a pas les secrets) ;
  la configuration est vérifiée au démarrage par `src/instrumentation.ts` et par le worker. Une page qui lit `getEnv()` sans
  autre donnée de requête doit appeler `await connection()`. Avant de pousser : `next build` sans `.env` doit passer.
- Prisma 7 : client généré dans `src/generated/prisma` (ignoré par git) ; config dans `prisma.config.ts`.
- Pas de `Promise.all` de requêtes Prisma dans une transaction.
- Les modules `server-only` s'exécutent hors Next grâce à `tsx --conditions=react-server` (worker) et à un alias dans vitest.
- Tests : `npm test` (unitaires + intégration sur `TEST_DATABASE_URL`, vrai ffmpeg, fichiers d'exemple dans `tests/fixtures`).
- IA : `AI_PROVIDER=mock` en développement (« [FAIL] » dans le titre d'un résultat = capture non conforme, « [PANNE] » = panne,
  premier nombre du titre = chiffre lu). En production, `AI_PROVIDER=claude` et `ANTHROPIC_API_KEY` sont obligatoires.
- Base vide en production : `prisma/seed.ts --production` ne crée que les réglages de base (types de résultats, critères
  des catalogues) quand le réglage `initialized` est absent. Accueil en 4 étapes : `src/server/onboarding/service.ts`
  (`User.onboardedAt`, vidéo dans `AppSetting`).
