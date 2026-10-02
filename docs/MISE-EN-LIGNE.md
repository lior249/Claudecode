# Mettre Creato en ligne sur creatoskills.site

Ce guide se suit dans l'ordre. Compte environ 1 h la première fois.
Tu copies-colles les commandes : pas besoin de comprendre le code.

> 🔒 **Règle d'or** : ne colle **jamais** un mot de passe, un token ou une clé dans une conversation (ni avec moi, ni ailleurs).
> Ils vont uniquement dans le fichier `.env` du serveur.

---

## Étape 0 — Changer les secrets Discord (5 min)

Le secret OAuth et le token du bot ont été envoyés dans la conversation : on les remplace par des neufs.

1. Va sur <https://discord.com/developers/applications> → ton application **Creato**.
2. **OAuth2** → **Reset Secret** → copie le nouveau secret dans un endroit sûr (bloc-notes temporaire).
3. Toujours dans **OAuth2** → **Redirects** → ajoute exactement :
   `https://creatoskills.site/api/auth/discord/callback` → **Save Changes**.
4. **Bot** → **Reset Token** → copie le nouveau token.
5. Sur ton serveur Discord : **Paramètres du serveur → Rôles** → fais glisser le rôle du bot **au-dessus** de @Élite,
   et vérifie qu'il a la permission **Gérer les rôles**. Sinon il ne pourra pas donner/retirer @Élite.

## Étape 1 — Louer le serveur (10 min, ~5,50 €/mois)

