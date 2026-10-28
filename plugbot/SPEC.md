# PlugBot — spécification

PlugBot est un bot Discord qui suit les **show-ups** des membres du serveur.
Faire un show-up, c'est poster un résultat : se montrer chaque jour est l'un des critères les plus importants de la monétisation TikTok.

Les points marqués *(proposé)* sont des propositions en attente de confirmation. Le reste a été validé par le porteur de projet.

## Principes

- PlugBot est un **bot à part**. Il ne se mélange pas avec le bot actuel qui envoie les notifications de paiement.
- Tous ses salons sont **publics** : tout le monde voit qui a posté, qui gagne et qui est en prison. Les membres sont mentionnés publiquement. Aucun message privé.
- Toutes les heures sont en **temps universel (GMT)**. Une journée va de minuit à minuit GMT. Les publications et la fin des challenges sont à **20 h 30 GMT**.
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
| ➕ **show-up** | Le journal : chaque show-up, chaque point retiré, chaque rôle 🔥🔥🔥 gagné, et le récap des récompenses le dimanche. |
| 💸 **top-7** | Le challenge de la semaine : lancement, classement du jour et clôture. |
| 💎 **top-30** | Le challenge du mois : lancement, points d'étape et clôture. |
| **top-all-time** | Le classement all-time, chaque dimanche à 20 h 30 GMT. |
| 🤢 **la-prison** | Les alertes, les entrées en prison et les sorties. |
| 💎 **bonus-top7**, **bonus-top30**, **bonus-21j** | Les bénéfices de chaque récompense. Chaque salon n'est visible qu'avec le rôle correspondant. Géré par le porteur de projet : PlugBot ne fait que les mentionner. |
| **guide-serveur** | Le fonctionnement des classements et de la prison. PlugBot le mentionne. |

Seul PlugBot écrit dans show-up, top-7, top-30, top-all-time et la-prison.

## Points et chaîne

- **Chaque message** posté dans flex-resultats avec au moins une image rapporte **1 point de show-up**. Le point est compté tout de suite.
- Plusieurs résultats le même jour rapportent plusieurs points. Le mode lent du salon (un message toutes les 15 minutes) est réglé sur Discord.
- *(proposé)* Les vidéos comptent aussi. Un message avec plusieurs images ne rapporte qu'un point.
- La **chaîne** compte les **jours d'affilée** avec au moins un show-up. Dix résultats le même jour ne font qu'un jour de chaîne. Dès qu'un jour est manqué, la chaîne est brisée, mais les points restent.
- PlugBot met **❗** sur chaque résultat compté, puis l'annonce dans show-up :

  > 🔥 @Membre vient de show up !
  > ⛓️ Chaîne : **12 jours d'affilée**
  > 📅 Classement semaine : **9 points** — 3e du classement Free
  > 🗓️ Classement mois : **31 points** — 44e du classement Free
  > 🏅 Classement total : **148 points** — 449e du classement Free

  Le rang est celui de la catégorie du membre (Free ou Accompagnement). Un membre en prison est « hors classement » : PlugBot lui rappelle combien de jours il lui reste pour sortir.

## Vérification par l'admin

Le porteur de projet est le seul dont les réactions comptent. Il passe sur les résultats marqués ❗ :

- **👍** : le show-up est confirmé. PlugBot ne fait rien.
- **❌** : PlugBot retire le point et l'écrit dans show-up, en mentionnant le membre. Le nom de l'admin s'affiche sans qu'il soit notifié.

  > ❌ Le point de show-up de @Membre a été retiré par @Admin.
  > 🏅 Total : **147 points** · 📅 Semaine : **8 points**

- *(proposé)* Si l'admin enlève sa ❌, le point est rendu. Si le membre supprime son résultat, le point est retiré. Les deux sont annoncés dans show-up.

## Récompenses

Les récompenses sont des **rôles**. Les réductions sur la formation se cumulent :

| Rôle | Comment l'obtenir | Ce qu'il débloque | Salon bonus |
|---|---|---|---|
| 🔥🔥🔥 | **21 jours** de show-up d'affilée | −15 % sur la formation | bonus-21j |
| ⚡plug7⚡ | Gagner le **classement Free de la semaine** | −25 % sur la formation | bonus-top7 |
| ★plug30★ | Gagner le **classement Free du mois** | −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement | bonus-top30 |

