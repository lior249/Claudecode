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

## Étape 1 — Louer le serveur chez Namecheap (10 min, ~7 à 12 $/mois)

Tu utilises le même compte Namecheap que pour le domaine.

1. Sur <https://www.namecheap.com> → menu **Hosting** → **VPS Hosting**.
2. Choisis l'offre :
   - **Quasar** (≈ 12 $/mois, 6 Go de mémoire) : **recommandée**, tout est fluide.
   - **Pulsar** (≈ 7 $/mois, 2 Go de mémoire) : ça marche, mais l'installation et les mises à jour sont lentes,
     et c'est juste quand plusieurs élèves envoient des vidéos en même temps.
   - Les prix changent souvent : vérifie sur leur site.
3. Pendant la commande :
   - **Système (OS)** : **Ubuntu 24.04** (ou **Ubuntu 22.04** si la 24.04 n'est pas proposée).
   - **Panneau de contrôle (cPanel / WHM)** : ❌ **refuse-le**. Il bloquerait le site en HTTPS de Creato. Il faut le serveur « nu ».
   - Vérifie que l'offre indique **KVM** dans sa description (c'est le type de serveur dont Creato a besoin).
   - Si une option de **sauvegarde du serveur** est proposée, tu peux la prendre (en plus de nos sauvegardes).
4. Paie (même carte, même nom et même adresse que pour le domaine, VPN coupé).
5. Quand le serveur est prêt (de quelques minutes à quelques heures), tu reçois un e-mail avec l'**adresse IP**
   (ex. `198.54.12.34`) et le **mot de passe `root`**. Tu les retrouves aussi dans **Dashboard → Hosting List → ton VPS**.

## Étape 2 — Brancher le domaine chez Namecheap (5 min + attente)

1. Connecte-toi sur <https://www.namecheap.com> → **Domain List** → à côté de **creatoskills.site**, clique **Manage**.
2. Onglet **Domain** → rubrique **Nameservers** : vérifie que c'est **Namecheap BasicDNS** (sinon choisis-le et valide ✓).
3. Onglet **Advanced DNS** → rubrique **Host Records** :
   - **Supprime** (icône poubelle) les lignes par défaut de Namecheap : le **CNAME Record** `www` → `parkingpage.namecheap.com`
     et le **URL Redirect Record** `@`, s'ils existent.
   - **Add New Record** deux fois :

     | Type | Host | Value | TTL |
     |------|------|-------|-----|
     | A Record | `@` | l'IP du serveur | Automatic |
     | A Record | `www` | l'IP du serveur | Automatic |

   - Clique sur la coche verte ✓ de chaque ligne pour l'enregistrer.

La prise en compte prend de 5 minutes à quelques heures. Vérifie sur <https://dnschecker.org> (type A) que
`creatoskills.site` affiche bien l'IP de ton serveur **avant** l'étape 4 (sinon le certificat HTTPS ne peut pas être créé).

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
   ssh root@198.54.12.34
   ```
   Tape `yes`, puis le mot de passe `root` reçu par e-mail (rien ne s'affiche quand tu tapes, c'est normal).
   Change-le tout de suite avec la commande `passwd` : choisis-en un long et garde-le dans un gestionnaire de mots de passe.
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
- **Sauvegarde Namecheap du serveur** : seulement si tu as pris l'option à l'étape 1.
- Nos sauvegardes sont **sur le même serveur** : si le serveur disparaît, elles disparaissent avec.
  Donc **une fois par mois**, garde une copie chez toi, depuis ton ordinateur (PowerShell / Terminal, pas le serveur) :
  ```
  scp "root@198.54.12.34:/var/backups/creato/db-*.dump" .
  ```
- Sauvegarde à la main : `/opt/creato/deploy/backup.sh`
- Restaurer (en cas de souci) : `/opt/creato/deploy/restore.sh /var/backups/creato/db-AAAA-MM-JJ-HHMM.dump`

## Mises à jour

Quand je te dis qu'une nouvelle version est prête :
```
ssh root@198.54.12.34
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
| VPS Namecheap (Quasar recommandé) | ≈ 7 à 12 $ selon l'offre (voir ta facture) |
| Domaine (Namecheap) | déjà payé (pense au renouvellement annuel) |
| Gemini | ≤ 20 $ (alerte de budget) |
