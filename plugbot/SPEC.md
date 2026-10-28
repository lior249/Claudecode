# PlugBot — spécification

PlugBot est un bot Discord qui suit les **show-ups** des membres du serveur.
Faire un show-up, c'est poster un résultat : se montrer chaque jour est l'un des critères les plus importants de la monétisation TikTok.

Les points marqués *(proposé)* sont des propositions en attente de confirmation. Le reste a été validé par le porteur de projet.

## Principes

- PlugBot est un **bot à part**. Il ne se mélange pas avec le bot actuel qui envoie les notifications de paiement.
- Tous ses salons sont **publics** : tout le monde voit qui a posté, qui gagne et qui est en prison. Les membres sont mentionnés publiquement. Aucun message privé.
- Toutes les heures sont en **temps universel (UTC)**. Une journée va de minuit à minuit UTC.
- Le suivi part de **zéro** au lancement : seuls les résultats postés après l'arrivée du bot comptent.

## Catégories de membres

| Catégorie | Rôle | Délai avant la prison |
|---|---|---|
| **Accompagnement** | @TikTok | 15 jours |
| **Free** | @Free | 21 jours |

- L'accompagnement est toujours affiché **avant** les Free.
- Les deux catégories ont des classements séparés. Un membre qui a les deux rôles compte dans l'accompagnement.
- Les membres sans aucun de ces deux rôles ne sont pas suivis. Les rôles **Plugged®** et **Approuvé** ne sont pas utilisés par PlugBot.
- *(proposé)* Le porteur de projet n'est pas suivi : il ne gagne pas de points et ne va pas en prison.
- *(proposé)* Les classements utilisent le **rôle actuel** du membre, et tous ses points le suivent.

## Salons

| Salon | Ce qui s'y passe |
|---|---|
| 🎮 **flex-resultats** | Les membres y postent leurs résultats. |
| ➕ **show-up** | Le journal : chaque show-up, chaque point retiré, chaque rôle 🔥🔥🔥 gagné. |
| 💸 **top-7** | Le challenge de la semaine : lancement, classement du jour et clôture. |
| 💎 **top-30** | Le challenge du mois : lancement, points d'étape et clôture. |
| **top-all-time** | Le classement all-time, chaque dimanche à 18 h UTC. |
| 🤢 **la-prison** | Les alertes, les entrées en prison et les sorties. |

Seul PlugBot écrit dans show-up, top-7, top-30, top-all-time et la-prison.

## Points et chaîne

- **Chaque message** posté dans flex-resultats avec au moins une image rapporte **1 point de show-up**. Le point est compté tout de suite.
- Plusieurs résultats le même jour rapportent plusieurs points. Le mode lent du salon (un message toutes les 15 minutes) est réglé sur Discord.
- *(proposé)* Les vidéos comptent aussi. Un message avec plusieurs images ne rapporte qu'un point.
- La **chaîne** compte les **jours d'affilée** avec au moins un show-up. Dix résultats le même jour ne font qu'un jour de chaîne. Dès qu'un jour est manqué, la chaîne est brisée, mais les points restent.
- PlugBot met **❗** sur chaque résultat compté, puis l'annonce dans show-up :

  > 🔥 @Membre vient de show up !
  > ⛓️ Chaîne : **12 jours d'affilée** · 📅 Semaine : **9 points** (3e Free) · 🏅 Total : **148 points**

  Un membre en prison n'a pas de rang : PlugBot lui rappelle combien de jours il lui reste pour sortir.

## Vérification par l'admin

Le porteur de projet est le seul dont les réactions comptent. Il passe sur les résultats marqués ❗ :

- **👍** : le show-up est confirmé. PlugBot ne fait rien.
- **❌** : PlugBot retire le point et l'écrit dans show-up, en mentionnant le membre. Le nom de l'admin s'affiche sans qu'il soit notifié.

  > ❌ Le point de show-up de @Membre a été retiré par @Admin.
  > 🏅 Total : **147 points** · 📅 Semaine : **8 points**

- *(proposé)* Si l'admin enlève sa ❌, le point est rendu. Si le membre supprime son résultat, le point est retiré. Les deux sont annoncés dans show-up.

## Récompenses

Les récompenses sont des **rôles**. Chacun donne une réduction sur la formation, et elles se cumulent :

| Rôle | Comment l'obtenir | Réduction |
|---|---|---|
| 🔥🔥🔥 | **21 jours** de show-up d'affilée | −15 % |
| ⚡plug7⚡ | Gagner le **classement Free de la semaine** | −25 % |
| ★plug30★ | Gagner le **classement Free du mois** | −35 % |

