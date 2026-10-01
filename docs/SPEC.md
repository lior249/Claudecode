# CREATO --- Spécification complète du MVP Learn

## Document de référence pour Cursor / AI coding agent

> **Objectif :** construire de A à Z la première version de Creato, une
> plateforme de suivi et de validation d'apprentissage destinée à un
> programme d'accompagnement à la monétisation TikTok.
>
> **Périmètre actuel :** fonctionnalité **Learn** uniquement.
>
> **Principe produit :** les contenus pédagogiques restent hébergés sur
> Whop. Creato ne remplace pas Whop comme plateforme de formation.
> Creato gère la progression, les quiz, les soumissions, la validation
> par IA, les validations humaines du module de lancement, les données
> produites par l'apprenant et, plus tard, leur exploitation par les
> coachs.

------------------------------------------------------------------------

# 1. Vision du produit

Creato est une plateforme d'accompagnement. La première fonctionnalité à
construire est **Learn**.

L'utilisateur suit une formation hébergée sur Whop, mais son parcours de
progression et les validations sont gérés dans Creato.

Le fonctionnement général est :

1.  L'apprenant se connecte à Creato.
2.  Il voit sa progression Learn.
3.  Il suit le contenu pédagogique sur Whop.
4.  Il revient dans Creato pour réaliser les exercices associés.
5.  Les exercices sont strictement séquentiels.
6.  Une leçon validée débloque la suivante.
7.  Toutes les leçons d'un module validées débloquent le module suivant.
8.  Pour le MVP, l'accès au module suivant sur Whop se fait via un
    **lien Whop configuré manuellement** dans Creato.
9.  À terme, une intégration API Whop pourra automatiser cette étape,
    mais elle n'est PAS nécessaire pour le MVP.
10. Une fois le parcours Learn terminé, l'utilisateur est éligible au
    coaching.
11. Le futur coach pourra consulter un dossier synthétique contenant les
    résultats, décisions et réalisations de l'apprenant.

------------------------------------------------------------------------

# 2. Périmètre MVP

## À construire maintenant

-   Authentification sécurisée liée à Discord.
-   Rôle Admin.
-   Rôle Apprenant.
-   Rôle Agent IA.
-   Tableau de bord apprenant.
-   Vue de progression Learn.
-   Gestion des modules.
-   Gestion des leçons.
-   Trois types de leçons :
    -   Compréhension
    -   Entraînement
    -   Décision
-   QCM de 20 questions pour les leçons Compréhension.
-   Soumissions de fichiers pour les leçons Entraînement.
-   Entraînement noté ou non noté.
-   Validation IA pour les exercices notés.
-   Validation de présence/complétude pour les exercices non notés.
-   Formulaires structurés pour les décisions.
-   Validation humaine des exercices du module de lancement uniquement.
-   Dashboard Admin avec file des validations humaines.
-   Historique des tentatives.
-   Conservation des 5 dernières réalisations physiques par exercice.
-   Quota de stockage temporaire.
-   Suppression automatique des fichiers vidéo/audio après validation du
    module.
-   Conservation des métadonnées.
-   Conservation des images et liens lorsque nécessaire au dossier
    apprenant.
-   Compression vidéo pour prévisualisation future du coach.
-   Déverrouillage séquentiel.
-   Liens Whop configurables par module.
-   Page de fin de Learn.
-   Préparation des données pour le futur espace Coach.

## À NE PAS construire dans ce MVP

-   Chat IA.
-   Coach intégré.
-   Base de données de niches.
-   Suivi automatique TikTok.
-   API TikTok.
-   Automatisation Whop.
-   Discord comme espace de coaching.
-   Analytics avancées.
-   CRM complet.
-   Marketplace.
-   Paiement.
-   Système de recommandation.
-   Génération automatique de contenu.

L'architecture doit toutefois permettre d'ajouter ces fonctionnalités
plus tard sans refonte majeure.

------------------------------------------------------------------------

# 3. Terminologie officielle

Utiliser les termes français suivants dans l'interface :

-   **Module**
-   **Leçon**
-   **Compréhension**
-   **Entraînement**
-   **Décision**
-   **Soumission**
-   **Validation**
-   **Tentative**
-   **Progression**
-   **Critères de validation**

Les types internes peuvent être :

``` text
UNDERSTANDING
PRACTICING
DECISION
```

Mais l'interface utilisateur doit afficher :

``` text
Compréhension
Entraînement
Décision
```

------------------------------------------------------------------------

# 4. Règle fondamentale de progression

Le parcours est **strictement linéaire**.

Le type d'une leçon n'a aucune influence sur l'ordre.

Exemple :

``` text
Module 1
  Leçon 1 — Compréhension
  Leçon 2 — Entraînement
  Leçon 3 — Décision
  Leçon 4 — Entraînement
```

L'ordre est uniquement déterminé par la position de la leçon dans le
module.

La progression globale est :

``` text
Module 1 / Leçon 1
        ↓
Module 1 / Leçon 2
        ↓
Module 1 / Leçon 3
        ↓
...
        ↓
Dernière leçon du Module 1
        ↓
Module 1 terminé
        ↓
Module 2 débloqué
        ↓
...
```

Une seule leçon active à la fois.

Toutes les leçons précédentes sont accessibles en consultation.

Toutes les leçons futures restent verrouillées.

------------------------------------------------------------------------

# 5. Les trois types de leçons

## 5.1 Compréhension

Une leçon Compréhension est un QCM.

Configuration Admin :

