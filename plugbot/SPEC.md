# PlugBot — spécification

PlugBot est un bot Discord qui suit les **show-ups** des membres du serveur.
Faire un show-up, c'est poster au moins un résultat dans la journée : c'est l'un des critères les plus importants de la monétisation TikTok.

Les points marqués *(proposé)* sont des propositions en attente de confirmation.

## Principes

- PlugBot est un **bot à part**. Il ne se mélange pas avec le bot actuel qui envoie les notifications de paiement : c'est une autre application Discord, avec ses propres salons.
- Tous les salons de PlugBot sont **publics** : tout le monde voit qui a posté et où chacun en est.
- Les consignes sur la façon de poster sont données par le porteur de projet. C'est sur cette base que les admins retirent des points.

## Catégories de membres

| Catégorie | Qui | Classements |
|---|---|---|
| **Plug** | Membres de l'accompagnement : rôle **@TikTok** | #éloges-plug |
| **Free** | Membres gratuits : rôle **@Free** | #éloges-free |

- Un membre sans le rôle @TikTok ne compte jamais dans les classements Plug.
- *(proposé)* Un membre qui a les deux rôles compte en Plug. Un membre qui n'a aucun des deux (staff, nouveaux arrivants, bots) n'est pas suivi.
- *(proposé)* Chaque show-up garde la catégorie du membre au moment où il est posté.
  Un membre free qui rejoint l'accompagnement démarre à 0 dans les classements Plug, et ses points free restent dans les classements Free.
- *(proposé)* Les membres qui ont quitté le serveur n'apparaissent plus dans les classements ni en prison.

## Salons

| Salon | Ce qui s'y passe |
|---|---|
| **#résultats** | Les membres y postent leurs résultats (des images). |
| **#show-up** | Le journal : chaque show-up et chaque point retiré. |
| **#éloges-free** | Les classements des membres Free, chaque dimanche à 18 h. |
| **#éloges-plug** | Les classements des membres Plug, chaque dimanche à 18 h. |
| **#prison** | Les membres qui n'ont pas fait de show-up depuis 3 jours ou plus. |

## Compter un show-up

- Un message posté dans **#résultats** qui contient **au moins une image** compte comme un show-up. Le point est compté tout de suite, sans attendre de vérification.
- *(proposé)* **1 point par jour maximum.** La journée va de minuit à minuit, heure de Paris.
  Seule la première image du jour rapporte le point. Les suivantes ne rapportent rien.
- *(proposé)* Seules les images comptent (PNG, JPG, GIF, WebP…). Les vidéos ne comptent pas.
- PlugBot met la réaction **❗** sur l'image qui a rapporté le point, pour signaler qu'elle reste à vérifier.
- PlugBot écrit aussitôt dans **#show-up**, en mentionnant le membre :

  > 🔥 @Membre vient de show up ! Ses points de la semaine s'élèvent à **4**. Classement Free de la semaine : **3ᵉ**.

  Le classement indiqué est celui de la catégorie du membre (Free ou Plug).

## Vérification par les admins

Les admins passent sur les images marquées ❗ :

- **👍** : le show-up est confirmé. PlugBot ne fait rien.
- **❌** : PlugBot retire le point et l'écrit dans **#show-up** :

  > ❌ Le point de show-up de @Membre a été retiré par @Admin. Ses points de la semaine passent à **3**.

  Le membre est notifié. Le nom de l'admin s'affiche, mais l'admin n'est pas notifié. Aucune raison n'est demandée.

Règles complémentaires :

- Seules les réactions des **admins** comptent. Celles des autres membres sont ignorées.
- *(proposé)* Si l'admin enlève sa ❌, le point est rendu, et PlugBot l'annonce dans #show-up.
- *(proposé)* Si le membre supprime son image, le point est retiré automatiquement, et PlugBot l'annonce dans #show-up.
  Sinon, on pourrait poster, gagner le point, puis effacer la preuve.
- *(proposé)* Un point retiré après la publication d'un classement est enlevé des totaux, mais le classement déjà publié n'est pas republié.

## La semaine

- Les classements sont publiés **chaque dimanche à 18 h**, heure de Paris.
- *(proposé)* La semaine va du lundi 0 h au dimanche 23 h 59. Avec 1 point par jour, on peut faire au maximum **7 points par semaine**.
  Le classement du dimanche 18 h compte les show-ups faits jusqu'à 18 h.
  Un show-up posté le dimanche après 18 h compte quand même (total, prison), mais il arrive après la publication.

## La prison

Un membre suivi (Free ou Plug) qui ne fait aucun show-up pendant **3 jours** entre en prison.
PlugBot écrit dans **#prison** à chaque palier, en le mentionnant :

