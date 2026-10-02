# Creato — Learn

Plateforme de progression et de validation pour l'accompagnement TikTok.
Les contenus restent sur Whop ; Creato valide les exercices, enregistre les choix et prépare la fiche coach.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet (**prioritaires** sur la spécification).

## Démarrer en local

Prérequis : Node 22, PostgreSQL.

```bash
cp .env.example .env        # puis renseigner DATABASE_URL et SESSION_SECRET (DEV_LOGIN_ENABLED="true" pour la démo)
npm install
npx prisma migrate dev      # crée les tables
npm run db:seed             # parcours de départ (contenus provisoires) + comptes démo
npm run dev                 # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests automatiques |
| `npm run lint` / `npm run typecheck` | Contrôles de qualité |
| `npm run db:seed -- --reset` | Efface tout et recrée le parcours de départ |

## Avancement

- [x] **Bloc 1** : fondations, parcours niveau → module → leçon, progression linéaire, délais de 24 h, rangs E–B, écran de progression mobile.
- [x] **Bloc 2** : connexion Discord (OAuth2 + PKCE), accès réservé au rôle @TikTok, revérification horaire par le bot.
- [ ] Bloc 3 : QCM (Compréhension) — module Monétisation.
- [ ] Bloc 4 : Pratique IA (envoi de fichiers, mesures ffmpeg, Gemini).
- [ ] Bloc 5 : Décisions (catalogues de fiches) et Lancement (phrase + code, rôle @Élite).
- [ ] Bloc 6 : espace Admin / Coach (parcours, fiches élèves, notifications Discord).
- [ ] Bloc 7 : mise en ligne sur le serveur.