-   titre ;
-   résumé/instructions ;
-   20 questions exactement ;
-   4 réponses par question exactement ;
-   une bonne réponse ;
-   explication facultative.

Une question possède :

``` text
question
answer_a
answer_b
answer_c
answer_d
correct_answer
explanation (optionnelle)
```

Le score est calculé sur 20.

Seuil :

``` text
16/20 minimum
```

Ce qui correspond à :

``` text
8/10
```

Règle :

``` text
score >= 16/20 → validé
score < 16/20 → non validé
```

Après échec, l'apprenant doit refaire le QCM.

Le nombre de tentatives doit être conservé.

Les résultats de chaque tentative doivent être historisés dans la base
de données.

Le score officiel de la leçon est le meilleur score obtenu.

------------------------------------------------------------------------

# 6. 5.2 Entraînement

Une leçon Entraînement demande à l'apprenant de produire une
réalisation.

Formats possibles :

-   vidéo ;
-   audio ;
-   texte ;
-   images ;
-   éventuellement plusieurs fichiers dans une même soumission.

Limite :

`text 200 MB maximum par fichier`

Pour vidéo et audio :

`text 2 minutes 30 maximum`

Formats de fichiers à accepter au minimum :

### Vidéo

-   MP4
-   MOV
-   WebM si techniquement pertinent

### Audio

-   MP3
-   WAV
-   M4A

### Images

-   JPG/JPEG
-   PNG
-   WebP

### Texte

-   texte directement saisi dans l'interface

L'architecture doit être extensible à d'autres formats.

------------------------------------------------------------------------

# 7. Entraînement noté / non noté

L'admin doit pouvoir configurer une leçon Entraînement avec :

``` text
is_scored = true
```

ou :

``` text
is_scored = false
```

## Entraînement noté

Configuration :

``` text
Type : Entraînement
Noté : Oui
Mode de validation : IA
Score minimum : 8/10
```

Pour le MVP, les exercices notés sont validés automatiquement par l'IA.

Le score est sur 10.

``` text
score >= 8 → validé
score < 8 → non validé
```

## Entraînement non noté

Il s'agit principalement du module de lancement.

Le but n'est pas de juger subjectivement la qualité de la réalisation.

Le système vérifie que les éléments requis ont été soumis.

La leçon est ensuite considérée comme complète selon la logique
configurée.

------------------------------------------------------------------------

# 8. Critères des exercices notés

Les critères seront définis manuellement par l'Admin.

Les critères doivent être **objectifs et vérifiables**, pas subjectifs.

Éviter des critères comme :

> « Le hook est-il suffisamment intéressant ? »

Préférer :

> « La vidéo contient-elle un hook dans les 3 premières secondes ? »

ou :

> « La vidéo dure-t-elle au minimum 30 secondes ? »

ou :

> « Le CTA demandé apparaît-il explicitement ? »

Le système doit permettre plusieurs critères.

Structure recommandée :

``` text
criterion:
  name
  description
  weight
  required
```

Exemple :

``` text
Hook présent — 30 %
Durée correcte — 20 %
CTA présent — 30 %
Structure demandée respectée — 20 %
```

L'IA reçoit :

1.  la consigne de la leçon ;
2.  les critères ;
3.  la réalisation ;
4.  les contraintes techniques.

Elle doit retourner une analyse structurée.

Ne jamais demander à l'IA de simplement « donner une note » sans
contexte.

------------------------------------------------------------------------

# 9. Pipeline IA

Le fournisseur IA prévu pour l'analyse multimédia est **Gemini API**,
notamment pour l'analyse de vidéos et d'audios.

Pipeline recommandé :

``` text
Soumission
   ↓
Validation technique
   ↓
Stockage temporaire
   ↓
Préparation média
   ↓
Gemini
   ↓
Analyse des critères
   ↓
Résultat structuré
   ↓
Calcul du score
   ↓
Validation ou refus
```

Le système doit enregistrer :

-   modèle utilisé ;
-   date ;
-   statut de traitement ;
-   score ;
-   critères ;
-   justification ;
-   feedback ;
-   éventuelles erreurs.

Prévoir une architecture permettant plus tard d'utiliser un second agent
IA comme contrôleur, mais **ne pas le rendre obligatoire dans le MVP**.

------------------------------------------------------------------------

# 10. Soumissions répétées

Lorsqu'une réalisation est refusée :

``` text
Nouvelle soumission disponible
```

L'apprenant ne peut pas considérer la même réalisation comme une
nouvelle tentative.

Pour les fichiers identiques, calculer un hash cryptographique du
fichier.

Si le hash correspond exactement à une soumission précédente :

``` text
Cette réalisation semble identique à votre précédente soumission.
Veuillez envoyer une nouvelle réalisation.
```

Le système doit cependant permettre une nouvelle version réellement
différente.

------------------------------------------------------------------------

# 11. Conservation des tentatives

Conserver :

-   nombre total de tentatives ;
-   meilleure note ;
-   scores ;
-   feedback ;
-   dates ;
-   statut.

Mais ne conserver physiquement que les **5 dernières réalisations** par
exercice.

Exemple :

``` text
Tentatives totales : 17

Assets physiques :
13
14
15
16
17
```

Les tentatives 1 à 12 peuvent être supprimées physiquement tout en
conservant leurs métadonnées statistiques.

------------------------------------------------------------------------

# 12. Modification après soumission

Une soumission peut être modifiée lorsqu'elle est incomplète ou refusée.

