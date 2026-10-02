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
- [x] **Bloc 5** : catalogues (niches, pays, méthodes 10K) gérés dans l'Admin, fiche avec concurrence et matériel, choix unique ; lancement (phrase + code secrets, 10 questions de ressenti, envoi au coach, rôle @Élite).
- [x] **Bloc 6a** : éditeur du parcours (niveaux, modules, leçons, ordre, liens Whop), fiche Learn des élèves (décrochages en rouge), file « Faire appel à un humain », rappel 4 h avant la fin des 24 h.
- [x] **Bloc 6b** : espace coaching (tickets avec images et liens, délai de 12 h et étoiles des coachs, questions de suivi, « conseil reçu » et 👍/👎, notes 😞😐🙂, streak avec gel, points de vues, classement avec podium, résultats du mois et rangs S/SS/SSS, révocation après 15 jours et réactivation, rapport des coachs pour l'Admin).
- [x] **Preuves** : vues + j'aime + commentaires, liens des vidéos pour les résultats du mois, case « tout concorde » obligatoire pour le coach.
- [x] **Notifications façon Duolingo** : cloche pour tous (élève, coach, admin), messages privés Discord avec heures calmes et plafond, heure de rappel au choix, relances des absents (1, 2, 3, 5, 7, 14 jours puis silence), flamme en danger et dernière chance, paliers de streak, gel utilisé, classement du lundi, résultats du mois, fins de module et de niveau, résumé du matin des coachs et des admins, étoiles gagnées ou perdues.
- [x] **Kit de mise en ligne** : Docker (site + worker + base + HTTPS Caddy), installation en une commande, sauvegardes chaque nuit, restauration, mise à jour. Guide : `docs/MISE-EN-LIGNE.md`.
- [ ] Bloc 7 : mise en ligne sur creatoskills.site et premier vrai test.
