# Creato Learn — décisions du porteur de projet

Ce document complète `docs/SPEC.md`. **En cas de contradiction, ce document l'emporte.**
Les points marqués *(à confirmer)* attendent une validation du porteur de projet.

## Contexte

- Démarrage : **10 apprenants**. Plus de **80 % sur téléphone**. Âge moyen : environ 20 ans.
- Problème à résoudre : les élèves décrochaient vers 20 % de la formation (modules de 20 min à 1 h).
  Désormais : module Whop de 5 min maximum, puis environ 20 min de pratique dans Creato.
- Le constat de départ : les élèves ne veulent pas apprendre les bases, puis ont du mal à faire des choix.
  Creato les **oblige à apprendre puis à choisir** : aucune interaction humaine tant que ce n'est pas fait.
- Creato **n'héberge aucun contenu de formation**. Il donne des consignes courtes, reçoit les réalisations, les valide et en tire des données.
- Langue : **français uniquement**. Ton familier, simple et amical, sans argot ni jargon. Tutoiement.

## Structure du parcours

**Niveau → Module → Leçon.** Strictement linéaire : toutes les leçons d'un module débloquent le module suivant ;
tous les modules d'un niveau débloquent le niveau suivant. L'Admin peut ajouter, modifier et réordonner
librement niveaux, modules et leçons.

### Niveau 1 — Les bases

**Module Monétisation** (module explicatif)
1. **QCM** : comprendre la monétisation TikTok (Compréhension, 20 questions).

**Module Montage**
1. **Cuts.** Vidéo **sans piste audio**. 4 cuts attendus : à 3 s, puis +2 s, +3 s et +5 s (soit 3 s, 5 s, 8 s et 13 s), à ± 0,5 s.
   Chaque cut manquant ou mal placé coûte **−2 points**. Un seul raté est toléré : avec deux ratés, la note tombe sous 8.
2. **Voix off.** Couper les silences d'une voix off fournie (environ 1 min). Chaque silence de **0,5 s ou plus** coûte **−1 point** (jusqu'à 0,49 s, c'est toléré).
3. **Illustrations en rythme.** Vidéo de **30 s**. Une illustration par **bout de phrase** (et non par phrase entière), de **3 s maximum**.
   Effets sonores sur les transitions. Silences coupés.
   L'Admin fournit le script découpé ligne par ligne : **chaque retour à la ligne correspond à un changement de scène**.

**Module Scripting**
1. **Transcription.** Extraire le script d'une voix off fournie. Réussi si le texte correspond à **96–97 %** au script de référence, qui n'est jamais montré à l'élève.
2. **Réduction.** Raccourcir un script fourni **sans toucher au hook** (la première phrase) et sans perdre de nuance.
3. **CTA.** Placer un CTA de façon naturelle, à l'un des emplacements probables définis par l'Admin.

**Module Test**
1. **Vidéo complète.** L'Admin fournit le script d'origine, les emplacements probables du CTA et une vidéo d'exemple finale.
   L'élève envoie son script et son montage, et reçoit une note.

Il faut **8/10 minimum** sur chaque exercice.

### Niveau 2 — Positionnement

Chaque module consiste à **choisir une seule fiche**, de façon définitive, dans un catalogue que l'Admin remplit à la main
(Admin → Catalogues → « Ajouter une niche », « Ajouter un pays », « Ajouter une méthode 10K »).

- **Vue d'ensemble** (liste) : miniature, nom, résumé, **niveau de concurrence** (Faible / Moyenne / Forte),
  **matériel nécessaire** (PC / Téléphone / PC et téléphone), et un bouton **« Choisir cette niche »**.
- **Page de la fiche** : tout le contenu (texte, photos, liens), avec le même bouton « Choisir cette niche ».
- Le choix demande une **confirmation**, car il est définitif.
- Une fiche déjà choisie ne peut pas être supprimée, seulement masquée. Le titre choisi est conservé même si la fiche change.

1. **Choix de niche.** Fiche niche : comptes exemples, résumé, types de contenus qui marchent, 2 ou 3 exemples de scripts, pays à cibler, erreurs à éviter.
2. **Pays cible.** Un pays de la monétisation, avec ses avantages et ses inconvénients.
3. **Méthode 10K.** Une méthode pour atteindre les 10 000 abonnés.

Les choix apparaissent sur la fiche de l'élève, pour que le coach vérifie qu'il s'y tient.

### Niveau 3 — Lancement