L'utilisateur doit pouvoir corriger les éléments demandés et renvoyer
une nouvelle réalisation.

Une nouvelle soumission crée une nouvelle tentative.

Ne jamais écraser silencieusement une ancienne tentative dans la base.

------------------------------------------------------------------------

# 13. Type Décision

Une leçon Décision sert à collecter des informations structurées sur les
choix de l'apprenant.

Elle n'a pas de note.

Elle peut néanmoins avoir des critères de complétude.

## Exemple 1 --- Choix de niche

Champs :

``` text
niche
niche_justification

competitor_1_account_screenshot
competitor_1_video

competitor_2_account_screenshot
competitor_2_video

competitor_3_account_screenshot
competitor_3_video
```

La validation vérifie que :

-   une niche est renseignée ;
-   une justification est renseignée ;
-   3 concurrents sont renseignés ;
-   3 captures sont présentes ;
-   3 vidéos sont présentes ;
-   les comptes sont distincts ;
-   les éléments sont suffisamment cohérents.

Pour le moment, la base de données des niches est hors périmètre.

## Exemple 2 --- Pays cible

Champs :

``` text
target_country
target_country_justification
```

## Exemple 3 --- Type de contenu

Choix :

``` text
COMMENTARY
ENHANCED_REPOST
```

Ces décisions sont stockées dans le profil Learn de l'apprenant.

Le but est de permettre au futur coach de comprendre immédiatement le
positionnement de départ.

------------------------------------------------------------------------

# 14. Différence entre validation et données

Ne jamais mélanger :

### Validation

``` text
lesson_progress
completed
validated_at
score
```

### Données produites

``` text
niche
country
content_type
links
screenshots
submissions
feedback
```

Une validation obtenue reste acquise.

Même si l'Admin modifie ensuite la leçon, ses critères ou son contenu.

Les données historiques ne doivent pas être recalculées rétroactivement.

------------------------------------------------------------------------

# 15. Module de lancement

Le module de lancement est spécial.

Il contient des réalisations concrètes nécessaires avant l'accès au
coaching.

Exemples :

### Mise en place du compte

-   capture du compte ;
-   lien du compte.

### Publications

Actuellement, prévoir **5 réalisations vidéo** pour la phase finale.

Ces vidéos sont destinées à être vérifiées avant l'entrée en coaching.

Le nombre et les paramètres doivent rester configurables dans l'Admin.

------------------------------------------------------------------------

# 16. Validation humaine

La validation humaine est autorisée **uniquement dans le module de
lancement pour le MVP**.

L'Admin doit pouvoir définir :

``` text
validation_mode = HUMAN
```

pour les exercices concernés du module de lancement.

Lorsqu'une soumission humaine arrive :

``` text
Apprenant soumet
       ↓
Statut : EN ATTENTE DE VALIDATION
       ↓
Notification / élément dans Dashboard Admin
       ↓
Admin ouvre la soumission
       ↓
Admin regarde le contenu
       ↓
Approuver ou refuser
```

Le futur rôle Coach remplacera progressivement l'Admin pour cette
fonction.

------------------------------------------------------------------------

# 17. Dashboard Admin --- file de validation

Créer une section :

``` text
Validations en attente
```

Chaque entrée doit afficher :

-   nom de l'apprenant ;
-   leçon ;
-   module ;
-   date de soumission ;
-   type ;
-   statut.

Exemple :

``` text
Florian
Module 3 — Vidéo 2
Soumise il y a 12 min
[ Voir ]
```

La page de détail doit permettre :

-   prévisualisation ;
-   lecture vidéo ;
-   téléchargement ;
-   visualisation des images ;
-   lecture audio ;
-   lecture du texte ;
-   approbation ;
-   refus ;
-   commentaire administratif.

Lors d'un refus, le commentaire doit pouvoir expliquer ce qui doit être
corrigé.

------------------------------------------------------------------------

# 18. Fin du module

Un module est considéré comme terminé uniquement lorsque **toutes ses
leçons sont validées**.

Exemple :

``` text
Module 1

Leçon 1 ✓
Leçon 2 ✓
Leçon 3 ✓
Leçon 4 ✓

→ Module terminé
```

Le système doit alors :

1.  enregistrer la complétion ;
2.  débloquer le module suivant ;
3.  afficher le message de déblocage ;
4.  afficher le bouton Whop correspondant.

------------------------------------------------------------------------

# 19. Architecture Whop --- MVP

Utiliser pour le moment l'architecture B.

Chaque module possède un lien Whop configuré manuellement.

Exemple :

``` text
module_1.whop_url
module_2.whop_url
module_3.whop_url
```

Lorsque le module est débloqué :

``` text
Vous avez débloqué le Module 2.

[ Accéder au Module 2 ]
```

Le bouton redirige vers le lien Whop configuré.

Aucune automatisation Whop n'est nécessaire dans le MVP.

Prévoir cependant un champ de configuration permettant plus tard de
remplacer ce mécanisme par une intégration API sans modifier le modèle
de progression.

------------------------------------------------------------------------

# 20. Stockage des assets

Le stockage doit être conçu comme du stockage temporaire, pas comme une
bibliothèque vidéo permanente.

## Quota temporaire

Prévoir un quota d'environ :

``` text
500 MB maximum
```

pour les assets en attente / en cours de validation par apprenant.

Lorsque le quota est atteint, les anciens fichiers lourds peuvent être
supprimés selon la politique de rétention.

## Après validation du module

Lorsque le module est entièrement validé :

Supprimer les fichiers volumineux qui ne sont plus nécessaires.