Recommandé : **Hetzner Cloud** (<https://www.hetzner.com/cloud>), fiable et pas cher.

1. Crée un compte, puis **New Project** → **Add Server**.
2. Choix :
   - **Location** : Falkenstein ou Nuremberg (Allemagne).
   - **Image** : **Ubuntu 24.04**.
   - **Type** : **CX22** (2 processeurs, 4 Go de mémoire, 40 Go de disque).
   - **Backups** : ✅ coche (≈ +1 €/mois) → Hetzner garde une copie complète du serveur chaque jour, en plus de nos sauvegardes.
   - **SSH key** : laisse vide → le mot de passe *root* arrive par e-mail.
3. **Create & Buy**. Note l'**adresse IP** du serveur (ex. `91.98.12.34`).

## Étape 2 — Brancher le domaine (5 min + attente)

Chez **LWS** → ton domaine **creatoskills.site** → **Zone DNS** :

| Type | Nom | Valeur |
|------|-----|--------|
| A | `@` (vide) | l'IP du serveur |
| A | `www` | l'IP du serveur |

Supprime les anciennes lignes **A** et **AAAA** de `@` et `www` (page de parking LWS).
La prise en compte prend de 5 minutes à quelques heures. Vérifie sur <https://dnschecker.org> (type A).

## Étape 3 — Préparer l'accès au code (5 min)

Le dépôt GitHub est privé : le serveur a besoin d'un « jeton de lecture ».

1. GitHub → photo de profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nom : `serveur creato`. Expiration : 1 an. **Repository access** : *Only select repositories* → `lior249/Claudecode`.
3. **Permissions** → *Repository permissions* → **Contents : Read-only**. → **Generate token** → copie-le.

## Étape 4 — Installer (20 min, presque tout est automatique)

1. Ouvre un terminal :
   - Windows : touche Windows → tape **PowerShell** → Entrée.
   - Mac : **Terminal**.
2. Connecte-toi au serveur (remplace par ton IP) :
   ```
   ssh root@91.98.12.34
   ```
   Tape `yes`, puis le mot de passe reçu par e-mail (rien ne s'affiche quand tu tapes, c'est normal).
   Le serveur te demande d'en choisir un nouveau : choisis-en un long et garde-le dans un gestionnaire de mots de passe.
3. Récupère le code :
   ```
   git clone -b claude/nifty-bell-8c7abw https://github.com/lior249/Claudecode.git /opt/creato
   ```
   *Username* : ton nom GitHub. *Password* : **le jeton de l'étape 3** (pas ton mot de passe GitHub).
4. Lance l'installation :
   ```
   cd /opt/creato && ./deploy/install.sh
   ```
   La première fois, il prépare tout puis s'arrête en disant qu'il manque 3 valeurs. C'est normal.
5. Ouvre le fichier de réglages :
   ```
   nano /opt/creato/.env
   ```
   Colle entre les guillemets :
   - `DISCORD_CLIENT_SECRET="…"` → le **nouveau** secret (étape 0)
   - `DISCORD_BOT_TOKEN="…"` → le **nouveau** token (étape 0)
   - `GEMINI_API_KEY="…"` → ta clé Gemini (<https://aistudio.google.com/apikey>)

   Enregistre : **Ctrl+O**, **Entrée**, puis quitte : **Ctrl+X**.
6. Relance :
   ```
   ./deploy/install.sh
   ```
   Après quelques minutes : **✅ Creato tourne**. Ouvre <https://creatoskills.site>.

## Étape 5 — Premier vrai test (toi seul, 30 min)

Coche au fur et à mesure :

- [ ] **Connexion Discord** avec ton compte → tu arrives sur Creato, le bouton **Admin** est là (tu es aussi coach n° 1).
- [ ] Un compte **sans** le rôle @TikTok est refusé avec un message clair.
- [ ] **Admin → Parcours** : remplace les liens Whop provisoires par les vrais liens secrets.
- [ ] **Admin** : saisis les vraies questions des QCM, les critères des leçons pratiques, les niches / pays / méthodes, la phrase et le code du lancement.
- [ ] Avec un compte test qui a @TikTok : fais le QCM, puis envoie une vraie vidéo de montage → la note arrive en 1 à 3 min.
- [ ] **Coût Gemini** : sur <https://aistudio.google.com> → *Usage*, regarde combien a coûté cette vidéo. Mets une **alerte de budget à 20 $** dans Google Cloud → *Facturation* → *Budgets et alertes*.
- [ ] Termine le lancement → le rôle **@Élite** apparaît sur Discord, et tu reçois un **message privé** du bot.
- [ ] Dans le coaching : colle le lien d'un vrai TikTok → la date du post est la bonne.
- [ ] La **cloche** 🔔 affiche les notifications ; règle ton heure de rappel.

Si quelque chose cloche, note ce que tu as fait et ce qui s'est affiché, et envoie-le-moi (sans secret).

## Étape 6 — Test avec des membres

1. Commence avec **2 ou 3 membres** de confiance pendant quelques jours.
2. Ensuite, ouvre aux **10 élèves**.
3. Pour ajouter un autre coach : il se connecte une fois, puis **Admin → Coachs → Ajouter un coach**.

## Sauvegardes (déjà actives)

- **Chaque nuit à 3 h 30** : copie de la base (14 jours gardés) et des fichiers (7 jours) dans `/var/backups/creato`.
- **Hetzner Backups** : copie complète du serveur chaque jour (si coché à l'étape 1).
- Sauvegarde à la main : `/opt/creato/deploy/backup.sh`
- Une fois par mois, garde une copie chez toi (depuis ton ordinateur, pas le serveur) :
  ```
  scp "root@91.98.12.34:/var/backups/creato/db-*.dump" .
  ```
- Restaurer (en cas de souci) : `/opt/creato/deploy/restore.sh /var/backups/creato/db-AAAA-MM-JJ-HHMM.dump`

## Mises à jour

Quand je te dis qu'une nouvelle version est prête :
```
ssh root@91.98.12.34
cd /opt/creato && ./deploy/update.sh
```
(Le script fait une sauvegarde avant, puis met le site à jour.)

## Commandes utiles

| Besoin | Commande (dans `/opt/creato`) |
|--------|------------------------------|
| État des services | `docker compose ps` |
| Messages du site | `docker compose logs app --tail 50` |
| Messages du worker (IA, rappels) | `docker compose logs worker --tail 50` |
| Redémarrer | `docker compose restart` |
| Modifier un réglage | `nano .env` puis `docker compose up -d` |

## Coûts mensuels

| Poste | Prix |
|-------|------|
| Serveur Hetzner CX22 + Backups | ≈ 5,50 € |
| Domaine (LWS) | déjà payé |
| Gemini | ≤ 20 $ (alerte de budget) |
