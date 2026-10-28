# PlugBot

Bot Discord qui suit les show-ups des membres : points, chaînes, prison et classements du dimanche.
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

- Créer les salons #résultats, #show-up, #éloges-free, #éloges-plug et #prison, s'ils n'existent pas encore.
- Vérifier que PlugBot peut voir ces cinq salons et écrire dans les quatre salons d'annonces.
- Créer le rôle de chaîne (par exemple 🔥🔥🔥), puis, dans **Paramètres du serveur > Rôles**, glisser le rôle de PlugBot **au-dessus** de ce rôle.
- Mode lent de #résultats : 15 minutes, réglé dans les paramètres du salon.

## 3. Installer sur le VPS

Il faut Node.js 22.13 ou plus récent.

```bash
cd plugbot
npm install
cp .env.example .env
```

Remplir ensuite le fichier `.env` (les explications sont dedans), puis lancer le bot :

```bash
npm start
```

Pour qu'il tourne en permanence et redémarre tout seul, on utilise pm2 :

```bash
npm install -g pm2
pm2 start npm --name plugbot -- start
pm2 save
pm2 startup
```

Commandes utiles : `pm2 logs plugbot` (voir ce que fait le bot), `pm2 restart plugbot` (redémarrer).

Les données sont enregistrées dans `data/plugbot.db`. C'est le seul fichier à sauvegarder.

## Pour les développeurs

```bash
npm test
```

- `src/index.js` : démarrage et événements Discord.
- `src/handlers.js` : résultats postés, ❌ de l'admin, messages supprimés.
- `src/jobs.js` : prison (chaque jour à minuit UTC) et éloges (dimanche 18 h UTC).
- `src/sync.js` : premier lancement et rattrapage après une coupure.
- `src/stats.js` : calculs des chaînes, de la prison et des classements.
- `src/messages.js` : tous les textes publiés par le bot.