À conserver :

-   métadonnées ;
-   scores ;
-   notes ;
-   feedbacks ;
-   liens ;
-   informations structurées ;
-   images nécessaires au dossier ;
-   captures d'écran nécessaires.

À supprimer :

-   vidéos ;
-   fichiers audio ;
-   autres gros médias temporaires devenus inutiles.

La règle exacte de rétention doit être implémentée dans un service
dédié.

Ne jamais supprimer les données de progression ou les métadonnées.

------------------------------------------------------------------------

# 21. Compression vidéo

Pour les vidéos destinées à une future consultation humaine :

Conserver si nécessaire :

1.  l'original temporairement ;
2.  une version optimisée pour lecture.

La version de consultation peut être transcodée en :

``` text
720p
H.264
AAC
MP4
```

avec un bitrate raisonnable.

Le but est :

-   lecture rapide ;
-   faible consommation de stockage ;
-   qualité suffisante pour vérifier la réalisation.

La vidéo originale peut ensuite être supprimée selon la politique de
stockage.

Ne pas faire du transcodage synchrone dans la requête HTTP. Utiliser un
job asynchrone.

------------------------------------------------------------------------

# 22. Interface apprenant

La plateforme doit être simple.

Pas de chat IA dans le MVP.

La page principale est une **page de progression Learn**.

Structure :

``` text
Learn

Progression globale : 42 %

────────────────────

Module 1
✓ Terminé

Module 2
En cours

  Leçon 1 ✓
  Leçon 2 ✓
  Leçon 3 ●
  Leçon 4 🔒

Module 3
🔒
```

Les modules verrouillés apparaissent visuellement atténués.

Afficher uniquement les **3 modules suivants** lorsqu'ils sont encore
verrouillés.

Ils doivent être progressivement plus discrets visuellement vers le bas.

L'expérience doit donner l'impression d'une progression verticale.

------------------------------------------------------------------------

# 23. Direction visuelle

S'inspirer du système dessiné dans les notes fournies.

Types :

### Compréhension

Badge circulaire jaune :

``` text
U
```

### Entraînement

Badge circulaire rouge :

``` text
P
```

### Décision

Badge circulaire distinct :

``` text
D
```

Le design doit rester moderne, minimal et orienté SaaS.

Ne pas transformer l'interface en plateforme de formation lourde.

------------------------------------------------------------------------

# 24. Fenêtre de leçon

Cliquer sur une leçon ouvre une fenêtre/modal ou panneau déroulant.

Afficher :

``` text
Titre
Type
Résumé / consigne

Critères de validation

Statut actuel

Bouton d'action
```

Pour Compréhension :

``` text
[ Commencer le QCM ]
```

Pour Entraînement :

``` text
[ Soumettre ma réalisation ]
```

Pour Décision :

``` text
[ Compléter ma décision ]
```

Une leçon verrouillée ne doit pas pouvoir être lancée.

------------------------------------------------------------------------

# 25. Upload

Créer un composant d'upload réutilisable.

Fonctions :

-   drag & drop ;
-   sélection de fichier ;
-   barre de progression ;
-   validation taille ;
-   validation format ;
-   validation durée pour vidéo/audio ;
-   prévisualisation ;
-   suppression avant soumission ;
-   message d'erreur clair.

Ne pas envoyer directement un fichier de 200 MB via une requête serveur
classique si le stockage choisi permet l'upload direct.

Préférer :

``` text
Client
 ↓
URL signée
 ↓
Object storage
 ↓
Backend confirme l'asset
```

------------------------------------------------------------------------

# 26. Authentification Discord

Le Discord ID est un identifiant central du compte.

Ne jamais permettre :

``` text
"Je tape simplement le Discord ID de quelqu'un"
```

pour se connecter.

L'identité Discord doit être vérifiée.

Flow recommandé :

``` text
Connexion
   ↓
Authentification Discord OAuth2
   ↓
Discord retourne l'identité vérifiée
   ↓
Récupération discord_user_id
   ↓
Création / association du compte Creato
```

Pour respecter le souhait d'un code Discord supplémentaire, prévoir
ensuite :

``` text
Discord vérifié
      ↓
Bot Discord envoie un code temporaire
      ↓
Utilisateur saisit le code
      ↓
Code valide 5 minutes
      ↓
Session créée
```

Le code doit :

-   être aléatoire ;
-   être à usage unique ;
-   expirer après 5 minutes ;
-   être stocké sous forme de hash ;
-   être limité en nombre d'essais ;
-   être invalidé après utilisation.

Ne jamais stocker le code en clair.

Un mot de passe peut être ajouté comme mécanisme complémentaire, mais il
ne doit pas remplacer la vérification d'identité Discord.

------------------------------------------------------------------------

# 27. Sécurité

Principes obligatoires :

-   mots de passe hashés avec Argon2id ou bcrypt ;
-   sessions sécurisées ;
-   cookies HttpOnly ;
-   Secure en production ;
-   SameSite approprié ;
-   CSRF protection si nécessaire ;
-   rate limiting ;
-   validation serveur de toutes les données ;
-   validation serveur des permissions ;
-   jamais faire confiance au rôle envoyé par le frontend ;
-   URLs de fichiers privées ;
-   URLs signées temporaires ;
-   antivirus / validation MIME si disponible ;
-   limites de taille côté serveur ;
-   logs d'audit pour actions Admin ;
-   secrets uniquement dans variables d'environnement.

Les permissions doivent être vérifiées côté backend pour chaque
ressource.

