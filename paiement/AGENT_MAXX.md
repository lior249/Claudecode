# Agent Maxx et les offres Overmaxx : cahier des charges

Décisions prises avec le porteur de projet. Ce qui est marqué **À CONFIRMER** attend sa réponse.
Fuseau horaire de référence : **GMT** (heure du Togo). Les pages affichent aussi l'heure locale du membre.

## 1. Adresses du site

| Adresse | Rôle | Visibilité |
|---|---|---|
| `overmaxx.online` | redirige vers `/community` | publique |
| `/community` (+ `/community/renouveler`) | paiement Community | publique |
| `/coaching/elite` (+ renouvellement) | paiement Elite | **lien privé**, donné après sélection (formulaire Tally) |
| `/coaching` | réservation des coachings privés (connexion Discord) | membres Elite |
| `/admin` | calendrier des réservations, profils | uniquement l'identifiant Discord du porteur de projet |

## 2. Les offres

| Offre | Entrée | Renouvellement | Si non renouvelé |
|---|---|---|---|
| Community | 29 € ≈ 19 025 FCFA (30 jours inclus) | 5 € ≈ 3 280 FCFA / 30 jours | retiré du Discord et de Whop ; pour revenir, il repaie l'entrée |
| Elite | 500 € ≈ 327 980 FCFA (3 mois inclus) | 60 € ≈ 39 360 FCFA / 90 jours | **À CONFIRMER** (voir la question 1) |

- **Prix garantis** : chaque membre garde à vie le prix de renouvellement en vigueur à son inscription.
  Si les prix augmentent (par exemple 37 € puis 7 €/mois), seuls les nouveaux paient le nouveau tarif.
- Le renouvellement n'est possible **qu'avant la fin de l'accès**. Après, la page de renouvellement renvoie vers l'inscription.
- **Lien de grâce** : le porteur de projet peut prolonger gratuitement un membre (par exemple un Elite qui n'est pas passé GOAT par manque d'accompagnement).
- Le paiement par carte via SasPay n'est pas activé : le mobile money est le seul moyen sur le site. La carte se fait directement sur Whop.

## 3. Lier le membre à Discord

Après le paiement, le guide affiche **« Connecter mon Discord »** (connexion officielle Discord, OAuth2).
Agent Maxx ajoute alors le membre au serveur avec son rôle (Community ou Elite).
Pour les membres mobile money, Agent Maxx gère les rôles, et non Whop.

## 4. Agent Maxx : renouvellements

- Messages privés **3 jours avant, la veille et le jour J**, avec le lien personnel de renouvellement.
- À l'expiration, sans délai de grâce : **retiré du serveur Discord** (kick) **et accès Whop annulé**.
  Il reçoit un dernier message privé avec le lien d'inscription.

## 5. Coaching privé (`/coaching`)

- Créneaux de **30 minutes**, tous les jours : **15h00 à 18h00 (6)** et **21h00 à 23h00 (4)**, soit 10 par jour (heure GMT).
- **Créneaux récurrents** : un créneau choisi (par exemple mardi 15h30) vaut chaque semaine, jusqu'à modification.
- **Rôle Elite** : minimum **4 par semaine**, maximum **1 par jour**. Premier arrivé, premier servi.
- **Rôle GOAT** : aucun accès au planning (live de groupe dédié, à part).
- Couleurs de la grille : **orange** pour mes créneaux, **gris foncé** pour ceux pris par un autre, **gris clair** pour les créneaux libres.
- **Délai** : une réservation faite moins de 4 h avant **ne compte pas pour le jour même**, seulement à partir de la semaine suivante.
  Exemple : séances à partir de 15h, donc il faut réserver au plus tard à 10h59. **À CONFIRMER** pour les créneaux de 21h (question 3).
- **Rappels pour le membre** : un rappel personnalisé, à l'heure de son choix, au plus 4 h avant ; plus un rappel automatique 1 h avant.
- **Rappel pour le porteur de projet** : un message 2 h avant la **première** séance du jour, avec le lien du calendrier.
- **Annulation** : jusqu'à 30 minutes avant, **justification obligatoire**. Le porteur de projet reçoit un message.
- **Lieu** : un salon vocal Discord pour 2 personnes (voir la question 5).
- Après chaque réservation ou modification, Agent Maxx envoie le récapitulatif et le lien pour modifier.

## 6. Espace admin (`/admin`)

- Connexion par Discord. Seul l'identifiant Discord du porteur de projet y a accès.
- Le calendrier de la semaine affiche les mêmes couleurs. Un clic sur un créneau pris ouvre une fenêtre avec le membre et son profil.
- Plus tard : profil de coaching rempli par le membre (questionnaire) et mis à jour après chaque séance.

## 7. Technique

- Agent Maxx tourne **dans le même programme que le site**, dans le conteneur `overmaxx-paiement`, avec la même base SQLite.
- discord.js 14. Intents : Server Members. Permissions : expulser des membres, gérer les rôles, gérer les salons, créer une invitation.
- Whop : permissions de clé supplémentaires, **lire les abonnements** (memberships) et **les annuler** (membership:cancel).
