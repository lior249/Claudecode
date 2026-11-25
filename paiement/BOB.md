# Bob (bot Discord) et les offres Overmaxx : cahier des charges

Bob remplace PlugBot, qui est supprimé du serveur.

Décisions prises avec le porteur de projet. Installation : voir `INSTALLER_BOB.md`.
Fuseau horaire de référence : **GMT** (heure du Togo). Les pages affichent aussi l'heure locale du membre.

## 1. Adresses du site

| Adresse | Rôle | Visibilité |
|---|---|---|
| `overmaxx.online` | redirige vers `/community` | publique |
| `/community` (+ `/community/paiement`, `/community/renouveler`) | paiement Community | publique |
| `/coaching/elite` | présentation (VSL) et candidature Tally | lien connu des prospects |
| `/coaching/elite/paiement/<lien unique>` | paiement Elite | lien personnel généré par Bob, après sélection |
| `/coaching` | réservation des coachings privés (connexion Discord) | membres Elite |
| `/admin` | calendrier des réservations, profils | uniquement l'identifiant Discord du porteur de projet |

## 2. Les offres

| Offre | Entrée (site, mobile money) | Renouvellement (site) | Accès |
|---|---|---|---|
| Community | 29 € ≈ 19 025 FCFA, 30 jours | 5 € ≈ 3 280 FCFA, +30 jours | Whop + Discord |
| Elite | 500 € ≈ 327 980 FCFA, **paiement unique**, 90 jours d'accompagnement | aucun | Whop + Discord + coaching |

- **Prix garantis** : chaque membre garde à vie le prix de renouvellement en vigueur à son inscription.
- Le renouvellement n'est possible **qu'avant la fin de l'accès**. Après, il faut repayer l'entrée.
- Le paiement par carte via SasPay n'est pas activé : la carte se fait directement sur Whop.

## 3. Accès Whop : offre gratuite avec liste d'attente (remplace les codes promo)

Une seule offre Whop cachée par programme (Community, Elite) :
- **gratuite**, en **liste d'attente** (`release_method: waitlist`) ;
- **durée d'accès de 30 jours** (Community) ou **90 jours** (Elite) ;
- avec une question : « Email utilisé pour ton paiement mobile money ».

Fonctionnement :
1. Après son paiement sur le site, le guide donne le lien de l'offre gratuite et rappelle de répondre avec **le même email**.
2. Bob consulte les demandes en attente (`GET /waitlist_entries?status=pending`) toutes les minutes.
   Si l'email répondu correspond à un paiement réussi qui n'a pas encore servi : **acceptation** (`POST /waitlist_entries/{id}/approve`).
   Sinon, la demande reste en attente ; elle est **refusée au bout de 48 h**, et le porteur de projet est prévenu.
3. **Renouvellement payé** : Bob **prolonge** l'accès Whop existant (`POST /memberships/{id}/extend`, +30 ou +90 jours).
4. **Pas de renouvellement** : Whop coupe l'accès tout seul à la date de fin, et Bob retire le membre du Discord.

Autorisations de la clé Whop : `plan:waitlist:read`, `plan:waitlist:manage`, lecture des abonnements, prolongation des abonnements.

## 4. Bob : renouvellements Community

- Messages privés **10 jours avant, 5 jours avant, 3 jours avant, puis dans les dernières 24 h**, avec le lien de renouvellement.
  Le dernier message précise que, sans renouvellement, il faudra repayer le prix d'entrée.
- À la fin de l'accès : **15 jours en attente** (rôle Attente, plus de rôle Community, accès Whop coupé par le site).
  Renouvellement encore possible au prix garanti, avec un rappel 3 jours avant la fin de l'attente.
  Ensuite : **retiré du serveur**, et il faut repayer l'entrée. (Elite : pas d'attente, retrait immédiat.)

## 5. Elite : paiement unique

- 500 €, une seule fois, pour 90 jours d'accompagnement. **Aucun renouvellement**, aucun rappel de paiement.
- À la fin des 90 jours, **personne n'est retiré** : le membre garde le serveur et son accès Whop (le site ne le coupe pas).
- Le parcours de l'accompagnement (étapes, fiche, GOAT, sinistrés) est décrit dans `docs/ACCOMPAGNEMENT-ELITE.md`.