- Avec les trois rôles, la réduction totale est de **−75 %** : il reste **25 %** à payer.
- Les réductions sont annoncées publiquement.
- Les rôles ouvrent l'accès au salon des codes de réduction. Ce salon et les codes sont gérés par le porteur de projet.
- Chaque réduction ne s'utilise qu'une fois, même si le membre gagne plusieurs fois le même classement.
- Le gagnant de l'accompagnement est félicité publiquement, sans réduction : il est déjà dans l'accompagnement. Sa récompense se règle directement avec les membres de l'accompagnement, en dehors de PlugBot.
- Le rôle 🔥🔥🔥 est retiré dès que la chaîne est brisée. Quand un membre l'obtient, PlugBot l'annonce dans show-up :

  > 🔥 @Membre atteint **21 jours d'affilée** et débloque @🔥🔥🔥 : −15 % sur la formation !

- *(proposé)* ⚡plug7⚡ et ★plug30★ sont gardés pour de bon. Ils sont seulement mis de côté pendant un séjour en prison, puis rendus à la sortie.

## Classements

### Le challenge standard

Le challenge standard, c'est **poster tous les jours**. Il est annoncé et suivi automatiquement.
Les challenges personnalisés sont annoncés à la main par le porteur de projet : PlugBot ne s'en occupe pas.

| Challenge | Période | Taille |
|---|---|---|
| Semaine (top-7) | du **lundi 18 h** au **dimanche 18 h** UTC | top 5 Accompagnement + top 5 Free |
| Mois (top-30) | du **1er à 18 h** au **dernier jour du mois à 18 h** UTC | top 10 Accompagnement + top 10 Free |
| All-time | depuis le lancement, sans fin | top 10 Accompagnement + top 10 Free |

Entre la clôture et la relance (de dimanche 18 h à lundi 18 h pour la semaine, du dernier jour 18 h au 1er 18 h pour le mois), les résultats comptent pour le total, la chaîne et la prison, mais pas pour le challenge.
Ça évite de prendre de l'avance en postant le dimanche soir. Pendant cette pause, le message de show-up indique : « Semaine : le challenge reprend lundi à 18 h ».

### Calendrier (toujours à 18 h UTC)

| Salon | Quand | Message | Notifie les membres classés |
|---|---|---|---|
| top-7 | lundi | Lancement du challenge de la semaine | — |
| top-7 | mardi à samedi | Classement du jour, avec les jours restants | non |
| top-7 | dimanche | Classement final, ⚡plug7⚡ pour le gagnant Free | oui |
| top-30 | le 1er | Lancement du challenge du mois | — |
| top-30 | les dimanches, et les 10, 20 et 25 | Point d'étape, avec les jours restants | non |
| top-30 | le dernier jour du mois | Classement final, ★plug30★ pour le gagnant Free | oui |
| top-all-time | dimanche | Classement all-time | oui |

Quand plusieurs publications tombent le même jour (par exemple un dimanche qui est aussi le dernier jour du mois), chacune part dans son salon. Dans top-30, le classement final remplace le point d'étape.

### Les messages

> ⚡ **Le challenge de la semaine est lancé !**
> Jusqu'à dimanche 18 h (UTC), chaque résultat posté dans #flex-resultats te rapporte 1 point.
> Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement est mis à jour tous les soirs.
> Accompagnement et Free ont chacun leur classement.
>
> ⚡ Le meilleur Free de la semaine remporte @⚡plug7⚡ : −25 % sur la formation !

> ⚡ **Challenge de la semaine — classement du jour**
> Plus que 4 jours avant la fin, dimanche à 18 h (UTC). Chaque résultat compte : rien n'est encore joué !
>
> **Accompagnement**
> 1. @Membre — 6 points
> …
>
> **Free**
> 1. @Membre — 9 points
> …
>
> ⚡ À la fin de la semaine, le meilleur Free remporte @⚡plug7⚡ : −25 % sur la formation !

> ★ **Le challenge du mois de novembre 2026 est lancé !**
> Jusqu'au 30 novembre à 18 h (UTC), chaque résultat posté dans #flex-resultats te rapporte 1 point.
> C'est le début du mois : participe à ce challenge pour obtenir tes résultats !
> Accompagnement et Free ont chacun leur classement.
>
> ★ Le meilleur Free du mois remporte @★plug30★ : −35 % sur la formation !

Le point d'étape du mois suit le même modèle que le classement du jour (« Challenge du mois de novembre 2026 — point d'étape »).

