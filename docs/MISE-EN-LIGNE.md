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

## Étape 3 bis — Préparer ton ordinateur (5 à 15 min)

Pour parler au serveur, ton ordinateur utilise un petit outil appelé **ssh**, qu'on tape dans une fenêtre de commandes
(un « terminal »). Sur un PC fraîchement réinstallé, il faut parfois l'activer.

### Sur Windows

1. **Ouvre une fenêtre de commandes** — essaie dans cet ordre, le premier qui marche suffit :
   - Clic droit sur le bouton **Démarrer** → **Terminal** (ou **Windows PowerShell**).
   - Touche **Windows** → tape `powershell` → **Entrée**.
   - Touches **Windows + R** → tape `powershell` → **OK**.
   - Si PowerShell refuse toujours de s'ouvrir : touches **Windows + R** → tape `cmd` → **OK**.
     C'est l'« Invite de commandes » : elle fait aussi bien l'affaire pour tout ce guide.
2. **Vérifie que ssh est là** : dans la fenêtre, tape puis **Entrée** :
   ```
   ssh -V
   ```
   - ✅ Une ligne qui commence par `OpenSSH_…` s'affiche → c'est bon, passe à l'étape 4.
   - ❌ Message du genre *« ssh n'est pas reconnu… »* → installe-le :
     1. **Démarrer** → **Paramètres** → **Système** → **Fonctionnalités facultatives**
        (sur Windows 10 : **Applications** → **Fonctionnalités facultatives**).
     2. **Afficher les fonctionnalités** / **Ajouter une fonctionnalité** → cherche **Client OpenSSH** → coche → **Installer**.
     3. Redémarre le PC, rouvre la fenêtre de commandes et retape `ssh -V`.
3. **Toujours bloqué ?** Le PC vient d'être réinstallé : fais d'abord toutes les **mises à jour Windows**
   (**Paramètres** → **Windows Update** → **Rechercher des mises à jour**, puis redémarrer), et recommence le point 1.
   Si rien ne marche, envoie-moi une capture du message d'erreur (sans mot de passe).

> Astuce : dans la fenêtre de commandes, **clic droit** = coller. Pour copier un texte affiché, sélectionne-le à la souris puis **clic droit**.

### Sur Mac

Ouvre **Terminal** (**Cmd + Espace** → tape `Terminal` → **Entrée**). ssh est déjà installé ; tu peux vérifier avec `ssh -V`.

## Étape 4 — Installer (20 min, presque tout est automatique)

1. Ouvre la fenêtre de commandes de l'étape 3 bis (PowerShell, Terminal ou Invite de commandes).
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
   - `ANTHROPIC_API_KEY="…"` → ta clé Claude (voir « Clé Claude » ci-dessous)

   Enregistre : **Ctrl+O**, **Entrée**, puis quitte : **Ctrl+X**.
6. Relance :
   ```
   ./deploy/install.sh
   ```
   Après quelques minutes : **✅ Creato tourne**. Ouvre <https://creatoskills.site>.

### Clé Claude (l'IA qui lit les captures de résultats)

1. Va sur <https://console.anthropic.com> et crée un compte (ou connecte-toi).
2. **Settings → Billing** (Facturation) : ajoute ta carte et un premier crédit (5 à 10 $ suffisent pour commencer).
3. **Settings → Limits** (Limites) : mets une **limite de dépense mensuelle à 20 $**. Au-delà, l'IA s'arrête : les captures passent
   simplement à la vérification à la main par le coach ou toi, rien ne casse.
4. **Settings → API Keys** → **Create Key** → nom : `creato` → copie la clé (elle commence par `sk-ant-`).
   Elle ne s'affiche qu'une fois : colle-la directement dans `.env` sur le serveur, **jamais dans une conversation**.

Bon à savoir :
- Une lecture de capture coûte environ **1 à 3 centimes**. Creato s'arrête de lui-même après **300 lectures par mois**
  (réglage `AI_MONTHLY_MAX_READS` dans `.env`) : au-delà, les captures passent à la main.