Un seul module, une seule leçon :
1. L'élève saisit la **phrase de validation** (« J'ai validé le module à 100 % » ; le texte exact sera fourni par le porteur de projet)
   et un **code de 10 caractères** montré dans la vidéo Whop. Le code est généré par Creato et modifiable par l'Admin.
   **Aucun indice** de la phrase ni du code n'apparaît dans l'application, y compris dans le code envoyé au navigateur.
   Ce n'est pas un coffre-fort : la vraie vérification se fait en coaching, où l'élève doit montrer ses vidéos.
2. Puis environ 10 questions ouvertes sur son ressenti (30 caractères minimum par réponse), modifiables dans l'Admin.
   Après 10 mauvais essais de phrase ou de code en une heure, l'élève est bloqué une heure.
3. Bouton **« Envoyer à mon coach »** :
   - il reçoit **tout de suite le rôle Discord @Élite** ;
   - son coach reçoit une notification « X vient d'obtenir le droit au coaching » avec le résumé ;
   - les 5 vidéos sont envoyées au coach **en dehors de Creato** (Drive ou Discord, selon les consignes du module Whop).

## Types de leçons (côté Admin)

| Type | Badge | Fonctionnement |
|---|---|---|
| **Compréhension** | U | QCM de 20 questions saisies à la main, 16/20 minimum |
| **Décision** | D | Choix d'une fiche dans un catalogue (niches, pays, méthodes…) |
| **Pratique IA** | P | Corrigée par l'IA : consigne pour l'agent + 1 à 4 critères (consigne + points retirés à chaque erreur) + références |
| **Pratique humaine** | P | Validée par le coach. Prévue, mais pas prioritaire |
| **Validation par code** | — | Phrase et code secret (niveau 3) |

## Compréhension (QCM)

- 20 questions et 4 réponses, saisies à la main par l'Admin. **16/20 minimum.**
- **Correction immédiate après chaque réponse.** Une bonne réponse s'affiche en vert. Une mauvaise s'affiche en rouge et la bonne apparaît en vert.
  **Dans les deux cas**, une courte explication s'affiche sous la question.
- Après un échec : « Retourne revoir le module sur Whop », puis **5 minutes d'attente** avant de réessayer.
- **Nombre de tentatives illimité.**

## Correction automatique (Pratique IA)