Un apprenant ne doit jamais pouvoir accéder à la soumission d'un autre
apprenant en modifiant un ID dans une URL.

------------------------------------------------------------------------

# 28. Rôles

MVP :

``` text
ADMIN
LEARNER
AI_AGENT
```

Prévoir le rôle futur :

``` text
COACH
```

Même si le dashboard Coach n'est pas construit maintenant.

L'architecture RBAC doit être extensible.

------------------------------------------------------------------------

# 29. Future vue Coach

Ne pas construire maintenant, mais les données doivent permettre cette
expérience :

Deux vues :

### Liste par progression

``` text
Nom
Progression Learn
Statut
```

Tri par progression.

### Liste alphabétique

``` text
Nom
Progression
Statut
```

Tri A → Z.

Cliquer sur un apprenant ouvre une fenêtre détaillée.

------------------------------------------------------------------------

# 30. Future fiche Coach

La fiche devra afficher :

``` text
Nom de l'apprenant

Progression Learn
XX %

────────────────

Module 1
Statut
Score général

Leçons
Leçon 1 — Compréhension — 18/20
Leçon 2 — Entraînement — 9/10
...

────────────────

Décisions

Niche
...

Justification
...

Concurrents
...

Pays cible
...

Justification
...

Type de contenu
...

────────────────

Lancement

Compte
Lien

Vidéo 1
Validée / En attente

Vidéo 2
...

────────────────

Historique
...
```

Cette fiche est une sortie majeure des données Learn.

------------------------------------------------------------------------

# 31. Modèle de données recommandé

Utiliser PostgreSQL.

Tables principales :

## users

``` text
id
email
password_hash nullable
discord_user_id unique
discord_username
display_name
role
status
created_at
updated_at
```

## modules

``` text
id
title
description
position
is_published
whop_url
created_at
updated_at
```

## lessons

``` text
id
module_id
title
description
type
position
is_published
is_scored
validation_mode
score_threshold
created_at
updated_at
```

Contraintes :

``` text
type = UNDERSTANDING | PRACTICING | DECISION

validation_mode =
AI | HUMAN | COMPLETION
```

Mais pour le MVP, HUMAN doit être autorisé uniquement pour le module de
lancement.

## quiz_questions

``` text
id
lesson_id
position
question
answer_a
answer_b
answer_c
answer_d
correct_answer
explanation
```

## quiz_attempts

``` text
id
lesson_id
user_id
score
total_questions
percentage
passed
started_at
completed_at
```

## quiz_answers

``` text
id
attempt_id
question_id
selected_answer
is_correct
```

## lesson_progress

``` text
id
user_id
lesson_id
status
best_score
attempt_count
completed_at
validated_at
created_at
updated_at
```

Statuts :

``` text
LOCKED
AVAILABLE
IN_PROGRESS
SUBMITTED
PENDING_REVIEW
FAILED
COMPLETED
```

## submissions

``` text
id
user_id
lesson_id
attempt_number
status
score
is_best
validation_mode
feedback
ai_analysis
submitted_at
reviewed_at
reviewed_by
```

## submission_assets

``` text
id
submission_id
storage_key
original_filename
mime_type
size_bytes
duration_seconds
width
height
hash
asset_type
compressed_storage_key nullable
created_at
deleted_at nullable
```

## decision_responses

``` text
id
user_id
lesson_id
data_json
status
submitted_at
validated_at
```

Le champ `data_json` permet de supporter plusieurs formulaires de
décision sans créer une table pour chaque décision.

------------------------------------------------------------------------

# 32. Audit

Créer une table d'audit :

``` text
audit_logs

id
actor_user_id
action
entity_type
entity_id
metadata_json
created_at
```

Exemples :

``` text
USER_LOGIN
LESSON_COMPLETED
QUIZ_SUBMITTED
SUBMISSION_CREATED
SUBMISSION_REJECTED
SUBMISSION_APPROVED
MODULE_COMPLETED
WHOP_LINK_OPENED
ASSET_DELETED
```

------------------------------------------------------------------------

# 33. Architecture logicielle

Recommandation :

``` text
Next.js
TypeScript
PostgreSQL
Prisma
Tailwind CSS
shadcn/ui
Object Storage compatible S3
Gemini API
Discord OAuth2
Discord Bot
```

Le backend doit être structuré par domaines :

``` text
auth/
users/
learn/
modules/
lessons/
quizzes/
submissions/
decisions/
ai/
storage/
admin/
notifications/
whop/
```

Éviter de mettre toute la logique dans les composants React.

------------------------------------------------------------------------

# 34. Jobs asynchrones

Prévoir une file de jobs pour :

-   analyse Gemini ;
-   transcodage vidéo ;
-   génération de miniature ;
-   suppression d'anciens assets ;
-   nettoyage du stockage ;
-   notifications.

Ne pas exécuter une analyse vidéo longue directement dans une requête
utilisateur.

------------------------------------------------------------------------

# 35. Service de stockage

Créer une abstraction :

``` text
StorageService
```

avec :

``` text
upload()
getSignedUrl()
delete()
exists()
getMetadata()
```

Cela permet de changer de fournisseur plus tard.

Ne jamais stocker les fichiers binaires directement dans PostgreSQL.

------------------------------------------------------------------------

# 36. Service IA

Créer une abstraction :

``` text
AIValidationService
```

Interface conceptuelle :

``` text
analyzeSubmission({
  lesson,
  criteria,
  submissionAssets
})
```