## 5 ter. Membres payés par carte (Whop)

- Whop donne le rôle de l'offre à ceux qui paient par carte. Bob les repère (rôle sans paiement mobile money)
  et les liste dans **Membres**, partie « Carte (Whop) ». Pas de rappel avant la fin : la carte se renouvelle seule.
- Quand Whop retire le rôle (carte refusée, abonnement arrêté) :
  - **Community** : Bob prévient la personne, lui donne En Attente, et la retire du serveur au bout de 15 jours si l'abonnement ne reprend pas ;
  - **Elite** : l'admin est prévenu.

## 5 bis. Candidature Elite

1. `/coaching/elite` : vidéo de présentation (VSL), étapes, bouton **Postuler**. Aucun prix affiché.
2. `/coaching/elite/candidature` : **connexion Discord**. Le candidat rejoint le serveur avec le rôle **Attente** (un seul salon visible),
   pour que Bob puisse lui écrire.
3. Formulaire **Tally** intégré, avec les champs cachés `discord_id` et `pseudo`.
4. Page « en cours de traitement, réponse sous 24 h » qui se met à jour seule. Bob confirme la réception au candidat et envoie
   la candidature à l'admin avec les boutons **Retenir / Refuser**.
5. Retenu : la même page propose l'envoi d'une **vidéo d'1 minute** (150 Mo maximum, sur le serveur).
   L'admin la regarde sur `/admin/candidatures`, puis **Valider / Refuser**. La vidéo est supprimée après la décision.
6. Validé : Bob crée et envoie le **lien de paiement personnel à usage unique** ; la page l'affiche aussi.
7. Refusé : message de Bob, puis retrait du serveur s'il n'avait que le rôle Attente.

`/lien-elite` reste disponible pour créer un lien de paiement à la main.

## 6. Coaching privé (`/coaching`)

- Créneaux de **30 minutes**, tous les jours : **15h00 à 18h00 (6)** et **21h00 à 23h00 (4)**, soit 10 par jour (heure GMT).
- **Créneaux récurrents** : un créneau choisi (par exemple mardi 15h30) vaut chaque semaine, jusqu'à modification.
- **Rôle Elite** : minimum **4 par semaine**, maximum **1 par jour**. Premier arrivé, premier servi.
- **Rôle GOAT** : aucun accès au planning (live de groupe dédié, à part).
- Couleurs de la grille : **orange** pour mes créneaux, **gris foncé** pour ceux pris par un autre, **gris clair** pour les créneaux libres.
- **Délai** : une réservation faite moins de 4 h avant **ne compte pas pour le jour même**, seulement à partir de la semaine suivante.
  Exemple : séances à partir de 15h, donc il faut réserver au plus tard à 10h59, **pour tous les créneaux du jour**, y compris ceux de 21h.
- **Rappels pour le membre** : un rappel personnalisé, à l'heure de son choix, au plus 4 h avant ; plus un rappel automatique 1 h avant.
- **Rappel pour le porteur de projet** : un message 2 h avant la **première** séance du jour, avec le lien du calendrier.
- **Annulation** : jusqu'à 30 minutes avant, **justification obligatoire**. Le porteur de projet reçoit un message.
- **Lieu** : un **salon vocal fixe** limité à 2 personnes. Bob envoie son lien dans les rappels.
- Après chaque réservation ou modification, Bob envoie le récapitulatif et le lien pour modifier.

## 7. Espace admin (`/admin`)

- Connexion par Discord. Seul l'identifiant Discord du porteur de projet y a accès.
- Le calendrier de la semaine affiche les mêmes couleurs. Un clic sur un créneau pris ouvre une fenêtre avec le membre et son profil.
- Plus tard : profil de coaching rempli par le membre (questionnaire) et mis à jour après chaque séance.

## 8. Technique

- Bob tourne **dans le même programme que le site**, dans le conteneur `overmaxx-paiement`, avec la même base SQLite.
- discord.js 14. Intents : Server Members. Permissions : expulser des membres, gérer les rôles, envoyer des messages privés.