> ⚡ **Classement de la semaine**
> Énorme travail, bravo à tous ceux qui se sont montrés !
>
> **Accompagnement**
> 1. @Membre — 9 points
> …
>
> **Free**
> 1. @Membre — 12 points
> …
>
> 🏆 @GagnantAccompagnement remporte le classement Accompagnement !
> ⚡ @GagnantFree remporte @⚡plug7⚡ : −25 % sur la formation !

> 👑 **Classement all-time**
> Les membres les plus réguliers depuis le lancement de PlugBot. Chaque résultat posté te fait monter !
>
> **Accompagnement** … **Free** …
>
> Les membres en prison n'apparaissent pas dans ce classement.

### Règles communes

- Les membres **en prison** n'apparaissent dans aucun classement, même s'ils ont des points.
- À points égaux, le plus gros total all-time passe devant, puis celui qui a atteint son score le premier.
- La semaine et le mois du lancement sont incomplets : pas de classement du jour, de point d'étape ni de clôture pour eux. Sinon, quelqu'un pourrait gagner −35 % avec trois jours de posts.

## La prison

### Le compteur

- Le compteur compte les **jours entiers sans show-up**. Un seul résultat le remet à zéro.
- Il ne démarre qu'après **7 jours entiers** passés sur le serveur, et le lendemain du lancement du bot.
- Il **repart de zéro** dès que le membre gagne ou perd le rôle @TikTok ou @Free.
  Exemple : un membre de l'accompagnement est à 13 jours sans show-up et quitte l'accompagnement. Il redevient Free : son compteur repart de zéro, et il a 21 jours avant la prison.
- Un changement de rôle ne fait pas sortir de prison.

### Les étapes

1. **5 jours avant la prison** (16 jours pour les Free, 10 pour l'accompagnement) : alerte dans la-prison, une seule fois par absence.

   > ⚠️ **Alerte : tu vas en prison.**
   > Dans 5 jours, tu iras en prison, parce que tu n'as posté aucun résultat montrant que tu es actif sur TikTok.
   > Si tu veux éviter ça, poste une vidéo et envoie le résultat dans les 5 jours qui viennent. Sinon, tu rejoindras la prison.
   > (La prison te coupe tous les accès principaux du Discord : écrire dans les salons, rejoindre les lives, accéder aux réductions, etc.)
   > Pour éviter que ça arrive, envoie juste un seul résultat dans #flex-resultats, le plus vite possible.
   >
   > Voici tous ceux qui iront en prison dans 5 jours s'ils ne postent aucun résultat :
   > @Membre1 @Membre2 @Membre3

2. **Entrée en prison** (21 jours pour les Free, 15 pour l'accompagnement) : PlugBot donne le rôle **💔Prisonnier💔**, met de côté ⚡plug7⚡ et ★plug30★, et l'annonce :

   > 🔒 @Membre vient d'entrer en prison : 21 jours sans show-up.
   > Pour sortir : 3 jours de show-up d'affilée dans #flex-resultats.

3. *(proposé)* **30 jours** sans show-up : « @Membre est définitivement en prison ». PlugBot n'écrit plus rien ensuite.

- Le rôle Prisonnier coupe les accès principaux du Discord, sauf la-prison et flex-resultats. Ces permissions sont réglées sur Discord.
- Chaque message regroupe tous les membres qui atteignent la même étape le même jour. La vérification se fait chaque jour juste après minuit UTC.
- Conséquence du départ à zéro : 22 jours après le lancement, tous les Free qui n'ont rien posté entrent en prison en même temps. Pour l'accompagnement, c'est 16 jours après le lancement.

### Sortir de prison

La seule façon de sortir est de **poster 3 jours d'affilée** dans flex-resultats, quelle que soit la situation. Trois résultats le même jour ne suffisent pas.
Au troisième jour, PlugBot retire le rôle Prisonnier, rend les récompenses mises de côté et l'annonce :

> 🔓 @Membre sort de prison après 3 jours de show-up d'affilée !

Si un membre de l'équipe retire quand même le rôle Prisonnier à la main, par exemple après une erreur, PlugBot le respecte : il rend les récompenses, annonce « @Membre a été libéré de prison par l'équipe », et remet le compteur à zéro.

## Coupures

Si le bot redémarre, il rattrape ce qui s'est passé pendant son absence :

- les résultats postés pendant la coupure ;
- les ❌ posées ou retirées et les résultats supprimés pendant les 7 derniers jours ;
- les changements de rôle ;
- une vérification de la prison ou un classement qu'il aurait manqué.
