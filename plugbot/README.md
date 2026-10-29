# PlugBot

Bot Discord qui suit les show-ups des membres : points, chaînes, récompenses, prison et classements.
Le fonctionnement complet est décrit dans [`SPEC.md`](SPEC.md).

## 1. Créer le bot sur Discord

1. Aller sur le [portail développeur Discord](https://discord.com/developers/applications) et cliquer sur **New Application**. Nom : `PlugBot`.
2. Onglet **Bot** :
   - cliquer sur **Reset Token** et copier le jeton (il ne s'affiche qu'une fois) ;
   - activer **Server Members Intent** et **Message Content Intent**, puis enregistrer.
3. Onglet **General Information** : copier l'**Application ID**.
4. Ouvrir ce lien en remplaçant `APPLICATION_ID`, puis choisir le serveur :

   ```
   https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=268504128
   ```

   Cela donne au bot les droits de voir les salons, lire l'historique, envoyer des messages, ajouter des réactions et gérer les rôles.

## 2. Préparer le serveur

**Rôles.** Dans **Paramètres du serveur > Rôles**, glisser le rôle **PlugBot au-dessus** de 🔥🔥🔥, ⚡plug7⚡, ★plug30★ et 💔Prisonnier💔. Sinon, Discord l'empêche de les donner.

**Salons.**

- PlugBot doit pouvoir voir flex-resultats, et voir et écrire dans show-up, top-7, top-30, top-all-time et la-prison.
- Dans show-up, top-7, top-30 et top-all-time, PlugBot doit aussi pouvoir **mentionner @everyone, @here et tous les rôles** : les annonces notifient tout le serveur.
- Dans top-7, top-30 et top-all-time, PlugBot doit aussi pouvoir **intégrer des liens** et **voir les anciens messages** : le classement en direct est un encadré, que PlugBot retrouve et modifie.
- PlugBot n'a pas besoin d'accès aux salons bonus-top7, bonus-top30, bonus-21j et guide-serveur : il les mentionne seulement.
- Les membres doivent pouvoir lire ces cinq salons, sans y écrire.
- flex-resultats : mode lent de 15 minutes.

**Le rôle Prisonnier.** Il doit couper les accès principaux (écrire dans les salons, rejoindre les lives…), sauf dans la-prison et flex-resultats. Attention à une règle de Discord :
quand un salon **autorise** explicitement un rôle (par exemple Free) à écrire, cette autorisation l'emporte sur l'**interdiction** posée sur le rôle Prisonnier.

- Le droit d'écrire doit venir des réglages généraux du rôle (Paramètres du serveur > Rôles), pas d'une autorisation posée sur le salon.
- Dans chaque catégorie de salons, ajouter le rôle Prisonnier avec **Envoyer des messages : ✗**.
- Faire de même avec **Se connecter : ✗** pour les salons vocaux et les lives.
- Dans la-prison et flex-resultats, ajouter le rôle Prisonnier avec **Envoyer des messages : ✓**.

Le salon des codes de réduction ne doit être visible que pour 🔥🔥🔥, ⚡plug7⚡ et ★plug30★. Pas besoin d'y bloquer le Prisonnier : PlugBot lui retire ces rôles pendant la prison.

**La planification des événements** (voir [`EVENEMENTS.md`](EVENEMENTS.md)) :

- Crée un salon privé **plugbot-planning**, visible seulement par toi et PlugBot.
- Dans **Paramètres du serveur > Rôles > PlugBot**, active **Gérer les événements**.
- Dans plugbot-planning, PlugBot doit pouvoir : voir le salon, envoyer des messages, voir les anciens messages, ajouter des réactions, **créer des fils publics**, **envoyer des messages dans les fils** et **gérer les fils**.
- Dans les deux salons d'annonces (free et accompagnement) : voir le salon, envoyer des messages, **mentionner @everyone, @here et tous les rôles** et **créer des sondages**.
- Pour un live dans un salon « stage », PlugBot doit aussi pouvoir **gérer les salons**, **rendre muets des membres** et **déplacer des membres** dans ce salon.
- Ajoute les trois identifiants dans `.env` : `PLANNING_CHANNEL_ID`, `ANNOUNCE_FREE_CHANNEL_ID`, `ANNOUNCE_PLUG_CHANNEL_ID`.

## 3. Installer sur le VPS

Se connecter au VPS avec `ssh root@ADRESSE_IP`, puis taper ces commandes une par une.

Installer Node.js 22 (la version proposée par `apt install npm` est trop ancienne) et git :

```bash
apt update
apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

Récupérer le code de PlugBot et l'installer :

```bash
git clone -b claude/busy-cannon-jbka53 https://github.com/lior249/Claudecode.git
cd Claudecode/plugbot
npm install
cp .env.example .env
```

Remplir ensuite le fichier `.env` avec `nano .env` (les explications sont dedans). Pour enregistrer : Ctrl+O, Entrée, puis Ctrl+X pour quitter.
Le dépôt GitHub est public : le jeton du bot ne doit exister que dans ce fichier `.env`, jamais sur GitHub.

Lancer le bot :

```bash
npm start
```

Pour qu'il tourne en permanence et redémarre tout seul, on utilise pm2 :

```bash
npm install -g pm2
pm2 start src/index.js --name plugbot --node-args="--disable-warning=ExperimentalWarning"
pm2 save
pm2 startup
```

Ne lance jamais `pm2 start` une deuxième fois, ni `npm start` pendant que pm2 tourne : il y aurait deux PlugBot, et chaque message partirait deux fois.
PlugBot refuse d'ailleurs de démarrer si un autre tourne déjà. `pm2 list` doit toujours montrer une seule ligne `plugbot`.

Commandes utiles : `pm2 logs plugbot` (voir ce que fait le bot), `pm2 restart plugbot` (redémarrer).

Pour installer une nouvelle version du bot, depuis le dossier `Claudecode/plugbot` :

```bash
git pull
npm install
pm2 restart plugbot
```

Les données sont enregistrées dans `data/plugbot.db`. C'est le seul fichier à sauvegarder.

## Aperçu des messages

Pour voir un exemple de chaque message de PlugBot sans attendre, crée un salon de test privé (visible seulement par toi et PlugBot), puis, depuis le dossier `Claudecode/plugbot` :

```bash
npm run apercu -- IDENTIFIANT_DU_SALON
```

Les exemples sont publiés dans ce salon, sans notifier personne (même le texte @everyone ne fait sonner personne). Le bot n'a pas besoin d'être arrêté.

Pour effacer cet aperçu d'un coup (seuls les messages « 🧪 Aperçu » publiés par PlugBot sont supprimés) :

```bash
npm run effacer-apercu -- IDENTIFIANT_DU_SALON
```

## Pour les développeurs

```bash
npm test
```

- `src/index.js` : démarrage et événements Discord.
- `src/handlers.js` : résultats postés, ❌ de l'admin, messages supprimés, changements de rôle.
- `src/prison.js` : entrées et sorties de prison (rôle Prisonnier, récompenses mises de côté).
- `src/jobs.js` : prison (chaque jour à minuit UTC), compte à rebours de la prison (18 h GMT), publications de 20 h 30 GMT (top-7, top-30, récap), messages aux gagnants.
- `src/boards.js` : les classements en direct, un message modifié à chaque changement dans top-7, top-30 et top-all-time.
- `src/checks.js` : vérification des permissions au démarrage.
- `src/sync.js` : premier lancement et rattrapage après une coupure.
- `src/stats.js` : calculs des chaînes, de la prison et des classements.
- `src/messages.js` : tous les textes publiés par le bot, et les récompenses.
- `src/preview.js` : l'aperçu de tous les messages (`npm run apercu`).
- `src/events/` : la planification des événements (panneau, tickets, rappels, lives de l'accompagnement).