- Avec les trois rôles, la réduction totale est de **−75 %** : il reste **25 %** à payer.
- Les réductions sont annoncées publiquement.
- Les rôles ouvrent l'accès au salon des codes de réduction. Ce salon et les codes sont gérés par le porteur de projet.
- Chaque réduction ne s'utilise qu'une fois, même si le membre gagne plusieurs fois le même classement.
- Le gagnant de l'accompagnement est félicité publiquement, sans réduction : il est déjà dans l'accompagnement. Sa récompense se règle directement avec les membres de l'accompagnement, en dehors de PlugBot.
- Le rôle 🔥🔥🔥 est retiré dès que la chaîne est brisée.

### Messages aux gagnants

Chaque gagnant reçoit un message qui ne notifie que lui, et l'envoie vers son salon bonus :

| Récompense | Salon | Quand |
|---|---|---|
| ⚡plug7⚡ | top-7 | 3 minutes après la clôture de la semaine |
| ★plug30★ | top-30 | 3 minutes après la clôture du mois |
| 🔥🔥🔥 | show-up | tout de suite, juste après son message de show-up |

> 🎉 Hourra @Membre ! Tu viens de gagner le challenge du mois (top 30).
> Tu gagnes −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement.
> Retrouve tes bénéfices dans #bonus-top30.

> 🎉 Hourra @Membre ! Tu viens de gagner le challenge de la semaine (top 7).
> Tu gagnes −25 % sur la formation.
> Retrouve tes bénéfices dans #bonus-top7.

> 🎉 Hourra @Membre ! Tu viens de gagner le challenge des 21 jours d'affilée (🔥🔥🔥).
> Tu gagnes −15 % sur la formation.
> Retrouve tes bénéfices dans #bonus-21j.

### Récap du dimanche

Chaque dimanche à 20 h 30 GMT, dans show-up, avec @everyone :

> @everyone
> 🏆 **Voici ce que tu gagnes en postant tes résultats sur la plateforme :**
>
> ★ **Top 30** : le top 30 récapitule les 10 meilleurs membres du serveur sur les 30 derniers jours. Termine 1er du classement Free et tu gagnes le rôle @★plug30★, qui te débloque −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement.
>
> ⚡ **Top 7** : le top 7 récapitule les 5 meilleurs membres du serveur sur les 7 derniers jours. Termine 1er du classement Free et tu gagnes le rôle @⚡plug7⚡, qui te débloque −25 % sur la formation.
>
> 🔥 **21 jours d'affilée** : poste un résultat tous les jours pendant 21 jours d'affilée et tu gagnes le rôle @🔥🔥🔥, qui te débloque −15 % sur la formation.
>
> ⚠️ Attention : tous les membres inactifs qui ne passent pas à l'action vont intégrer la prison.
>
> Pour comprendre ces classements en détail, regarde #guide-serveur.

- *(proposé)* ⚡plug7⚡ et ★plug30★ sont gardés pour de bon. Ils sont seulement mis de côté pendant un séjour en prison, puis rendus à la sortie.

## Classements

### Le challenge standard

Le challenge standard, c'est **poster tous les jours**. Il est annoncé et suivi automatiquement.
Les challenges personnalisés sont annoncés à la main par le porteur de projet : PlugBot ne s'en occupe pas.

| Challenge | Période | Taille |
|---|---|---|
| Semaine (top-7) | du **dimanche 20 h 30** au **dimanche 20 h 30** suivant (GMT) | top 5 Accompagnement + top 5 Free |
| Mois (top-30) | du **dernier jour du mois précédent à 20 h 30** au **dernier jour du mois à 20 h 30** (GMT) | top 10 Accompagnement + top 10 Free |
| All-time | depuis le lancement, sans fin | top 10 Accompagnement + top 10 Free |

Il n'y a **aucune pause** : dès qu'un challenge se termine, le suivant commence. L'annonce du lancement arrive un jour plus tard (lundi 20 h 30, ou le 1er à 20 h 30), pour ne pas enchaîner trop d'annonces le même soir.

**Tous les messages des salons top-7, top-30 et top-all-time commencent par @everyone** : tout le serveur est notifié.