Retour :

``` text
{
  score: 8.7,
  passed: true,
  criteria: [
    {
      criterionId,
      score,
      passed,
      evidence
    }
  ],
  feedback,
  rawAnalysis
}
```

La logique de passage doit être déterministe :

``` text
passed = score >= lesson.score_threshold
```

Ne pas laisser le modèle décider seul du statut final.

------------------------------------------------------------------------

# 37. Gemini

L'intégration Gemini doit être isolée.

Variables d'environnement :

``` text
GEMINI_API_KEY=
GEMINI_MODEL=
```

Le modèle exact doit être configurable.

Ne jamais écrire la clé dans le code.

------------------------------------------------------------------------

# 38. Notifications Admin

Lorsqu'une soumission nécessitant une validation humaine est créée :

Créer une notification interne.

Exemple :

``` text
Nouvelle soumission

Florian a soumis :
Module 3 — Vidéo 4

[ Examiner ]
```

Prévoir plus tard :

-   email ;
-   Discord ;
-   push.

Mais le MVP peut fonctionner avec une notification dans le dashboard
Admin.

------------------------------------------------------------------------

# 39. Admin --- gestion des modules

L'Admin doit pouvoir :

-   créer un module ;
-   modifier un module ;
-   publier/dépublier ;
-   définir son ordre ;
-   renseigner son lien Whop ;
-   voir son nombre de leçons ;
-   voir le nombre d'apprenants en cours ;
-   marquer un module comme module de lancement.

------------------------------------------------------------------------

# 40. Admin --- gestion des leçons

L'Admin doit pouvoir :

-   créer ;
-   modifier ;
-   supprimer ;
-   réordonner ;
-   publier/dépublier.

Champs généraux :

``` text
Titre
Résumé
Type
Position
```

Pour Compréhension :

``` text
20 questions
```

Pour Entraînement :

``` text
Formats acceptés
Noté ?
Mode de validation
Critères
Seuil
```

Pour Décision :

``` text
Champs du formulaire
Critères de complétude
```

------------------------------------------------------------------------

# 41. Versioning des leçons

Important :

Ne jamais casser l'historique d'un apprenant lorsqu'une leçon est
modifiée.

Une validation passée doit rester valide.

Pour les changements importants, prévoir à terme :

``` text
lesson_versions
```

Une leçon peut avoir plusieurs versions.

Le progrès d'un apprenant doit pointer vers la version qu'il a
effectivement suivie.

Le MVP peut commencer sans interface de versioning complète, mais le
modèle doit éviter les mises à jour destructives.

------------------------------------------------------------------------

# 42. Règles de suppression

Les suppressions physiques d'assets doivent être séparées des
suppressions de données métier.

Exemple :

``` text
delete asset file
≠
delete submission
```

Une vidéo peut être supprimée du stockage tout en laissant :

``` text
submission
score
feedback
timestamp
metadata
```

en base.

------------------------------------------------------------------------

# 43. Fin du Learn

Lorsque la dernière leçon du dernier module est validée :

``` text
learn_completed = true
learn_completed_at = timestamp
coaching_unlocked = true
```

Afficher :

``` text
Félicitations.

Vous avez terminé votre parcours Learn.

Votre accès au coaching est maintenant débloqué.
```

Dans le MVP, le coaching peut simplement être marqué comme débloqué sans
construire l'espace Coach.

------------------------------------------------------------------------

# 44. Résumé apprenant

Le système doit pouvoir calculer :

``` text
progress_percentage
modules_completed
lessons_completed
total_lessons
best_scores
decisions
launch_status
```

La progression doit être basée sur le nombre de leçons validées :

``` text
progress =
validated_lessons / total_lessons
```

Ne pas utiliser le score moyen pour calculer la progression.

------------------------------------------------------------------------

# 45. Gestion des modules verrouillés

Un module devient disponible uniquement si :

``` text
previous_module.completed = true
```

Une leçon devient disponible uniquement si :

``` text
previous_lesson.completed = true
```

Le backend doit appliquer cette règle.

Le frontend ne doit pas être la seule protection.

------------------------------------------------------------------------

# 46. Cas limites à gérer

Le système doit gérer :

-   utilisateur qui recharge la page pendant un upload ;
-   upload interrompu ;
-   fichier trop gros ;
-   format non accepté ;
-   vidéo trop longue ;
-   audio trop long ;
-   analyse IA échouée ;
-   timeout Gemini ;
-   double soumission ;
-   même fichier soumis deux fois ;
-   Admin qui refuse une soumission ;
-   Admin qui approuve une soumission ;
-   utilisateur qui ferme le navigateur pendant un quiz ;
-   tentative de quiz incomplète ;
-   suppression d'un module contenant des progrès ;
-   modification d'une leçon déjà complétée ;
-   module Whop sans URL ;
-   stockage temporaire saturé.

------------------------------------------------------------------------

# 47. UX des erreurs

Ne jamais afficher une erreur technique brute.

Exemple :

Mauvais :

``` text
S3 PutObject Error 403
```

Bon :

``` text
Impossible d'envoyer votre fichier pour le moment.
Veuillez réessayer.
```

Les détails techniques restent dans les logs.

------------------------------------------------------------------------

# 48. Design responsive

La plateforme doit fonctionner :

-   desktop ;
-   tablette ;
-   mobile.

La priorité est toutefois l'utilisation desktop/mobile moderne.

Les uploads vidéo doivent être utilisables depuis mobile.

------------------------------------------------------------------------

# 49. Architecture future

