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
6. Pas de traitement long dans une requête HTTP : l'analyse des soumissions passe par la file `Job` et le worker
   (`npm run worker`, `src/worker/index.ts`). Seul `src/server/retention/service.ts` supprime des fichiers.
7. L'IA renvoie des critères (points perdus) ; la note et le statut sont calculés par `src/server/practice/scoring.ts`.

## Pièges
- Next.js 16 : `proxy.ts` (pas `middleware.ts`), `params`/`cookies()` sont des Promises. Lire `node_modules/next/dist/docs/`.
- Prisma 7 : client généré dans `src/generated/prisma` (ignoré par git) ; config dans `prisma.config.ts`.
- Pas de `Promise.all` de requêtes Prisma dans une transaction.
- Les modules `server-only` s'exécutent hors Next grâce à `tsx --conditions=react-server` (worker) et à un alias dans vitest.
- Tests : `npm test` (unitaires + intégration sur `TEST_DATABASE_URL`, vrai ffmpeg, fichiers d'exemple dans `tests/fixtures`).
- IA : `AI_PROVIDER=mock` en développement (« [FAIL] » dans un nom de fichier ou un texte = échec simulé, « [PANNE] » = panne).