### Calendrier (toujours à 20 h 30 GMT)

| Salon | Quand | Message |
|---|---|---|
| top-7 | lundi | Lancement du challenge de la semaine |
| top-7 | mardi à samedi | Classement du jour, avec les jours restants |
| top-7 | dimanche | Clôture : classement final, ⚡plug7⚡ pour le gagnant Free |
| top-30 | le 1er | Lancement du challenge du mois |
| top-30 | chaque dimanche | Classement provisoire, avec les jours restants |
| top-30 | les 10, 20 et 25 | Rappel du challenge, sans classement |
| top-30 | le dernier jour du mois | Clôture : classement final, ★plug30★ pour le gagnant Free |
| top-all-time | dimanche | Classement all-time |
| show-up | dimanche | Récap des récompenses |

- Si le 1er, le 10, le 20 ou le 25 tombe un dimanche, c'est le lancement ou le classement provisoire qui part, pas les deux. Le dernier jour du mois, seule la clôture part dans top-30.

### Les messages

> @everyone
> ⚡ **Le challenge de la semaine est lancé !**
> Depuis dimanche 20 h 30 et jusqu'à dimanche prochain 20 h 30 (GMT), chaque résultat posté dans #flex-resultats te rapporte 1 point.
> Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement est mis à jour tous les soirs.
> Accompagnement et Free ont chacun leur classement.
>
> ⚡ Le meilleur Free de la semaine remporte @⚡plug7⚡ : −25 % sur la formation !

> @everyone
> ⚡ **Challenge de la semaine — classement du jour**
> Plus que 4 jours avant la fin, dimanche à 20 h 30 (GMT). Chaque résultat compte : rien n'est encore joué !
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

> @everyone
> ★ **Le challenge du mois de novembre 2026 est lancé !**
> Depuis le 31 octobre à 20 h 30 et jusqu'au 30 novembre à 20 h 30 (GMT), chaque résultat posté dans #flex-resultats te rapporte 1 point.
> C'est le début du mois : participe à ce challenge pour obtenir tes résultats !
> Accompagnement et Free ont chacun leur classement.
>
> ★ Le meilleur Free du mois remporte @★plug30★ : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !

Le classement provisoire du mois suit le même modèle que le classement du jour (« Challenge du mois de novembre 2026 — classement provisoire »).

> @everyone
> ★ **Rappel : challenge du mois de novembre 2026**
> Plus que 20 jours avant la fin, le 30 novembre à 20 h 30 (GMT).
> Participe à ce challenge pour obtenir tes résultats : chaque résultat posté dans #flex-resultats te rapporte 1 point.
>
> ★ À la fin du mois, le meilleur Free remporte @★plug30★ : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !

> @everyone
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

> @everyone
> 👑 **Classement all-time**
> Les membres les plus réguliers depuis le lancement de PlugBot. Chaque résultat posté te fait monter !
>
> **Accompagnement** … **Free** …
>
> Les membres en prison n'apparaissent pas dans ce classement.

### Règles communes

- Les membres **en prison** n'apparaissent dans aucun classement, même s'ils ont des points.
- À points égaux, le plus gros total all-time passe devant, puis celui qui a atteint son score le premier.
- La semaine et le mois du lancement sont incomplets : rien n'est publié pour eux (ni lancement, ni classement, ni rappel, ni clôture). Sinon, quelqu'un pourrait gagner −35 % avec trois jours de posts.

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

   > 🔒 **Tu viens de rejoindre la prison : 21 jours sans show-up.**
   > Voici comment en sortir : poste un résultat dans #flex-resultats pendant 3 jours d'affilée.
   > Si tu veux plus de détails, va voir #guide-serveur.
   >
   > Voici ceux qui viennent de rejoindre la prison :
   > @Membre1 @Membre2 @Membre3

3. *(proposé)* **30 jours** sans show-up : même message, avec le titre « Définitivement en prison : 30 jours sans show-up ». PlugBot n'écrit plus rien ensuite.

- Le rôle Prisonnier coupe les accès principaux du Discord, sauf la-prison et flex-resultats. Ces permissions sont réglées sur Discord.
- Chaque message regroupe tous les membres qui atteignent la même étape le même jour. La vérification se fait chaque jour juste après minuit GMT.
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