| Jours sans show-up | Message |
|---|---|
| 3 | « @Membre vient d'entrer en prison : aucun show-up depuis 3 jours. » |
| 6 | « @Membre s'enfonce dans la prison : 6 jours sans show-up. » |
| 10 | « @Membre est toujours en prison : 10 jours sans show-up. » |
| 15 | « @Membre croupit en prison : 15 jours sans show-up. » |
| 30 | « @Membre est définitivement en prison : 30 jours sans show-up. » |

Après 30 jours, PlugBot n'écrit plus rien.

- *(proposé)* Les jours comptés sont des **journées entières** sans show-up. Si le dernier show-up date du lundi, les jours manqués sont mardi, mercredi et jeudi : le membre entre en prison dans la nuit de jeudi à vendredi.
- *(proposé)* La vérification se fait **une fois par jour, juste après minuit**. Si plusieurs membres atteignent le même palier le même jour, PlugBot les regroupe dans un seul message qui les mentionne tous, au lieu d'envoyer des dizaines de messages.
- *(proposé)* Pour un membre qui n'a jamais posté, on compte à partir du jour où PlugBot commence à le suivre : le lancement du bot, ou l'arrivée du membre s'il arrive après.
  Conséquence : 3 jours après le lancement, tous ceux qui n'ont jamais posté entrent en prison en même temps.
- *(proposé)* **Sortir de prison** : un seul show-up suffit, même après 30 jours. PlugBot l'annonce dans #prison :

  > 🔓 @Membre sort de prison après 8 jours sans show-up !

## Les classements du dimanche 18 h

Chaque dimanche à 18 h, PlugBot publie **un seul message** dans **#éloges-free**, et un autre dans **#éloges-plug**.
Chaque message ne concerne que sa catégorie et contient trois classements :

1. **Top 10 de la semaine** : les points de la semaine.
2. **Top 10 all-time** : le total des points depuis le lancement.
3. **Top 10 de la prison** : les membres en prison depuis le plus longtemps.

Tous les membres listés sont **mentionnés**. Un membre peut apparaître dans deux classements. Il est alors mentionné deux fois, et ce n'est pas un problème.
Le message commence par des félicitations, avec un texte qui change d'une semaine à l'autre.

Exemple :

> 🏆 **Les éloges de la semaine — Free**
> Énorme semaine, bravo à tous ceux qui se sont montrés !
>
> **Top 10 de la semaine**
> 1. @Membre — 7 points
> 2. @Membre — 7 points
> …
>
> **Top 10 all-time**
> 1. @Membre — 58 points
> …
>
> **Top 10 de la prison**
> 1. @Membre — 24 jours sans show-up
> …

- *(proposé)* **Égalités** : avec 7 points maximum par semaine, beaucoup de membres finiront à égalité.
  Dans le top 10 de la semaine, on départage par le total all-time. Dans le top all-time, on départage par celui qui a atteint son total le premier.

## Ce qu'il faudra fournir

- L'identifiant (ID) du serveur Discord.
- Les ID des cinq salons : #résultats, #show-up, #éloges-free, #éloges-plug, #prison.
- Les ID des rôles @Free et @TikTok, ainsi que celui du rôle admin, qui peut retirer des points.
- Le jeton (token) du bot, créé sur le portail développeur Discord. Il reste secret : il n'est jamais mis sur GitHub.

## Technique *(proposé)*

- **Node.js** avec la bibliothèque **discord.js**, et une base de données **SQLite** (un simple fichier).
- Toutes les heures sont calculées sur le fuseau **Europe/Paris** (heure d'été comprise).
- Sur le portail développeur Discord, il faut activer deux autorisations spéciales du bot :
  - **Message Content** : sans elle, le bot ne voit pas les images jointes aux messages.
  - **Server Members** : sans elle, le bot ne peut pas lister les membres et leurs rôles pour la prison.
- Permissions du bot sur le serveur : voir les salons, lire l'historique, envoyer des messages, ajouter des réactions.
- Les mentions sont écrites dans le texte du message, pas dans un encadré (embed) : c'est la seule façon de notifier les membres mentionnés.
- **Hébergement** : le bot doit rester connecté à Discord en permanence, donc il lui faut un petit serveur (VPS). L'hébergement mutualisé ne convient pas.
- **Coupures** : si le bot redémarre, il rattrape les images et les réactions postées pendant son absence. Il publie aussi un classement ou un passage en prison qu'il aurait manqué.

## Idées pour plus tard

- Les **séries** : nombre de jours d'affilée avec un show-up.
- Des **rôles bonus** donnés automatiquement selon les points ou les séries.
