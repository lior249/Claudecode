# Creato — Learn

Plateforme de progression et de validation pour l'accompagnement TikTok.
Les contenus restent sur Whop ; Creato valide les exercices, enregistre les choix et prépare la fiche coach.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet (**prioritaires** sur la spécification).

## Démarrer en local

Prérequis : Node 22, PostgreSQL, ffmpeg.

```bash
cp .env.example .env        # puis renseigner DATABASE_URL et SESSION_SECRET (DEV_LOGIN_ENABLED="true" pour la démo)
npm install
npx prisma migrate dev      # crée les tables
npm run db:seed             # parcours de départ (contenus provisoires) + comptes démo
npm run dev                 # http://localhost:3000
npm run worker              # dans un 2e terminal : analyse des exercices (ffmpeg requis)
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests automatiques (les tests d'intégration utilisent `TEST_DATABASE_URL`) |
| `npm run lint` / `npm run typecheck` | Contrôles de qualité |
| `npm run db:seed -- --reset` | Efface tout et recrée le parcours de départ |

## Avancement

- [x] **Bloc 1** : fondations, parcours niveau → module → leçon, progression linéaire, délais de 24 h, rangs E–B, écran de progression mobile.
- [x] **Bloc 2** : connexion Discord (OAuth2 + PKCE), accès réservé au rôle @TikTok, revérification horaire par le bot.
- [x] **Bloc 3** : QCM — correction immédiate (vert/rouge + explication), 16/20, attente de 5 min après un échec, tentatives illimitées, saisie des 20 questions dans l'Admin.
- [x] **Bloc 4** : Pratique IA — envoi de vidéo/audio/texte, mesures automatiques (cuts, silences, son, durée, ressemblance de texte, hook), correction Gemini sur barème texte, note sur 10 calculée par le serveur, doublons refusés, 5 dernières tentatives gardées, « Faire appel à un humain » après 3 pannes.
- [ ] Bloc 5 : Décisions (catalogues de fiches) et Lancement (phrase + code, rôle @Élite).
- [ ] Bloc 6 : espace Admin / Coach (parcours, fiches élèves, notifications Discord).
- [ ] Bloc 7 : mise en ligne sur le serveur.