- Si le modèle principal refuse de lire une capture (par excès de prudence), la demande est relancée **automatiquement**
  sur un autre modèle d'Anthropic (option « fallbacks » activée). Si l'IA est en panne, la capture passe à la main.
  Le modèle principal se règle avec `CLAUDE_MODEL` dans `.env`.

## Étape 5 — Premier vrai test (toi seul, 30 min)

Coche au fur et à mesure :

- [ ] **Connexion Discord** avec ton compte → tu arrives sur Creato, le bouton **Admin** est là (tu es aussi coach n° 1).
- [ ] Un compte **sans** le rôle @TikTok est refusé avec un message clair.
- [ ] **Admin → Accueil** : envoie ta vidéo de bienvenue (montrée à chaque nouveau membre, à sa première connexion).
- [ ] **Admin → Parcours** : la base démarre **vide**. Crée tes niveaux, modules et leçons un par un, avec les vrais liens Whop secrets.
- [ ] **Admin** : saisis les questions des QCM, les **1 à 3 critères** de chaque exercice pratique, les niches / pays / méthodes, la phrase et le code du lancement.
- [ ] Avec un compte test qui a @TikTok : l'accueil en 4 étapes s'affiche, puis fais le QCM et envoie une réalisation
  → elle arrive dans **Admin → Exercices à corriger** ; corrige-la → l'élève reçoit sa note.
- [ ] **Résultats** : publie un résultat avec une capture (et le code du jour écrit dessus) → l'IA le publie tout de suite
  ou te l'envoie à vérifier. Regarde ensuite le coût sur <https://console.anthropic.com> → *Usage*.
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
  Donc **une fois par mois**, garde une copie chez toi, depuis ton ordinateur (la fenêtre de commandes de l'étape 3 bis, pas le serveur) :
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

### Une seule fois : passage à Claude et remise à zéro (octobre 2026)

Cette version remplace Gemini par Claude et démarre sur une base vide. Dans l'ordre :

1. Crée ta clé Claude (voir « Clé Claude » à l'étape 4).
2. Ouvre les réglages du serveur : `nano /opt/creato/.env`
   - remplace `AI_PROVIDER="gemini"` par `AI_PROVIDER="claude"` ;
   - **supprime** les lignes qui commencent par `GEMINI_` ;
   - ajoute ces lignes (colle ta clé entre les guillemets) :
     ```
     ANTHROPIC_API_KEY="…"
     CLAUDE_MODEL="claude-opus-5-5"
     AI_MONTHLY_MAX_READS="300"
     ```
   - enregistre : **Ctrl+O**, **Entrée**, puis **Ctrl+X**.
3. Mets à jour : `cd /opt/creato && ./deploy/update.sh`
4. Efface tout (membres, ancien parcours, résultats, fichiers ; une sauvegarde est faite avant) :
   `./deploy/reset.sh` puis tape `EFFACER`.
5. Reconnecte-toi sur le site avec Discord, puis **Admin → Accueil** (ta vidéo) et **Admin → Parcours**.

## Commandes utiles

| Besoin | Commande (dans `/opt/creato`) |
|--------|------------------------------|
| État des services | `docker compose ps` |
| Messages du site | `docker compose logs app --tail 50` |
| Messages du worker (IA, rappels) | `docker compose logs worker --tail 50` |
| Redémarrer | `docker compose restart` |
| Modifier un réglage | `nano .env` puis `docker compose up -d` |
| **Tout effacer** (membres, parcours, résultats, fichiers ; sauvegarde faite avant) | `./deploy/reset.sh` puis taper `EFFACER` |

## Coûts mensuels

| Poste | Prix |
|-------|------|
| VPS Namecheap (Quasar recommandé) | ≈ 7 à 12 $ selon l'offre (voir ta facture) |
| Domaine (Namecheap) | déjà payé (pense au renouvellement annuel) |
| Claude (lecture des captures) | ≤ 20 $ (limite de dépense dans la console Anthropic) |
