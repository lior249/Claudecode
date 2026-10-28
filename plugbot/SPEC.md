# PlugBot — spécification

PlugBot est un bot Discord qui suit les **show-ups** des membres du serveur.
Faire un show-up, c'est poster un résultat : se montrer chaque jour est l'un des critères les plus importants de la monétisation TikTok.

Les points marqués *(proposé)* sont des propositions en attente de confirmation. Le reste a été validé par le porteur de projet.

## Principes

- PlugBot est un **bot à part**. Il ne se mélange pas avec le bot actuel qui envoie les notifications de paiement : c'est une autre application Discord, avec ses propres salons.
- Tous les salons de PlugBot sont **publics** : tout le monde voit qui a posté et où chacun en est. Les membres sont mentionnés publiquement, y compris en prison.
- Les consignes sur la façon de poster sont données par le porteur de projet. C'est sur cette base qu'il retire des points.
- Toutes les heures sont en **temps universel (UTC)**. Une journée va de minuit à minuit UTC.

## Catégories de membres

| Catégorie | Qui | Classements |
|---|---|---|
| **Plug** | Membres de l'accompagnement : rôle **@TikTok** | #éloges-plug |
| **Free** | Membres gratuits : rôle **@Free** | #éloges-free |

- Un membre sans le rôle @TikTok ne compte jamais dans les classements Plug.
- Un membre qui a les deux rôles compte en Plug. Un membre qui n'a aucun des deux (nouveaux arrivants, bots) n'est pas suivi.
- *(proposé)* Le porteur de projet n'est pas suivi : il ne gagne pas de points et ne va pas en prison.
- *(proposé)* Les classements utilisent le **rôle actuel** du membre, et tous ses points le suivent.
  Un membre free qui rejoint l'accompagnement passe dans les classements Plug avec tous ses points.
- Les membres qui ont quitté le serveur n'apparaissent plus dans les classements ni en prison.

## Salons

| Salon | Ce qui s'y passe |
|---|---|
| **#résultats** | Les membres y postent leurs résultats. |
| **#show-up** | Le journal : chaque show-up et chaque point retiré. |
| **#éloges-free** | Les classements des membres Free, chaque dimanche à 18 h UTC. |
| **#éloges-plug** | Les classements des membres Plug, chaque dimanche à 18 h UTC. |
| **#prison** | Les entrées en prison, les paliers et les sorties. |

## Points et chaîne

- **Chaque message** posté dans **#résultats** avec au moins une image rapporte **1 point de show-up**. Le point est compté tout de suite, sans attendre de vérification.
- Plusieurs résultats le même jour rapportent plusieurs points. Le mode lent du salon (un message toutes les 15 minutes) est réglé directement sur Discord.
- *(proposé)* Les vidéos comptent aussi, comme les images. Un message avec plusieurs images ne rapporte qu'un point.
- La **chaîne** compte les **jours d'affilée** avec au moins un show-up. Dix résultats le même jour ne font qu'un jour de chaîne.
  Dès qu'un jour est manqué, la chaîne est brisée, mais les points restent. On peut donc avoir des centaines de points et une chaîne d'un jour.
- PlugBot met la réaction **❗** sur chaque résultat compté, pour signaler qu'il reste à vérifier.
- PlugBot écrit aussitôt dans **#show-up**, en mentionnant le membre :

  > 🔥 @Membre vient de show up !
  > ⛓️ Chaîne : **12 jours d'affilée** · 📅 Semaine : **9 points** (3e Free) · 🏅 Total : **148 points**

  Le rang indiqué est celui du classement de la semaine dans sa catégorie. Un membre en prison n'a pas de rang : PlugBot lui rappelle combien de jours il lui reste pour sortir.

## Rôle de chaîne

- Les membres réguliers reçoivent automatiquement un **rôle de chaîne** (par exemple 🔥🔥🔥), retiré dès que la chaîne est brisée.
- *(proposé)* Le rôle est donné à partir de **7 jours d'affilée**. Ce nombre se règle facilement.
- Le porteur de projet crée le rôle sur Discord. Le rôle de PlugBot doit être placé au-dessus de lui dans la liste des rôles.

## Vérification par l'admin

Le porteur de projet est le seul admin dont les réactions comptent. Il passe sur les résultats marqués ❗ :

- **👍** : le show-up est confirmé. PlugBot ne fait rien.
- **❌** : PlugBot retire le point et l'écrit dans **#show-up** :

  > ❌ Le point de show-up de @Membre a été retiré par @Admin.
  > 🏅 Total : **147 points** · 📅 Semaine : **8 points**

  Le membre est notifié. Le nom de l'admin s'affiche, mais l'admin n'est pas notifié. Aucune raison n'est demandée.