**Configuration par l'Admin, exercice par exercice. Rien n'est prédéfini.**
- **Consigne pour l'agent** : grand texte libre (exercice, script, timings, tolérances, exemples). Jamais montrée à l'élève.
- **Critères de notation : 1 à 4**, chacun avec deux champs séparés :
  - la **consigne du critère** (ce que l'agent vérifie), visible par l'élève avant l'envoi ;
  - les **points retirés à chaque fois** que le critère n'est pas respecté. **Pas de plafond** : la note ne descend jamais sous 0.
- **Éléments de référence** (jamais montrés à l'élève) :
  - un **texte de référence**, comparé exactement par le serveur (pourcentage de ressemblance, première phrase identique ou non) ;
  - un **fichier d'exemple** (vidéo ou audio), comparé par l'analyste.
- Un exercice sans consigne pour l'agent ou sans critère n'est pas encore ouvert aux élèves.

**Correction en deux temps, par deux IA :**
1. **Mesures exactes** (serveur, ffmpeg) : instants des cuts, plans, silences (dès 0,25 s), son présent ou non, durée.
2. **Analyste** (Gemini, multimodal) : décrit objectivement la vidéo ou l'audio. Il produit la transcription horodatée, les plans, les textes à l'écran, les effets sonores et la comparaison avec la référence. Il ne juge pas.
3. **Correcteur** (agent) : lit la consigne, les critères et le rapport. Il **compte les erreurs** par critère, avec les instants précis et un commentaire.
4. **Serveur** : points retirés = erreurs × points du critère ; note = 10 − total ; **8/10 minimum**.

- L'IA ne calcule jamais la note. Un critère oublié par le correcteur compte comme une panne (relançable), jamais comme un 10/10.
- Les critères sont figés au moment de l'envoi : une modification par l'Admin ne change pas une correction en cours ou passée.
- Fournisseur d'IA interchangeable par réglage. Modèles (`GEMINI_ANALYST_MODEL`, `GEMINI_GRADER_MODEL`) et précision (`GEMINI_VIDEO_FPS`, images par seconde) configurables.
- **Budget IA : 20 $ par mois.** Le coût réel est mesuré dès les premières corrections. Si le plafond est atteint, les corrections attendent en file au lieu de dépenser plus (mis en place à la mise en ligne).
- Si l'IA tombe en panne : « Ta demande n'a pas pu être traitée ». **Après 3 échecs techniques**, un bouton **« Faire appel à un humain »** apparaît.
- Formats : vidéos exportées de CapCut en MP4, audios en MP3 ou M4A.

## Délais : remarques sans pénalité

- Chaque leçon débloquée a **24 heures en continu**, nuits comprises.
- Un **rappel Discord** part **4 h avant** la fin du délai.
- **Aucune pénalité de points.** Les dates de déblocage et de validation de chaque leçon sont enregistrées.
- Sur la fiche coach, chaque dépassement est signalé **en rouge**, avec sa durée exacte. Par exemple :
  « A décroché entre *Montage — Cuts* et *Montage — Voix off* pendant plus de 24 h (précisément 3 j 4 h). »

## Accès et authentification

- Seuls les membres du serveur Discord qui ont le rôle **@TikTok** (donné après paiement) peuvent entrer.
- Serveur `1538598086589550604` · rôle @TikTok `1539957105560260738` · rôle @Élite `1540797992360218674`.
- Les administrateurs (déclarés par leur identifiant Discord dans `ADMIN_DISCORD_IDS`) entrent même sans le rôle.
  Le premier administrateur connecté devient le coach n° 1.
- Connexion Discord OAuth2, puis **vérification du rôle @TikTok** à la connexion et à intervalles réguliers. Pas de code envoyé par le bot.
- La fin du Learn donne le rôle **@Élite** (identifiant à fournir) via le bot.

## Whop

- Chaque module a un **lien d'accès Whop secret** (lien à 0 €). Il n'est révélé qu'une fois le module précédent validé.

## Coachs

- Rôle **Coach** construit dès maintenant. Au maximum **20 élèves par coach**. Les coachs sont pris dans l'ordre : le coach 1 (le porteur de projet) se remplit en premier.
- Les notifications d'un élève ne vont qu'à **son** coach.
- Le coach voit **la liste de ses élèves**. Un clic ouvre la **fiche** dans un panneau latéral :
  - progression, rang et dates de validation ;
  - nombre d'essais par exercice ;
  - critères qui ont posé problème ;
  - décrochages (en rouge) ;
  - choix du niveau 2 ;
  - ressenti du niveau 3.

## Notifications (Discord, message privé du bot)

- **Élève** : résultat de correction, rappel 4 h avant la fin du délai, déblocages.
- **Coach** : demande d'intervention humaine, élève passé en coaching.

## Rangs

| Rang | Condition | Calcul |
|---|---|---|
| E | Inscrit, rien commencé | automatique |
| D | Niveau 1 (Les bases) terminé | automatique |
| C | Niveau 2 (Positionnement) terminé | automatique |
| B | Niveau 3 (Lancement) terminé, rôle @Élite | automatique |
| A | 10 000 abonnés | saisi par le coach |
| S | 3 millions de vues | saisi par le coach |
| SS | 500 € générés | saisi par le coach |
| SSS | Plus de 1 000 € générés | saisi par le coach |

## Design

- **Mode sombre, mobile d'abord.** Références : Discord et Whop. Image d'inspiration (un classement) :
  - fond noir pur ;
  - cartes gris anthracite aux coins arrondis, bordures fines grises ;
  - police géométrique (Poppins) : titres blancs en gras, textes secondaires en gris ;
  - onglets soulignés ;
  - touches dorées (couronne).
- Ambiance **RPG** portée par les rangs.
- Logo provisoire : « Creato » en Helvetica gras, lettres serrées (−100 dans Photoshop, soit environ −0,1 em).

## Hébergement et budget

- **10 à 20 $ par mois.** Un seul **serveur Linux (VPS)** qui héberge l'application, PostgreSQL, les fichiers et le worker ffmpeg.
- Domaine chez LWS, pointé vers le serveur. Données hors UE ; mentions légales simples.

## Méthode de travail

- Le porteur de projet n'a jamais codé. Il reçoit des résumés non techniques, des captures et des démos **bloc par bloc**.
- Objectif : une première version utilisable en **2 à 3 jours**.
- Les contenus réels (QCM, critères, fiches) ne sont pas encore prêts : le parcours est créé avec des **contenus provisoires**. Les exercices de pratique n'ont aucun critère prédéfini.
