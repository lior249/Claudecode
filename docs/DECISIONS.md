# Creato Learn — décisions du porteur de projet

Ce document complète `docs/SPEC.md`. **En cas de contradiction, ce document l'emporte.**
Les points marqués *(proposé)* sont des propositions techniques en attente de confirmation.

## Contexte

- Démarrage : **10 apprenants**. Plus de **80 % sur téléphone**. Âge moyen : environ 20 ans.
- Problème à résoudre : les élèves décrochaient vers 20 % de la formation (modules de 20 min à 1 h).
  Désormais : module Whop de 5 min maximum, puis environ 20 min de mise en pratique dans Creato.
- Creato **n'héberge aucun contenu de formation**. Il donne des consignes courtes, reçoit les réalisations, les valide et en tire des données.
- Langue : **français uniquement**. Ton familier mais simple et amical, sans argot ni jargon. Tutoiement *(proposé)*.

## Accès et authentification

- Seuls les membres du serveur Discord qui ont le rôle **@TikTok** (donné après paiement de l'accompagnement) peuvent entrer.
  L'identifiant du rôle sera fourni par le porteur de projet.
- *(proposé)* La connexion Discord OAuth2 suffit : c'est la vraie page de connexion Discord, donc l'identité est prouvée.
  On remplace le code envoyé par le bot par une **vérification du rôle @TikTok** à chaque connexion, puis revérifiée régulièrement.
  Si le rôle disparaît (remboursement, exclusion), l'accès est coupé.

## Whop

- Chaque module a un **lien d'accès Whop secret** (lien de « paiement » à 0 €). C'est le seul moyen d'accéder au module sur Whop.
- Le lien d'un module n'est révélé qu'une fois le module précédent validé. Il ne doit jamais apparaître avant, même dans le code de la page.

## Compréhension (QCM)

- 20 questions, 4 réponses, 16/20 minimum : inchangé.
- **Correction immédiate après chaque réponse.** La réponse choisie se colore : vert si elle est juste, rouge sinon,
  et la bonne réponse s'affiche alors en vert. **Dans les deux cas**, une courte explication s'affiche sous la question.
- Après un échec : message « Retourne revoir le module sur Whop », puis **5 minutes d'attente** avant de pouvoir réessayer.
- **Nombre de tentatives illimité.**

## Entraînement noté (IA)

- Seuil : **8/10**. Le barème est écrit en **texte libre (prompt)** par l'Admin, exercice par exercice. Il n'y a pas de grille fixe.
- Les critères importants pèsent lourd (par exemple 2 × 3 points + 4 × 1 point) : en rater un fait tomber sous 8.
- Exemples réels de barèmes :
  - **Cuts** : un cut attendu à 3 s ± 0,5 s, le suivant 3 s plus tard ± 0,5 s, puis 2 s plus tard… Chaque cut mal placé coûte 1 point.
  - **Silences** : à partir d'un audio fourni, couper les silences. Un silence de 0,5 s ou plus coûte 1 point (jusqu'à 0,49 s, c'est toléré).
- *(proposé)* Les mesures précises (position des cuts, durée des silences) sont faites **par le serveur avec ffmpeg**, puis transmises à l'IA avec le barème.
  Gemini seul ne mesure pas une vidéo au dixième de seconde près.
- Retour à l'apprenant : **détail critère par critère** avec les points.
- Panne de l'IA : message « Ta demande n'a pas pu être traitée ». **Après 3 échecs techniques**, un bouton **« Faire appel à un humain »** apparaît.
  La soumission part alors chez le coach de l'apprenant.
- Vidéos : exports **CapCut** (mobile ou PC), en MP4. Audios : MP3 ou M4A.

## Décisions

- La niche et les autres décisions sont de la **simple saisie** : aucune correction par l'IA.
  La leçon est validée quand les champs sont remplis. Le coach relira plus tard.

## Module de lancement (module 6)

- Un seul formulaire :
  1. « As-tu terminé tes 5 vidéos ? » Oui.
  2. « As-tu envoyé tes vidéos à ton coach ? » Oui. Les vidéos passent par Drive ou Discord, **en dehors de Creato**.
  3. Une dizaine de questions ouvertes sur le ressenti : le montage, TikTok, ce qu'il pense pouvoir réussir…
     Elles doivent pousser à développer plutôt qu'à répondre vaguement.
- Aucun fichier vidéo n'est envoyé dans Creato pour ce module.

## Délais et pénalités

- Chaque exercice débloqué a **24 heures** pour être validé.
- Chaque tranche de 24 heures de retard ajoute **−2 points** de pénalité. Les pénalités se cumulent.
- Les pénalités **n'empêchent pas** d'avancer et **n'affectent pas le rang**. Elles figurent sur la fiche de l'élève pour le coach :
  périodes d'absence, retards module par module.

## Fin du Learn

- La dernière validation donne automatiquement le **rôle Discord @Élite** (rôle déjà existant), via le bot.
  Ce rôle ouvre les salons de coaching.

## Coachs

- Le rôle **Coach** est construit dès maintenant.
- Chaque coach suit au maximum **20 élèves**. Les coachs sont classés par ordre : le coach 1 (le porteur de projet) se remplit en premier, puis le coach 2, et ainsi de suite.
- Les notifications d'un élève ne vont qu'**à son coach**.
- **Fiche élève** détaillée : scores, nombre d'essais par exercice, critères qui ont posé problème, retards et absences, décisions, ressenti.
  Le but : savoir sur quoi travailler avec l'élève dès le début du coaching.

## Notifications

- Sur **Discord dès maintenant**, par message privé du bot. L'apprenant reçoit les résultats, les refus et les rappels de délai. Le coach reçoit les demandes d'intervention humaine.

## Rangs (à approfondir avant développement)

| Rang | Condition |
|---|---|
| E | Inscrit, n'a rien commencé |
| D | Module Montage terminé |
| C | Module Préparation terminé |
| B | Module Lancement terminé (rôle @Élite) |
| A | 10 000 abonnés |
| S | 3 millions de vues |
| SS | 500 € générés |
| SSS | Plus de 1 000 € générés |

- E à B se calculent automatiquement à partir de la progression. A à SSS dépendent de TikTok : saisie manuelle par le coach *(proposé)*, puisque l'API TikTok est hors périmètre.
- Un système de points lié à la note doit encore être défini.

## Design

- **Mode sombre**, ambiance **RPG**. Références : **Discord** et **Whop**. Des images d'inspiration arrivent.
- Logo provisoire : « Creato » en **Helvetica gras**, lettres très serrées (approche −100 de Photoshop, soit environ −0,1 em). À refaire plus tard.
- **Mobile d'abord.**

## Hébergement et budget

- Budget : **10 à 20 $ par mois**.
- *(proposé)* **Un seul serveur Linux (VPS)**, par exemple Hetzner ou OVH, à environ 5–8 € par mois.
  Il héberge l'application, la base PostgreSQL, les fichiers et le worker ffmpeg, avec HTTPS automatique.
  Le domaine reste chez LWS : il suffit de le faire pointer vers le serveur.
  Ni l'hébergement mutualisé LWS ni Netlify ne peuvent faire tourner ffmpeg, le worker et la base de données.
- Données hors UE.

## Méthode de travail

- Le porteur de projet n'a jamais codé : il recevra des résumés non techniques, des captures et des démos **bloc par bloc**.
- Objectif : une première version utilisable en **2 à 3 jours**, avec un point quotidien.