Règles complémentaires :

- Les réactions des autres membres sont ignorées.
- *(proposé)* Si l'admin enlève sa ❌, le point est rendu, et PlugBot l'annonce dans #show-up.
- *(proposé)* Si le membre supprime son résultat, le point est retiré automatiquement, et PlugBot l'annonce dans #show-up.
- Un point retiré après la publication d'un classement est enlevé des totaux, mais le classement déjà publié n'est pas republié.

## La semaine

- Les classements sont publiés **chaque dimanche à 18 h UTC**.
- *(proposé)* La semaine va du dimanche 18 h UTC au dimanche 18 h UTC suivant. Le classement publié couvre exactement la semaine, et les points de la semaine repartent à zéro juste après.

## La prison

- PlugBot ne s'occupe d'un membre pour la prison qu'après **7 jours entiers** passés sur le serveur.
- Un membre suivi qui ne fait aucun show-up pendant **3 jours entiers** entre en prison.
- Tant qu'il est en prison, il **n'apparaît dans aucun classement** : ni la semaine, ni all-time, même s'il était premier. Ses show-ups sont toujours annoncés dans #show-up, et ses points continuent de compter.
- Pour **sortir de prison**, quel que soit le palier, il faut faire un show-up **3 jours d'affilée**. Trois résultats le même jour ne suffisent pas.
  Au troisième jour, PlugBot l'annonce dans #prison :

  > 🔓 @Membre sort de prison après 3 jours de show-up d'affilée !

PlugBot écrit dans **#prison** à chaque palier, en mentionnant les membres concernés :

| Jours sans show-up | Message |
|---|---|
| 3 | « @Membre vient d'entrer en prison : aucun show-up depuis 3 jours. » |
| 6 | « @Membre s'enfonce dans la prison : 6 jours sans show-up. » |
| 10 | « @Membre est toujours en prison : 10 jours sans show-up. » |
| 15 | « @Membre croupit en prison : 15 jours sans show-up. » |
| 30 | « @Membre est définitivement en prison : 30 jours sans show-up. » |

- Après 30 jours, PlugBot n'écrit plus rien. Chaque palier n'est annoncé qu'une fois par séjour en prison.
- La vérification se fait **chaque jour juste après minuit UTC**. Les membres qui atteignent le même palier le même jour sont regroupés dans un seul message qui les mentionne tous.
- Exemple : dernier show-up le lundi, rien mardi, mercredi et jeudi. Le membre entre en prison dans la nuit de jeudi à vendredi.
- *(proposé)* Le suivi part de zéro au lancement du bot : les anciens messages de #résultats ne comptent pas.
  Pour un membre qui n'a jamais posté, on compte à partir du lendemain du lancement, ou de la fin de ses 7 premiers jours s'il arrive après.
  Conséquence : 4 jours après le lancement, tous ceux qui n'ont rien posté entrent en prison en même temps.

## Les classements du dimanche 18 h UTC

Chaque dimanche à 18 h UTC, PlugBot publie **un seul message** dans **#éloges-free**, et un autre dans **#éloges-plug**.
Chaque message ne concerne que sa catégorie et contient trois classements :

1. **Top 10 de la semaine** : les points de la semaine.
2. **Top 10 all-time** : le total des points depuis le lancement.
3. **Top 10 de la prison** : les membres en prison depuis le plus longtemps.

Tous les membres listés sont **mentionnés**. Un membre peut apparaître dans deux classements.
Le message commence par des félicitations, avec un texte qui change d'une semaine à l'autre.

> 🏆 **Les éloges de la semaine — Free**
> Énorme semaine, bravo à tous ceux qui se sont montrés !
>
> **🔥 Top 10 de la semaine**
> 1. @Membre — 12 points
> …
>
> **👑 Top 10 all-time**
> 1. @Membre — 148 points
> …
>
> **🔒 Top 10 de la prison**
> 1. @Membre — en prison depuis 24 jours
> …

- *(proposé)* **Égalités** : dans le top de la semaine, on départage par le total all-time, puis par celui qui a atteint son score le premier. Dans le top all-time, celui qui a atteint son total le premier passe devant.

## Coupures

Si le bot redémarre, il rattrape ce qui s'est passé pendant son absence :

- les résultats postés pendant la coupure ;
- les ❌ posées ou retirées et les résultats supprimés pendant les 7 derniers jours ;
- une vérification de la prison ou un classement du dimanche qu'il aurait manqué.

## Idées pour plus tard

- D'autres rôles bonus selon les points (par exemple 100, 500, 1 000 points).
