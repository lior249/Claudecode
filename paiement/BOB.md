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
| Elite | 500 € ≈ 327 980 FCFA, 90 jours | 60 € ≈ 39 360 FCFA, +90 jours (GOAT et « inconstants », voir § 5) | Whop + Discord + coaching |

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
- À l'expiration, sans délai de grâce : **retiré du serveur Discord**, et l'accès Whop expire de lui-même.

## 5. Elite : fin des 3 mois

- **10 jours avant** la fin, Bob prévient le porteur de projet en privé et lui demande de classer le membre :
  - **Insatisfait** (il n'a pas encore eu les résultats promis) : prolongé gratuitement de 90 jours, l'accompagnement continue ;
  - **Inconstant** (il n'a pas travaillé) : Bob lui annonce que l'accompagnement s'arrête à la fin de la période.
    Pour continuer, il doit payer une caution de 60 € tous les 3 mois. S'il refuse, c'est terminé.
- Les **GOAT** renouvellent à 60 € tous les 3 mois.
- Sans action à la date de fin : retiré du Discord, et l'accès Whop expire.

## 5 bis. Candidature Elite

- `/coaching/elite` : vidéo de présentation (VSL) et formulaire Tally. **Pas de prix ni de paiement visible.**
- Bob envoie chaque candidature au porteur de projet en message privé (webhook Tally).
- Le porteur de projet recontacte lui-même les candidats retenus. Il obtient de Bob un **lien de paiement personnel et unique**
  (par exemple `/coaching/elite/paiement/k3Fz…`), valable pour un seul paiement.

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
