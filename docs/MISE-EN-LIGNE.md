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

## Étape 1 — Louer le serveur chez OVHcloud (10 min, ~6 à 8 €/mois)

1. Va sur <https://www.ovhcloud.com/fr/vps/> → choisis l'offre **VPS** d'entrée de gamme (au moins **2 vCore, 4 Go de mémoire, 40 Go de disque**).
2. Pendant la commande :
   - **Localisation** : France (Gravelines, Strasbourg ou Roubaix).
   - **Système** : **Ubuntu 24.04** (sans application préinstallée).
   - **Option « Sauvegarde automatisée »** : ✅ recommandée (quelques euros/mois) → OVH garde une copie complète du serveur chaque jour, en plus de nos sauvegardes.
   - Clé SSH : tu peux laisser vide.
3. Paie. Quelques minutes plus tard, tu reçois un e-mail avec l'**adresse IP** du serveur (ex. `51.75.12.34`)
   et le moyen de récupérer le **mot de passe** de l'utilisateur **`ubuntu`** (lien vers ton espace client OVH).
   Tu retrouves aussi l'IP dans l'espace client : **Bare Metal Cloud → VPS → ton VPS**.

> Chez OVH, on ne se connecte pas en `root` mais avec l'utilisateur **`ubuntu`**. C'est pour ça que les commandes
> ci-dessous commencent par `sudo` (= « faire en tant qu'administrateur »).

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
   ssh ubuntu@51.75.12.34
   ```
   Tape `yes`, puis le mot de passe OVH (rien ne s'affiche quand tu tapes, c'est normal).
   S'il ne te demande pas d'en changer, fais-le tout de suite avec `passwd` : choisis-en un long et garde-le dans un gestionnaire de mots de passe.
3. Récupère le code :
   ```
   sudo git clone -b claude/nifty-bell-8c7abw https://github.com/lior249/Claudecode.git /opt/creato
   ```
   *Username* : ton nom GitHub. *Password* : **le jeton de l'étape 3** (pas ton mot de passe GitHub).
4. Lance l'installation :
   ```
   cd /opt/creato && sudo ./deploy/install.sh
   ```
   La première fois, il prépare tout puis s'arrête en disant qu'il manque 3 valeurs. C'est normal.
5. Ouvre le fichier de réglages :
   ```
   sudo nano /opt/creato/.env
   ```
   Colle entre les guillemets :
   - `DISCORD_CLIENT_SECRET="…"` → le **nouveau** secret (étape 0)
   - `DISCORD_BOT_TOKEN="…"` → le **nouveau** token (étape 0)
   - `GEMINI_API_KEY="…"` → ta clé Gemini (<https://aistudio.google.com/apikey>)

   Enregistre : **Ctrl+O**, **Entrée**, puis quitte : **Ctrl+X**.
6. Relance :
   ```
   sudo ./deploy/install.sh
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
- **Sauvegarde automatisée OVH** : copie complète du serveur chaque jour (si choisie à l'étape 1).
  Avant une grosse modification, tu peux aussi faire un **snapshot** dans l'espace client OVH (VPS → Snapshot).
- Sauvegarde à la main : `sudo /opt/creato/deploy/backup.sh`
- Une fois par mois, garde une copie chez toi :
  1. Sur le serveur :
     ```
     sudo cp /var/backups/creato/db-*.dump /home/ubuntu/ && sudo chown ubuntu /home/ubuntu/db-*.dump
     ```
  2. Depuis ton ordinateur (nouvelle fenêtre PowerShell / Terminal) :
     ```
     scp "ubuntu@51.75.12.34:db-*.dump" .
     ```
  3. De retour sur le serveur : `rm /home/ubuntu/db-*.dump`
- Restaurer (en cas de souci) : `sudo /opt/creato/deploy/restore.sh /var/backups/creato/db-AAAA-MM-JJ-HHMM.dump`

## Mises à jour

Quand je te dis qu'une nouvelle version est prête :
```
ssh ubuntu@51.75.12.34
cd /opt/creato && sudo ./deploy/update.sh
```
(Le script fait une sauvegarde avant, puis met le site à jour.)

## Commandes utiles

| Besoin | Commande (dans `/opt/creato`) |
|--------|------------------------------|
| État des services | `sudo docker compose ps` |
| Messages du site | `sudo docker compose logs app --tail 50` |
| Messages du worker (IA, rappels) | `sudo docker compose logs worker --tail 50` |
| Redémarrer | `sudo docker compose restart` |
| Modifier un réglage | `sudo nano .env` puis `sudo docker compose up -d` |

## Coûts mensuels

| Poste | Prix |
|-------|------|
| VPS OVHcloud + sauvegarde automatisée | ≈ 6 à 10 € selon l'offre (voir ta facture) |
| Domaine (LWS) | déjà payé |
| Gemini | ≤ 20 $ (alerte de budget) |