Préparer les extensions suivantes sans les développer :

## Coach

``` text
coach
  ↓
students
  ↓
student Learn summary
  ↓
review / feedback
```

## TikTok

``` text
TikTok account
  ↓
posts
  ↓
frequency
  ↓
analytics
```

## Whop

``` text
Creato
  ↓
Whop API
  ↓
automated access
```

## Niche database

``` text
niches
  ↓
categories
  ↓
examples
  ↓
competitors
```

------------------------------------------------------------------------

# 50. Principe architectural majeur

Ne jamais coder les règles métier directement dans l'interface.

Par exemple, ne pas faire uniquement :

``` typescript
if (score >= 8) unlockNext()
```

dans React.

La logique doit être dans le backend/service métier :

``` text
ValidationService
ProgressionService
ModuleCompletionService
```

Le frontend demande :

``` text
submit lesson
```

Le backend :

1.  valide ;
2.  enregistre ;
3.  calcule ;
4.  met à jour la progression ;
5.  débloque la suite ;
6.  génère les événements nécessaires.

------------------------------------------------------------------------

# 51. API conceptuelle

Prévoir des endpoints ou server actions équivalents à :

``` text
POST /api/auth/discord/start
POST /api/auth/discord/verify

GET /api/learn/progress

GET /api/modules
GET /api/modules/:id
GET /api/lessons/:id

POST /api/lessons/:id/quiz/start
POST /api/lessons/:id/quiz/submit

POST /api/lessons/:id/submissions
POST /api/submissions/:id/retry

POST /api/lessons/:id/decision

GET /api/admin/reviews
GET /api/admin/reviews/:id
POST /api/admin/reviews/:id/approve
POST /api/admin/reviews/:id/reject

POST /api/admin/modules
PATCH /api/admin/modules/:id

POST /api/admin/lessons
PATCH /api/admin/lessons/:id
```

Les noms exacts peuvent être adaptés au framework.

------------------------------------------------------------------------

# 52. Dashboard Admin

Le MVP Admin doit comporter :

``` text
Dashboard
│
├── Vue d'ensemble
│
├── Validations
│
├── Apprenants
│
├── Modules
│
├── Leçons
│
└── Paramètres
```

Dashboard :

-   apprenants actifs ;
-   progression moyenne ;
-   validations en attente ;
-   modules terminés ;
-   soumissions récentes.

------------------------------------------------------------------------

# 53. Dashboard apprenant

Navigation minimale :

``` text
Learn
Progression
Compte
Déconnexion
```

Pas de chat.

Pas de coaching.

Pas d'analytics complexes.

------------------------------------------------------------------------

# 54. Compte utilisateur

Afficher :

-   nom ;
-   Discord lié ;
-   statut ;
-   progression ;
-   éventuellement date d'inscription.

Ne jamais afficher publiquement le Discord ID technique.

------------------------------------------------------------------------

# 55. Données de profil Learn

Le profil Learn doit pouvoir produire un résumé exploitable.

Exemple :

``` json
{
  "progress": 100,
  "modulesCompleted": 3,
  "decisions": {
    "niche": "...",
    "targetCountry": "...",
    "contentType": "COMMENTARY"
  },
  "scores": {
    "module1": {
      "average": 9.1
    }
  },
  "launch": {
    "submitted": 5,
    "approved": 5
  },
  "coachingUnlocked": true
}
```

Ne pas stocker nécessairement ce JSON comme source de vérité.

Le produire depuis les données relationnelles.

------------------------------------------------------------------------

# 56. Source de vérité

La base PostgreSQL est la source de vérité.

Le stockage de fichiers est uniquement la source des assets.

Whop est la source de vérité pour le contenu pédagogique externe.

Creato est la source de vérité pour :

-   progression ;
-   validation ;
-   scores ;
-   décisions ;
-   soumissions ;
-   statut Learn.

------------------------------------------------------------------------

# 57. Déploiement

Le projet doit être prêt pour un déploiement production.

Stack recommandée :

``` text
Frontend/backend : Next.js
Database : PostgreSQL
ORM : Prisma
Storage : S3-compatible
AI : Gemini
Auth : Discord OAuth2 + vérification bot
Hosting : Vercel ou équivalent
Database hosting : Supabase / Neon / PostgreSQL managé
```

Le choix exact du fournisseur peut être modifié.

Ne pas coupler le code métier à un fournisseur particulier.

------------------------------------------------------------------------

# 58. Variables d'environnement

Prévoir au minimum :

``` text
DATABASE_URL=

NEXT_PUBLIC_APP_URL=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=

GEMINI_API_KEY=
GEMINI_MODEL=

STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

SESSION_SECRET=
```

Ajouter les autres secrets nécessaires au fournisseur choisi.

Ne jamais committer `.env`.

Créer :

``` text
.env.example
```

sans secrets réels.

------------------------------------------------------------------------

# 59. Tests

Créer des tests pour les règles métier critiques.

Minimum :

### Progression

-   première leçon disponible ;
-   deuxième verrouillée ;
-   première validation débloque deuxième ;
-   fin de module débloque module suivant.

### QCM

-   16/20 = réussite ;
-   15/20 = échec ;
-   20/20 = réussite.

### Entraînement

-   8/10 = réussite ;
-   7.9/10 = échec ;
-   meilleure note conservée ;
-   tentatives comptées.

### Décision

-   formulaire complet = validé ;
-   champ obligatoire absent = non validé.

### Soumissions

