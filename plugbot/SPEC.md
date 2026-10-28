# PlugBot — spécification

PlugBot est un bot Discord qui suit les **show-ups** des membres du serveur.
Faire un show-up, c'est poster un résultat : se montrer chaque jour est l'un des critères les plus importants de la monétisation TikTok.

Les points marqués *(proposé)* sont des propositions en attente de confirmation. Le reste a été validé par le porteur de projet.

## Principes

- PlugBot est un **bot à part**. Il ne se mélange pas avec le bot actuel qui envoie les notifications de paiement.
- Tous ses salons sont **publics** : tout le monde voit qui a posté, qui gagne et qui est en prison. Les membres sont mentionnés publiquement.
- Toutes les heures sont en **temps universel (UTC)**. Une journée va de minuit à minuit UTC.
- Le suivi part de **zéro** au lancement : seuls les résultats postés après l'arrivée du bot comptent.

## Catégories de membres

| Catégorie | Rôle | Membres (octobre 2026) |
|---|---|---|
| **Free** | @Free | 293 |
| **Plug** (l'accompagnement) | @TikTok | 22 |

- Les deux catégories ont des classements séparés. Un membre qui a les deux rôles compte en Plug.
- Les membres sans aucun de ces deux rôles ne sont pas suivis. Les rôles **Plugged®** et **Approuvé** sont donnés à la main et ne sont pas utilisés par PlugBot.
- *(proposé)* Le porteur de projet n'est pas suivi : il ne gagne pas de points et ne va pas en prison.
- *(proposé)* Les classements utilisent le **rôle actuel** du membre, et tous ses points le suivent.

## Salons

| Salon | Ce qui s'y passe |
|---|---|
| 🎮 **flex-resultats** | Les membres y postent leurs résultats. |
| ➕ **show-up** | Le journal : chaque show-up, chaque point retiré, chaque rôle 🔥🔥🔥 gagné. |
| 💸 **top-7** | Le classement de la semaine, chaque dimanche à 18 h UTC. |
| 💎 **top-30** | Le classement du mois, le dernier jour du mois à 18 h UTC. |
| 🤢 **la-prison** | Les alertes, les entrées en prison et les sorties. |
| **sortir-de-la-prison** | Les tickets pour justifier une absence. Géré par l'équipe, pas par PlugBot. |

Seul PlugBot écrit dans show-up, top-7, top-30 et la-prison.

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
| ⚡plug7⚡ | Gagner le **classement de la semaine** | −25 % |
| ★plug30★ | Gagner le **classement du mois** | −35 % |

- Avec les trois rôles, la réduction totale est de **−75 %** : il reste **25 %** à payer.
- Les rôles ouvrent l'accès au salon des codes de réduction. Ce salon et les codes sont gérés par le porteur de projet.
- Chaque réduction ne s'utilise qu'une fois, même si le membre gagne plusieurs fois le même classement.
- Le rôle 🔥🔥🔥 est retiré dès que la chaîne est brisée. Quand un membre l'obtient, PlugBot l'annonce dans show-up :

  > 🔥 @Membre atteint **21 jours d'affilée** et débloque @🔥🔥🔥 : −15 % sur la formation !

- *(proposé)* ⚡plug7⚡ et ★plug30★ sont gardés pour de bon. Ils sont seulement mis de côté pendant un séjour en prison, puis rendus à la sortie.
- *(proposé)* Le gagnant d'un classement est le **premier de chaque catégorie** : un gagnant Free et un gagnant Plug.

## Classements

| Salon | Période | Publication | Taille |
|---|---|---|---|
| top-7 | du dimanche 18 h au dimanche 18 h suivant | chaque dimanche à 18 h UTC | top 5 Free + top 5 Plug |
| top-30 | du dernier jour du mois précédent à 18 h au dernier jour du mois à 18 h | le dernier jour du mois à 18 h UTC | top 10 Free + top 10 Plug |

- Un seul message par publication, qui mentionne tous les membres classés et annonce les gagnants :

  > ⚡ **Classement de la semaine**
  > Énorme travail, bravo à tous ceux qui se sont montrés !
  >
  > **Free**
  > 1. @Membre — 12 points
  > …
  >
  > **Plug**
  > 1. @Membre — 9 points
  > …
  >
  > ⚡ @Membre et @Membre remportent @⚡plug7⚡ : −25 % sur la formation !

- Les membres **en prison** n'apparaissent dans aucun classement, même s'ils ont des points.
- À points égaux, le plus gros total all-time passe devant, puis celui qui a atteint son score le premier.
- *(proposé)* La semaine et le mois du lancement sont incomplets : ils ne sont pas publiés. Le premier top-7 couvre la première semaine entière, le premier top-30 le premier mois entier.
  Sinon, quelqu'un pourrait gagner −35 % avec trois jours de posts.

## La prison

- PlugBot ne s'occupe d'un membre pour la prison qu'après **7 jours entiers** passés sur le serveur.
- **10 jours** sans show-up : alerte dans la-prison. Elle mentionne le membre et lui dit exactement ce qui l'attend dans 5 jours.

  > ⚠️ @Membre : 10 jours sans show-up.
  > Encore 5 jours sans résultat et c'est la prison : le rôle @Prisonnier, plus le droit d'écrire ailleurs que dans la prison, et plus aucun accès aux récompenses (@🔥🔥🔥, @⚡plug7⚡, @★plug30★).
  > Un seul résultat dans #flex-resultats suffit pour l'éviter.

- **15 jours** sans show-up : entrée en prison. PlugBot donne le rôle **💔Prisonnier💔**, met de côté ⚡plug7⚡ et ★plug30★, et l'annonce :

  > 🔒 @Membre vient d'entrer en prison : 15 jours sans show-up.
  > Pour sortir : 3 jours de show-up d'affilée dans #flex-resultats, ou un ticket dans #sortir-de-la-prison pour justifier ton absence.

- *(proposé)* **30 jours** sans show-up : « @Membre est définitivement en prison ». PlugBot n'écrit plus rien ensuite.
- Le rôle Prisonnier bloque l'écriture partout, sauf dans la prison, le salon des tickets et flex-resultats. Ces permissions sont réglées sur Discord.
- Chaque message regroupe tous les membres qui atteignent la même étape le même jour. La vérification se fait chaque jour juste après minuit UTC.
- Conséquence du départ à zéro : 16 jours après le lancement, tous ceux qui n'ont rien posté entrent en prison en même temps.

### Sortir de prison

Il y a deux façons de sortir :

1. **Poster 3 jours d'affilée** dans flex-resultats. Trois résultats le même jour ne suffisent pas. Au troisième jour, PlugBot retire le rôle Prisonnier, rend les récompenses mises de côté et l'annonce :

   > 🔓 @Membre sort de prison après 3 jours de show-up d'affilée !

2. **Ouvrir un ticket** dans sortir-de-la-prison et justifier son absence (problème de santé, par exemple). Si l'équipe accepte, elle **retire le rôle Prisonnier à la main**.
   PlugBot s'en rend compte, rend les récompenses mises de côté, l'annonce, et le compteur de la prison repart de zéro :

   > 🔓 @Membre a été libéré de prison par l'équipe.

   Si l'absence n'est pas justifiée, l'équipe ne touche à rien : le membre doit poster 3 jours d'affilée.

## Coupures

Si le bot redémarre, il rattrape ce qui s'est passé pendant son absence :

- les résultats postés pendant la coupure ;
- les ❌ posées ou retirées et les résultats supprimés pendant les 7 derniers jours ;
- les rôles Prisonnier retirés par l'équipe ;
- une vérification de la prison ou un classement qu'il aurait manqué.
