# LiveBot

Bot Discord qui annonce les lives de l'accompagnement, avec un sondage de présence.

- **Quand :** chaque mercredi et chaque vendredi à **12 h GMT**, pour le live de **22 h GMT**.
- **Quoi :** un message qui mentionne le rôle choisi (par exemple TikTok), l'heure du live dans chaque pays francophone d'Afrique et d'Europe (changements d'heure compris), et un sondage « Oui, je serai là / Non, je ne pourrai pas » qui se ferme au début du live.
- **Coupure :** si le bot était éteint à 12 h, l'annonce part dès son retour, tant que le live n'a pas commencé. Elle ne part jamais deux fois.

Les jours et les heures se changent dans `src/schedule.js` ; la liste des pays dans `src/message.js`.

## 1. Créer le bot sur Discord

1. Sur le [portail développeur Discord](https://discord.com/developers/applications), clique sur **New Application** et nomme-la (par exemple `LiveBot`).
2. Onglet **Bot** : **Reset Token**, puis copie le jeton (il ne s'affiche qu'une fois). Aucun interrupteur à activer. Désactive **Public Bot**.
3. Onglet **General Information** : copie l'**Application ID**, puis ouvre ce lien en le remplaçant et choisis ton serveur :

   ```
   https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=562949953555456
   ```

4. Dans le salon des annonces, le bot doit pouvoir **voir le salon**, **envoyer des messages** et **créer des sondages**.
   Si le rôle mentionné n'est pas « mentionnable par tout le monde », il lui faut aussi **Mentionner @everyone, @here et tous les rôles**.

## 2. Installer sur le VPS

```bash
cd ~/Claudecode
git pull
cd livebot
npm install
cp .env.example .env
nano .env
```

Remplis le jeton, l'identifiant du salon et celui du rôle, puis lance le bot avec pm2 :

```bash
pm2 start src/index.js --name livebot
pm2 save
```

Le bot affiche `Permissions OK.` puis `Connecté en tant que …` dans `pm2 logs livebot`. Un deuxième LiveBot refuse de démarrer.

## Aperçu

Pour voir l'annonce du prochain live dans un salon de test, sans notifier personne (le sondage d'aperçu dure 1 heure) :

```bash
npm run apercu -- IDENTIFIANT_DU_SALON
```

## Pour les développeurs

```bash
npm test
```