-   fichier identique détecté ;
-   limite 200 MB ;
-   durée vidéo \> 2:30 refusée ;
-   seulement 5 assets physiques conservés.

### Permissions

-   apprenant ne voit pas les données d'un autre ;
-   apprenant ne peut pas approuver ;
-   seul Admin peut valider humainement.

------------------------------------------------------------------------

# 60. Ordre recommandé de développement

Ne pas commencer par Gemini.

Construire dans cet ordre :

## Phase 1 --- Fondations

-   projet ;
-   TypeScript ;
-   UI ;
-   PostgreSQL ;
-   Prisma ;
-   migrations ;
-   authentification ;
-   RBAC.

## Phase 2 --- Learn

-   modules ;
-   leçons ;
-   progression ;
-   verrouillage ;
-   interface apprenant.

## Phase 3 --- Compréhension

-   éditeur QCM ;
-   QCM apprenant ;
-   correction ;
-   scores ;
-   tentatives.

## Phase 4 --- Entraînement

-   upload ;
-   stockage ;
-   soumissions ;
-   historique ;
-   quota ;
-   suppression.

## Phase 5 --- IA

-   intégration Gemini ;
-   critères ;
-   analyse ;
-   score ;
-   feedback ;
-   validation.

## Phase 6 --- Décisions

-   moteur de formulaires ;
-   décisions ;
-   stockage ;
-   validation.

## Phase 7 --- Module lancement

-   exercices non notés ;
-   validation humaine ;
-   dashboard Admin ;
-   approbation/refus.

## Phase 8 --- Whop

-   URL par module ;
-   écran de déblocage ;
-   redirection.

## Phase 9 --- optimisation

-   compression vidéo ;
-   jobs asynchrones ;
-   nettoyage ;
-   monitoring.

## Phase 10 --- production

-   sécurité ;
-   tests ;
-   migrations ;
-   sauvegardes ;
-   logs ;
-   monitoring ;
-   déploiement.

------------------------------------------------------------------------

# 61. Règles à ne jamais violer

1.  Le parcours est strictement linéaire.
2.  Une validation acquise reste acquise.
3.  Le frontend ne décide jamais seul qu'une leçon est validée.
4.  Un apprenant ne peut jamais accéder à la soumission d'un autre.
5.  Les vidéos/audio ne sont pas conservés indéfiniment.
6.  Les métadonnées et résultats doivent survivre à la suppression des
    fichiers.
7.  Les 5 dernières réalisations physiques maximum sont conservées par
    exercice.
8.  Un fichier identique ne doit pas être considéré comme une nouvelle
    réalisation.
9.  U = QCM de 20 questions.
10. U nécessite au minimum 16 bonnes réponses.
11. P peut être noté ou non noté.
12. P noté nécessite 8/10 minimum.
13. D ne possède pas de score.
14. La validation humaine est réservée au module de lancement dans le
    MVP.
15. Whop est externe à Creato.
16. Le contenu pédagogique n'est pas stocké dans Creato.
17. Le coaching n'est pas construit dans ce MVP.
18. Les données doivent toutefois être structurées pour permettre le
    futur coaching.

------------------------------------------------------------------------

# 62. Critère de réussite du MVP

Le MVP est considéré comme terminé lorsque l'Admin peut :

1.  créer un module ;
2.  lui donner un lien Whop ;
3.  créer des leçons ;
4.  choisir leur type ;
5.  les réordonner ;
6.  créer un QCM de 20 questions ;
7.  définir les critères d'un exercice P ;
8.  choisir si P est noté ;
9.  créer une décision ;
10. publier le parcours.

Et lorsqu'un apprenant peut :

1.  créer/relier son compte Discord ;
2.  se connecter de manière sécurisée ;
3.  voir sa progression ;
4.  accéder à la première leçon ;
5.  passer un QCM ;
6.  être bloqué sous 16/20 ;
7.  refaire le QCM ;
8.  être débloqué à partir de 16/20 ;
9.  soumettre une vidéo/audio/image/texte ;
10. recevoir une analyse IA pour un P noté ;
11. refaire une réalisation refusée ;
12. remplir une décision ;
13. terminer un module ;
14. obtenir le bouton Whop du module suivant ;
15. arriver au module de lancement ;
16. soumettre les réalisations ;
17. voir leur statut « en attente » lorsqu'une validation humaine est
    requise ;
18. permettre à l'Admin de les examiner ;
19. permettre à l'Admin de les approuver/refuser ;
20. terminer Learn ;
21. obtenir le statut `coaching_unlocked`.

------------------------------------------------------------------------

# 63. Instruction générale pour l'agent de développement

Construire le projet progressivement et proprement.

Avant chaque grosse implémentation :

1.  vérifier le modèle de données ;
2.  vérifier les règles métier ;
3.  vérifier les permissions ;
4.  vérifier les états possibles ;
5.  vérifier les cas limites ;
6.  écrire les tests correspondants.

Ne pas simplifier silencieusement une règle métier.

Lorsqu'une décision technique est nécessaire, choisir la solution la
plus simple, robuste et extensible.

Ne pas ajouter de fonctionnalités hors périmètre.

Ne pas construire le chat IA.

Ne pas construire le Coach maintenant.

Ne pas construire l'intégration automatique Whop maintenant.

Ne pas construire l'intégration TikTok maintenant.

L'objectif est de produire une première version production-ready de
**Creato Learn**, avec une architecture suffisamment propre pour que les
futures fonctionnalités puissent être ajoutées sans réécrire le cœur de
l'application.
