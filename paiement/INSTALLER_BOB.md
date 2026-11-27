# Installer Bob et les nouvelles offres

Ce guide complète `DEPLOIEMENT.md` (le site tourne déjà sur overmaxx.online).
Ce qui change : l'accès Whop passe par une **offre gratuite en liste d'attente** (fini les codes promo),
l'offre **Elite** est ajoutée, et **Bob** gère Discord (rôles, rappels, expirations, coaching).
Le cahier des charges complet est dans `BOB.md`.

Pour copier des identifiants Discord, active d'abord le **mode développeur** :
Discord → **Paramètres utilisateur** → **Avancés** → **Mode développeur**.

---

## 1. Whop : les offres gratuites en liste d'attente

Dans ton produit Whop, crée **deux nouvelles offres** (tarifs) :

| | Community | Elite |
|---|---|---|
| Prix | **Gratuit** | **Gratuit** |
| Durée d'accès (expiration) | facultatif : le site coupe l'accès lui-même | facultatif |
| Mode de sortie | **Liste d'attente** (waitlist / approbation) | **Liste d'attente** |
| Visibilité | **Cachée** | **Cachée** |
| Question à l'inscription | « Email utilisé pour ton paiement mobile money » (texte, obligatoire) | la même |

Copie l'identifiant `plan_…` de chacune, depuis leur lien `whop.com/checkout/plan_…`. Ils vont dans
`WHOP_COMMUNITY_PLAN_ID` et `WHOP_ELITE_PLAN_ID`.

Les anciennes offres payantes débloquées par code promo ne servent plus.

**Si l'accès Whop n'arrive pas** :
- la page après paiement montre l'email avec un bouton **Copier**, à coller à la question de Whop ;
- dès qu'une demande Whop arrive avec un email inconnu, tu es prévenu (elle est refusée au bout de 48 h) ;
- 1 h puis 24 h après le paiement, Bob relance la personne avec l'email exact et un bouton
  **J'ai donné un autre email à Whop** : elle le corrige elle-même, et la demande est acceptée dans la minute ;
- 48 h après le paiement, si l'accès n'est toujours pas validé, tu es prévenu.

**Membres qui paient directement sur Whop (par carte)** : sur ton offre Elite payante Whop, garde l'application
**Discord** de Whop et choisis le **même rôle Elite** que dans `DISCORD_ROLE_ELITE`, sur le nouveau serveur. Ces membres ont
alors accès à `/coaching` comme les autres. C'est Whop qui gère leur abonnement. Si Whop leur retire le rôle (abonnement
terminé), ou s'ils passent GOAT, Bob libère leurs créneaux dans les 10 minutes et te prévient.

**Paiement par carte après une candidature validée** : le candidat validé a le choix entre **mobile money** et **carte bancaire**
(même prix). Le bouton carte ouvre ton offre Elite **cachée** sur Whop
(`https://whop.com/overmaxx/legroupe-secret-accompagnement-prive/`, déjà réglé ; `LIEN_CARTE_ELITE` pour le changer).
Sur cette offre, l'application **Discord** de Whop doit donner le **rôle Elite** : dès que le candidat l'a, Bob confirme
son intégration, désactive son lien mobile money (pas de double paiement) et te prévient.

## 2. Whop : les autorisations de la clé API

Sur **whop.com/dashboard/developer**, modifie ta clé (ou crée-en une nouvelle) en mode **Personnalisé** :

- **Plans** : Read plans ;
- **Waitlist** (liste d'attente) : lire et gérer, c'est-à-dire accepter ou refuser (`plan:waitlist:read`, `plan:waitlist:manage`) ;
- **Membership** : **Cancel memberships**. À la fin d'un accès non renouvelé, le site coupe lui-même l'accès Whop.
- *(Facultatif)* **Members** : Manage members. Seulement si tes offres ont une durée d'expiration réglée sur Whop.
- **Courses** : lecture des cours et des leçons. Le site lit, toutes les 10 minutes, les leçons terminées par chaque membre
  (colonne « Formation » de la page Membres).
- **Members** et **Memberships** : lecture (à venir, pour relier directement les membres payés par carte).

Les autorisations **Promo codes** ne sont plus nécessaires. Si les noms sont différents, envoie une capture.

## 3. Discord : créer Bob

1. Va sur **discord.com/developers/applications**, clique sur **New Application** et nomme-la **Bob**.
2. Onglet **Bot** :
   - clique sur **Reset Token**, puis copie le jeton → `DISCORD_BOT_TOKEN` ;
   - active **Server Members Intent**, puis enregistre.
3. Onglet **OAuth2** :
   - copie **Client ID** → `DISCORD_CLIENT_ID` ;
   - clique sur **Reset Secret**, puis copie-le → `DISCORD_CLIENT_SECRET` ;
   - dans **Redirects**, ajoute exactement `https://overmaxx.online/discord/callback`, puis enregistre.
4. Invite Bob sur ton serveur. Ouvre ce lien en remplaçant `CLIENT_ID` :
   ```
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=343865822355
   ```
   Ce lien donne à Bob ces droits : voir les salons, envoyer des messages, expulser des membres, gérer les rôles, gérer les salons,
   créer des invitations et voir les logs du serveur.
   Si Bob est déjà invité : **Paramètres du serveur** → **Rôles** → rôle de Bob → active **Gérer les salons**,
   **Créer des fils privés**, **Envoyer des messages dans les fils** et **Voir les logs du serveur**.
   Bob écrit d'abord en **message privé**. Si ça ne passe pas, il ouvre un **fil privé** (visible seulement par la personne
   et les modérateurs) avec le même message et les mêmes boutons : dans #en-attente pour les nouveaux venus,
   sinon dans le premier salon que la personne voit. Le fil est réutilisé pour les messages suivants.
   Si même le fil échoue, Bob te prévient avec la raison (une fois par jour au maximum pour un même membre).

## 4. Discord : rôles et identifiants

1. Crée, si ce n'est pas déjà fait, les rôles **Community**, **Elite**, **GOAT** et **Attente**.
   - **Attente** ne doit voir **qu'un seul salon**, par exemple #attente, où tu expliques pourquoi l'accès est limité.
     Ce rôle sert aux **candidats Elite** pendant l'examen, et aux membres **Community en attente de renouvellement** (15 jours).
     Les autres salons ne doivent pas être visibles pour ce rôle.
2. Dans **Paramètres du serveur** → **Rôles**, **glisse le rôle Bob au-dessus** de ces quatre rôles.
   Sinon, Discord l'empêche de les donner.
3. Copie les identifiants (clic droit → **Copier l'identifiant**) :
   - ton serveur (clic droit sur son icône) → `DISCORD_GUILD_ID` ;
   - toi-même (clic droit sur ton nom) → `DISCORD_ADMIN_ID` ;
   - les quatre rôles → `DISCORD_ROLE_COMMUNITY`, `DISCORD_ROLE_ELITE`, `DISCORD_ROLE_GOAT`, `DISCORD_ROLE_ATTENTE`.
4. Le salon vocal de coaching (limité à 2 personnes) : clic droit → **Copier le lien** → `DISCORD_SALON_COACHING_URL`.

## 5. Candidatures Elite (formulaires maison)

Le parcours : bouton **Postuler à l'Elite** du salon d'attente → **overmaxx.online/coaching/elite** :
vidéo de présentation, puis le **formulaire 1** (une question par écran, façon Tally) → « en cours de traitement, rejoins le Discord »
→ Bob répond en privé sous 24 h → si retenu, Bob envoie le lien du **formulaire 2** (vidéo, 20 Mo maximum)
→ tu regardes sur **overmaxx.online/admin/candidatures** → si validé, Bob envoie le lien de paiement.

- **Les questions** sont dans `paiement/src/formulaires.js` : ajoute ou modifie les blocs, puis relance le site.
  Le formulaire 1 doit garder la question `discord` : c'est grâce à elle que Bob retrouve le candidat sur le serveur.
- La vidéo de présentation (VSL) sur Wistia → `WISTIA_VSL_ELITE`.
- Taille maximale des vidéos des candidats → `VIDEO_MAX_MO` (20 par défaut). Elles sont supprimées dès ta décision.
- Tally n'est plus nécessaire (le webhook `/webhooks/tally` reste accepté si tu l'utilises encore).

## 6. Mettre à jour le serveur

```bash
ssh root@203.161.61.189
```
```bash
cd /opt/overmaxx && git pull
```
```bash
nano /opt/overmaxx/paiement/overmaxx.env
```

**Ajoute** à la fin du fichier les lignes ci-dessous, remplies. Ne touche pas à `APP_SECRET`.
Les anciennes lignes `PRIX_INSCRIPTION`, `PRIX_MENSUEL` et `WHOP_PLAN_ID` peuvent rester : les nouvelles sont prioritaires.

```
PRIX_COMMUNITY_ENTREE=19025
PRIX_COMMUNITY_RENOUVELLEMENT=3280
PRIX_ELITE_ENTREE=327980
PRIX_ELITE_RENOUVELLEMENT=39360
WHOP_COMMUNITY_PLAN_ID=plan_…
WHOP_ELITE_PLAN_ID=plan_…
DISCORD_BOT_TOKEN=…
DISCORD_CLIENT_ID=…
DISCORD_CLIENT_SECRET=…
DISCORD_GUILD_ID=…
DISCORD_ADMIN_ID=…
DISCORD_ROLE_COMMUNITY=…
DISCORD_ROLE_ELITE=…
DISCORD_ROLE_GOAT=…
DISCORD_ROLE_ATTENTE=…
DISCORD_SALON_COACHING_URL=https://discord.com/channels/…
TALLY_FORM_ID=…
TALLY_SIGNING_SECRET=…
WISTIA_VSL_ELITE=…
```

Enregistre avec **Ctrl+O**, puis **Entrée**, puis **Ctrl+X**. Ensuite :
```bash
cd /opt/overmaxx/paiement && ./deploy/overmaxx.sh
```

Dans les dernières lignes affichées, tu dois voir **« Bob : activé · Connexion Discord : activée »** et **« [bob] connecté en tant que Bob#… »**.
Si l'application s'arrête, le message indique le réglage à corriger.

## 7. Publier les boutons de Bob et le lien d'invitation

1. `LIEN_DISCORD` dans `overmaxx.env` doit être un **lien d'invitation permanent** vers le **nouveau** serveur
   (clic droit sur un salon → **Inviter** → **Modifier le lien** : expiration **Jamais**).
2. **Rien à taper** : au démarrage, Bob crée le salon **#en-attente** (ou utilise `DISCORD_SALON_ATTENTE_ID` s'il est rempli),
   le rend visible **uniquement** par En Attente, **cache tous les autres salons et catégories** à En Attente,
   y publie le message ci-dessous, et cachera aussi chaque nouveau salon créé plus tard. Il t'envoie le bilan en privé.
   (`/configurer-attente` permet de le refaire à la main si besoin.)
   Tu peux republier le message à tout moment avec `/publier bouton: Message du salon d'attente` : Bob publie le message
   « Tu es en attente… » avec les boutons **Rejoindre la Community** et **Postuler à l'Elite**.
   Les nouveaux venus « En Attente » **restent sur le serveur sans limite** (ils ne voient que #en-attente).
   À l'arrivée de chacun, dès qu'il a le rôle En Attente, Bob lui envoie **en message privé** la bienvenue
   avec les boutons **Rejoindre la Community** et **Postuler à l'Elite**.
   Option : `ATTENTE_NOUVEAUX_HEURES=24` pour les retirer après 24 h (sauf candidatures en cours et Community en attente).
3. Dans un salon visible par les membres (par exemple #bienvenue), tape `/publier bouton: Se connecter au site`.

Sur téléphone, personne n'a besoin de son mot de passe Discord : Bob envoie des **boutons** qui ouvrent le site déjà connecté
(liens personnels, valables 30 jours, réutilisables).

## Connexion au site (compte Discord obligatoire)

Seule la page d'accueil (**overmaxx.online**) est ouverte à tous : la vidéo de présentation, puis **Rejoindre le Discord**
(bouton blanc), puis « Déjà membre ? » **Se connecter** (pseudo Discord, bouton de Bob, puis l'espace de chacun s'ouvre tout seul :
Mon parcours, À traiter pour le coach, Mes coachings, sa candidature ou son renouvellement). Déjà connecté : **Ouvrir mon espace**.
Toutes les autres pages (Community, paiements, renouvellements, candidature Elite, coaching, admin) demandent le compte Discord :

- **Boutons personnels de Bob** (bienvenue, rappels de renouvellement, candidature, paiement Elite) : ils ouvrent le site
  **déjà connecté**. Rien à taper.
- **Sinon**, la page demande le **pseudo Discord**. Bob envoie sur Discord un bouton **C'est bien moi, continuer** :
  le clic ouvre le site connecté (dans le navigateur qui clique seulement). Limites : 8 demandes par quart d'heure
  et par appareil, 3 boutons par demi-heure pour un même compte.
- La connexion est gardée **30 jours** sur l'appareil.

Chaque paiement est relié au compte Discord connecté : **le rôle est donné tout de suite** après le paiement
(En Attente retiré), sans `/lier`. La page **Membres** affiche le Discord de chacun. `/lier CODE` reste possible
pour les paiements faits avant ce changement.

## Le parcours Elite (livraison 1)

Chaque membre Elite a un parcours (voir `docs/ACCOMPAGNEMENT-ELITE.md`) :

| Côté membre | Côté coach |
|---|---|
| **Mon parcours** (`/parcours`) : son étape, ce qu'il doit faire, le temps qui reste | **À traiter** (`/admin/a-traiter`) : envois à valider, étapes à ouvrir, retards |
| **Étape 1** : exercices L1 et L2 (vidéo, note et retour de l'IA) | **Valider un envoi** : la vidéo, tes remarques, Valider (étape 1) ou Demander des modifications / Valider (étape 3) |
| **Étape 2** : réserver le coaching d'entrée (un seul, à son heure) | **Fiche** (nom d'un membre Elite dans Membres) : remarques avec liens et images, compte TikTok, ouvrir l'étape 3 |
| **Étape 3** : 3 vidéos, 24 h pour renvoyer une vidéo à corriger | |
| **Ma fiche** (`/fiche`) : tes remarques, son compte, son parcours | |

- Bob te prévient à chaque envoi ; il prévient le membre à chaque décision, remarque et étape ouverte, et le relance
  selon les délais (moitié du délai, 1 h avant la fin, puis toutes les 12 h en retard).
- Les vidéos d'une étape (150 Mo maximum, `VIDEO_PARCOURS_MO`) sont supprimées du serveur dès que l'étape est validée.
- Les coachings réguliers s'ouvrent à l'étape 3 : **3 à 5 par semaine** (`COACHING_MIN_PAR_SEMAINE`, `COACHING_MAX_PAR_SEMAINE`).
- Vidéos de présentation des étapes : `WISTIA_ETAPE_1`, `WISTIA_ETAPE_2`, `WISTIA_ETAPE_3`, `WISTIA_ETAPE_4`, et `WISTIA_GOAT`.
  Elles s'affichent dans la fenêtre « Ce qu'il te reste à faire » (à chaque ouverture de Mon profil et de Mon parcours,
  et avec « Bravo, étape ouverte ! » au changement d'étape) ; celles des étapes 1 à 3 aussi en haut de leur étape.

### Remettre tous les élèves à l'étape 1 (après les tests)

Garde les comptes (paiements, connexions, prénoms, accès validés) et efface le suivi : exercices, vidéos, remarques,
comptes rendus, rôles atteints, sinistres, suivis, concurrences et coachings réservés. D'abord voir ce qui serait effacé :
```
docker exec overmaxx-paiement node src/outils/remettre-etape-1.js
```
Puis le faire (une sauvegarde complète de la base est créée juste avant) :
```
docker exec overmaxx-paiement node src/outils/remettre-etape-1.js --confirmer
```
Ajouter `--garder-coaching` pour garder les coachings réservés. Les rôles Discord (GOAT, clubs, Sinistré) ne changent pas :
retire-les à la main.

## Le parcours Elite (livraison 2) : étape 4, objectifs, sinistrés

| Côté membre | Côté coach |
|---|---|
| **Étape 4** (`/parcours/etape-4`) : ses 3 heures (création, publication, compte rendu, à son heure), la déclaration du jour (liens TikTok + capture du compte), ses comptes rendus à faire | **À traiter** : comptes rendus (étape 4), rôles à confirmer, fiches de sinistre |
| **Compte rendu** (`/parcours/compte-rendu/<jour>`) : en premier, le total de son tableau de bord TikTok (Par mois) et sa capture ; puis chiffres du compte, top 3 des pays, chiffres de chaque vidéo, sa question | **Compte rendu** (`/admin/comptes-rendus/<n>`) : ses chiffres, captures, question ; Demander des modifications / Valider |
| **Mon profil** (`/profil`) : tableau de bord des récompenses façon TikTok (Par mois, Par an, Personnalisé), objectifs ($50, $500, $1,000, $1,500) et statistiques | **Fiche** : objectifs, statistiques, son tableau de bord, rôles à confirmer, sinistres (Demander des précisions, Réhabiliter, Déclarer, Force majeure) |
| **Sinistré** (`/sinistre`) : sa fiche de sinistre ; tout le reste du parcours lui est fermé | |

- **Rappels de Bob à l'heure du membre** : création, publication (s'il n'a rien déclaré), compte rendu (avec un bouton par compte
  rendu en retard ou à corriger). Heures pas choisies : rappel toutes les 6 h.
- **Gain du jour** = total du tableau de bord TikTok recopié ce jour-là − son total précédent du même mois (en dollars, comme TikTok).
- **GOAT** ($1,000 validés sur 28 jours) et **rôles de revenus** ($1,500, $5,000, $10,000 validés au total) : Bob t'écrit avec un
  bouton **Confirmer** (ou depuis la fiche) ; à la confirmation, il donne le rôle et félicite le membre. GOAT = étape 5.
- **Absences** (aucune visite de la plateforme, ni leçon terminée sur Whop) : 3 jours « Pourquoi tu n'es pas là ? »,
  6 jours « Demain, tu seras sinistré », 7 jours **sinistre** : Bob retire le rôle Elite, donne le rôle **Sinistré**,
  libère ses créneaux de coaching et vous prévient tous les deux. Fiche à remplir (rappel toutes les 24 h) ;
  7 jours de plus sans fiche = un sinistre de plus ; au 3e, **sinistré total** (plus de live individuel).
  Les jours où le membre attend ta décision (exercices ou vidéos envoyés, coaching d'entrée fait) ne comptent pas.
  À la mise en service, le compteur de chacun part de zéro.
- **Salon #sinistrés** : au démarrage, Bob le crée (ou utilise `DISCORD_SALON_SINISTRES_ID`), le montre au seul rôle Sinistré,
  cache tous les autres salons à ce rôle et y publie le message avec le bouton **Remplir ma fiche de sinistre**.
- Après les 90 jours : plus de live individuel pour personne, plus de rappels quotidiens ni de sinistres.
- **À vérifier dans Discord** : dans Paramètres du serveur > Rôles, le rôle de **Bob** doit être **au-dessus** des rôles Elite,
  GOAT, Sinistré, 1 500, 5 000 et 10 000 (sinon Discord refuse qu'il les donne ou les retire).
- **Membres payés par carte** : si Whop redonne de lui-même le rôle Elite à un sinistré, le salon #sinistrés ne suffit plus
  à le restreindre ; Bob ne le compte pas comme un paiement arrêté.

## Le coaching (livraison 3)

| Côté membre (`/coaching`) | Côté coach |
|---|---|
| Toutes les heures **à son heure** (fuseau de son téléphone), avec « nuit » quand un créneau tombe le lendemain chez lui | **Calendrier** (`/admin`) : séances de tous les types, tes absences (hachuré), séances que tu as annulées (rouge) |
| **Créneaux fixes** (les mêmes chaque semaine) ou **Semaine par semaine** (cette semaine ou la prochaine), 3 à 5 par semaine | **Mes disponibilités** (`/admin/disponibilites`) : tout coché par défaut, décoche tes absences (un créneau ou un jour entier) |
| **Annuler ou reporter** jusqu'à 30 min avant, avec une justification | **J'ai un imprévu** (`/admin/imprevu`) : les séances du jour à annuler et ton message |
| Séance annulée par le coach **en rouge** : **Reprogrammer** ou **Garder en réserve** | |
| **Coachings en réserve** (5 au plus), créneaux libres **en vert**, en plus de ses coachings habituels | |

- **Le dimanche à partir de 8 h UTC**, Bob t'envoie le bouton **Sélectionner mes disponibilités** pour la semaine suivante.
- **2 h avant la première séance du jour**, son récapitulatif a un bouton **J'ai un imprévu**.
- Chaque membre touché par une absence ou un imprévu reçoit un message privé (avec ton message pour un imprévu)
  et **1 coaching en réserve** ; la séance ne compte pas dans son minimum et n'a pas de rappel.
- Bob te prévient quand un membre reporte une séance ou utilise une réserve.

## L'application Overmaxx et ses notifications (livraison 4)

- Le site s'installe comme une application (icône Overmaxx sur l'écran d'accueil, sans store). Page **Notifications**
  (`/notifications`, dans le menu) : bouton **Installer l'application** sur Android, étapes **Partager → Sur l'écran d'accueil**
  sur iPhone (iOS 16.4 ou plus récent ; sur iPhone, les notifications ne marchent que dans l'application installée).
- Chacun choisit **Bob (Discord)** ou **l'application**, toi compris. Si aucun appareil ne répond, Bob prend le relais.
- **Rappels de paiement** (Community) : Bob tout de suite, puis l'application 10 minutes plus tard s'il n'a toujours pas payé.
- L'application installée s'ouvre déjà connectée. Rien à configurer : les clés des notifications sont créées au premier démarrage.
- Il faut que le site soit en **HTTPS** (c'est le cas avec Caddy sur overmaxx.online).

## Le tableau des élèves Elite

**Élèves Elite** (`/admin/eleves`, dans le menu) : une colonne par étape (1 à 4), et GOAT.
- Glisse un élève vers une autre étape (ou touche **Déplacer** sur téléphone). Vers l'avant, la fenêtre liste tout ce qui
  n'a pas été validé sur la plateforme, étape par étape, et te demande de confirmer. Son compte TikTok est obligatoire
  à partir de l'étape 3 (la fenêtre te le demande s'il manque). Bob le prévient : « Étape N ouverte ».
- Les étapes sautées sont marquées « passées par toi » sur sa fiche ; ses envois en attente sont laissés de côté.
- **GOAT ne se donne pas à la main** : il se gagne avec les résultats suivis sur la plateforme.
- Les membres Elite payés (mobile money ou carte) y apparaissent tout seuls. Pour quelqu'un que tu accompagnes déjà
  sans paiement sur le site : **Ajouter un élève** avec son pseudo Discord et sa date d'entrée (ses 90 jours partent de là).

## Accueil des nouveaux, fenêtres d'aide et réglage Discord

- **Rejoindre le Discord** (page d'accueil, connexion, candidature) ouvre d'abord la fenêtre **« Avant de rejoindre le Discord »** :
  4 captures annotées pour activer *Messages privés et demandes d'ami* (Paramètres → Contenu et social), le réglage
  qui permet à Bob d'écrire. Aussi sur la page Notifications (« Bob ne t'écrit pas ? »).
- **Accueil des nouveaux** (`/bienvenue`), à la première ouverture de son espace : ses infos (prénom, pays, fuseau),
  installer l'application, choisir ses notifications (l'application, recommandée, ou Bob). Chaque écran se passe.
- **Mon parcours** : à chaque ouverture, une fenêtre **« Ce qu'il te reste à faire »** (croix en haut à droite) liste
  ses tâches, la plus importante en premier ; « Bravo, étape N ouverte ! » au changement d'étape.
- **Élèves Elite** : le bouton **Compléter** (orange s'il manque quelque chose) renseigne en une fois son compte TikTok,
  sa niche, son pays, son niveau et sa date d'entrée.
- **Icône de l'application** : le globe Overmaxx (`public/icones/globe-*.png`). Android met l'icône à jour tout seul
  (en quelques jours au plus) ; sur iPhone, il faut supprimer l'application de l'écran d'accueil et l'ajouter à nouveau.

## Classement (top 100)

**Classement** (`/classement`, dans le menu de chacun) :
- En haut : les revenus générés sur Overmaxx (récompenses validées de tous les élèves), le nombre de membres,
  et les événements (aucun pour le moment).
- Le podium : cartes or, argent et bronze, avec un reflet qui passe sur la bordure ; la médaille pour le premier seulement.
  Chaque carte : revenus générés (en grand), vues (999, puis 1.2K, 1.2M, 1.2Md) et jours depuis son entrée,
  puis son rôle le plus élevé (👑 €10k Club 👑, 👑 €5k Club 👑, 👑 €1.5k Club 👑, GOAT) et son programme (Elite ; Membre pour la formation),
  en pastilles aux couleurs des rôles Discord (`src/roles.js`). Les seuils restent comptés en dollars ($10,000, $5,000, $1,500).
- Puis le classement général jusqu'à la 100e place. Sur téléphone, tout s'affiche en lignes.
- On n'y voit que son prénom (accueil) et son pseudo Discord, jamais son nom complet. La photo est celle de Discord,
  mise à jour par Bob.
- Hors du top 100 : il voit sa place (« Tu es 134e sur 210 ») ; son profil n'est visible que de lui et du coach.

## Mon profil (accueil des élèves), communauté et chaîne 🔥

- **Mon profil** est maintenant la page d'accueil des élèves Elite : photo, prénom et @pseudo ; revenus totaux, rang le plus haut
  et jours depuis l'entrée ; la **roue des jours** (elle défile au doigt, le jour au centre grossit, « Revenir à aujourd'hui ») ;
  sous la roue, le jour choisi : aujourd'hui la tâche du moment, les autres jours le résultat (gain, vues) ou le compte rendu à faire ;
  la carte **Je suis**, la carte **chaîne**, la tâche du moment, puis le tableau de bord des revenus.
- **Chaîne 🔥** : jours d'affilée avec un compte rendu **envoyé**. La flamme s'allume à 3 jours ; un jour manqué et elle repart à zéro.
  Elle apparaît aussi dans le classement, avant le nombre de jours.
- **Communauté** (`/communaute`) : suivre jusqu'à **10 personnes** (on retire quelqu'un pour en suivre un autre) ; « En vogue » propose
  les meilleurs résultats de la semaine. Quand tu valides un compte rendu, ceux qui le suivent sont prévenus : l'argent gagné,
  sinon les vues, sinon « vient de poster ».
- **Concurrence** : à l'étape 4, après le premier compte rendu. « Profils proches » propose ceux qui ont, sur 10 jours, des revenus
  à 200 $ près et des vues à 500 000 près. Invitation acceptée ou refusée ; **3 concurrents** au plus, chacun prend une des 10 places.
  Objectif : le prochain palier (1 000, 1 500, 5 000, 10 000 $) ; le premier qui l'atteint gagne, Bob prévient les deux.
- Sur téléphone, **barre du bas** : Classement · Remarques · Mes rappels · Profil. La vibration de la roue marche sur Android ;
  Apple ne la permet pas aux sites (iPhone).

## Pastilles, pièce et objectif (Mon profil)

- **Pastilles rouges** sur la cloche (notifications non lues, jusqu'à « 9+ ») et sur la bulle (nouvelles remarques du coach).
  Chaque message de Bob ou de l'application à un élève est rangé dans sa page Notifications (onglets Notifications / Réglages).
- **Photo en pièce** au bord cranté, de la couleur du rang : bleu Elite, vert Membre, doré GOAT et €10k, or €5k, orange €1.5k ;
  rouge et photo en gris pour un sinistré. Pas de brillance fixe : un reflet passe du coin bas gauche au coin haut droit.
- **Prochain objectif** sous les chiffres : barre de progression, le montant à droite ; elle ouvre Mes revenus (même barre).
- **Roue des jours** : chaque jour donne son action (faire, corriger ou voir son compte rendu).

## Événements (bannière) et annonces

Menu Gestion → **Événements** (`/admin/annonces`). Le logo du haut des pages est remplacé par une **bannière des événements en cours**
(plusieurs : elles défilent toutes les 4 secondes, ou au doigt) ; sans événement, rien ne s'affiche.
- Titre, message, **+ Ajouter un lien** (https://… ou une page du site), **image au format 16:5** (par exemple 1600 × 500 px), **sans texte** :
  le titre s'écrit à gauche, sur la **couleur dominante** (calculée toute seule d'après le côté gauche de l'image, modifiable),
  et l'image apparaît en fondu vers la droite. Sans image : le texte sur la couleur.
- **Afficher jusqu'au** (7 jours par défaut) ; **Retirer de la bannière** à tout moment.
- **Envoyer aussi une notification** (coché par défaut) : tous les élèves Elite la reçoivent (application ou Bob, image jointe sur Discord).

## Étape 4 : résultats par vidéo et update du compte

- **Publier** : l'élève colle seulement le lien de la vidéo (un lien déjà déclaré est refusé).
- **24 h après** : « Résultats » de la vidéo : capture des statistiques, vues et revenus de la vidéo. Il peut revenir les **mettre à jour**
  (une capture de plus, nouvelles vues et nouveaux revenus) ; la date de publication ne change pas.
- **Chaque jour, à son heure de résultats** : l'**update du compte** : capture des **28 derniers jours**, vues et revenus sur 28 jours.
- **Tu valides tout** (À traiter : « Résultats vidéo » et « Updates du compte ») ; une demande de modifications revient à l'élève avec ta remarque.
- **Calculs** : revenus totaux = revenus validés des vidéos (objectifs, rôles €1.5k / €5k / €10k, classement) ;
  **GOAT** = revenus des 28 derniers jours du dernier update validé ($1,000) ; vues du profil = vues sur 28 jours du dernier update validé.
- **Rappels de Bob** : à son heure de résultats, les vidéos à mettre à jour et l'update du jour ; **le dimanche**, « tes vidéos bangers
  ont fait plus de stats ? Mets-les à jour ». Ceux qui le suivent sont prévenus quand tu valides les résultats d'une vidéo.

## Espace du coach épuré

- **Menu** : Mon profil (`/coach`), À traiter, Calendrier, Élèves Elite, Planifier, Classement, Notifications.
  **Barre du bas** (téléphone) : Profil, À traiter (pastille), Calendrier, Planifier, Classement.
  Candidatures, Membres, Pages du site et Site public ne sont plus dans le menu (les candidatures sont dans À traiter).
- **À traiter** : une seule file, tout mélangé, le plus ancien d'abord, avec une étiquette sous chaque carte (Étape 1, Comptes rendus,
  Candidatures, Accès au site…). Les filtres en haut sont rangés par nombre ; un clic n'affiche que cette catégorie.
- **Élèves Elite** : vue **Kanban** ou **Liste**. En liste, tri par arrivée, rang, revenus, posts, régularité, étape ;
  un clic : décroissant, deux : croissant, trois : retiré ; plusieurs critères à la fois (le premier choisi compte d'abord).
- **Planifier** : **Événement** (bannière), **Remarque** à un élève, **Message à tous** (notification simple, sans bannière,
  avec le test de notification).
- **Mon profil (coach)** : pièce dorée, nombre d'élèves, revenus générés par tes élèves, à traiter, raccourcis, meilleurs élèves.

## Mon profil épuré (élèves)

- **Menu** des élèves : Mon profil, Mon parcours, Mes coachings, Classement (« Site public » seulement pour le coach).
- **Mon profil** : cloche (notifications) et bulle (remarques du coach) à gauche ; flamme et roue dentée (Réglages) à droite ;
  la photo ouvre la fiche ; la frise des étapes ouvre Mon parcours ; carrousel (chaîne, place au classement, revenus du mois,
  prochain objectif), qui défile seul toutes les 3 secondes ou au doigt ; « Je suis » ouvre la page des suivis et concurrents
  (carrés, puis leurs dernières nouvelles) ; les prochains coachings en bas. Le tableau de bord des revenus est sur `/revenus`.
- **Réglages** (`/reglages`) : prénom, pays, **lien du compte TikTok**, notifications, coachings, se déconnecter.
- **Compte TikTok** : on enregistre le lien du profil (un @alias est transformé en lien).
- **Étape 4** : déclarer une vidéo = coller son lien (plus de capture du compte). Une vidéo déjà déclarée est refusée.

## Notifications du coach : Notifications et Mes rappels

- **Notifications** (menu Gestion) : chaque message que Bob t'envoie y est aussi rangé, avec « Ouvrir » vers la bonne page.
  Le nombre de non lues s'affiche dans le menu. Une réservation de coaching (semaine, créneaux fixes, coaching d'entrée,
  report, réserve) t'envoie une notification.
- **Mes rappels** : tes propres rappels (chaque jour, certains jours, ou une seule fois), à l'heure GMT choisie, avec des idées
  en un clic (coachings du jour, disponibilités, événement, comptes rendus). Bob te les envoie dans l'application ou sur Discord.
- Pour suivre ou défier quelqu'un, les élèves ouvrent son profil depuis le **classement** (boutons Suivre / Défier),
  ou la section **Recommandés** de Communauté.

## Connexion par code et appareil reconnu

- Sur la page de connexion, la personne donne son pseudo Discord. Bob lui envoie un **code à 6 chiffres** (valable 10 minutes,
  3 essais, 10 erreurs par jour au plus) et le bouton « C'est bien moi, continuer », valable 15 minutes. Le code se tape **sur la page où il a été demandé** : c'est ce qui
  permet de se connecter dans l'application installée (qui ne partage pas la connexion du navigateur). Le bouton, lui,
  ouvre le site dans le navigateur.
- Après une connexion, l'appareil reste **reconnu un an**. « Se déconnecter » ferme la session mais garde l'appareil :
  l'accueil et la page de connexion affichent **Me reconnecter**, un seul bouton, sans nouveau message de Bob.
- « Ce n'est pas toi ? Autre compte » et « Changer de compte » font oublier l'appareil (pour un téléphone prêté).

## Rôles donnés à la main (validation)

Quand quelqu'un reçoit le rôle **Community** ou **Elite** sans avoir payé sur le site, Bob regarde qui l'a donné
(dans les logs du serveur) :
- **le bot de Whop** (paiement par carte) : accès au site comme avant, sans question ;
- **toi** (ou un modérateur) : Bob t'écrit en privé : « **X** a reçu le rôle **Overmaxx Elite** sans avoir payé sur le site
  (rôle donné par **toi**). Lui donner accès au site quand même ? », avec deux boutons **Oui** et **Non**.
  - **Oui** : il a accès au site (pour l'Elite, son parcours s'ouvre). Bob lui écrit que son accès est ouvert, avec le bouton
    « Ouvrir mon espace ».
  - **Non** : pas d'accès au site, rien ne lui est envoyé ; **son rôle Discord reste**. Bob ne redemande plus.
- Rôle donné pendant que Bob était éteint : il le repère à son passage (toutes les 10 minutes) et te pose la même question.

Pour que Bob sache qui donne les rôles, son rôle doit avoir **Voir les logs du serveur** (Paramètres du serveur → Rôles → Bob).
Sans ce droit, Bob te prévient au démarrage, et te pose la question pour chaque rôle sans paiement sur le site
(réponds Oui pour un paiement par carte sur Whop).

**Ceux qui avaient le rôle avant la validation** (déjà repérés comme « carte ») : Bob te demande aussi pour chacun,
mais ils **gardent l'accès en attendant ta réponse**. Boutons **Oui, il garde l'accès** / **Non, retirer l'accès**.
Non : il perd l'accès au site ; pour l'Elite, son parcours est fermé (rien n'est effacé, il revient si tu changes d'avis).

Plus de 5 questions d'un coup (le premier passage) : un seul message de Bob avec le bouton **Répondre**, qui ouvre
**À traiter → Accès au site** : la liste avec Oui / Non pour chacun. Les refusés y restent, avec **Donner l'accès** si tu changes d'avis.

Tu retires le rôle à quelqu'un à qui tu avais donné l'accès : le site se ferme, sans message. Tu le lui redonnes :
le site se rouvre, sans nouvelle question. Dans **Membres**, ils apparaissent avec « Donné à la main ».

## L'espace de gestion

Sur **overmaxx.online/admin** (connexion avec `/connexion` dans Discord) : barre latérale à gauche sur ordinateur,
menu ☰ sur téléphone.

| Page | Contenu |
|---|---|
| **Calendrier** (`/admin`) | les coachings de la semaine ; clic sur un créneau = fiche du membre ; annulations |
| **Candidatures** (`/admin/candidatures`) | réponses, vidéos, boutons Retenir / Refuser / Valider (pastille = à traiter) |
| **Membres** (`/admin/membres`) | membres mobile money : offre, statut (actif, en attente, expiré), fin d'accès, prix garanti, accès Whop |
| **Mes coachings** (`/coaching`) | la grille de réservation (vue membre) |

## 8. Vérifier

- Sur Discord, tape `/lien-elite` : Bob te répond (toi seul le vois) avec un lien de paiement Elite unique.
- Va sur **overmaxx.online/admin** et connecte-toi avec Discord : le calendrier s'affiche.
- Un membre Elite va sur **overmaxx.online/coaching** et réserve ses 4 créneaux : Bob lui envoie le récapitulatif.

## Les commandes de Bob (réservées à l'admin)

| Commande | Effet |
|---|---|
| `/connexion` *(tout le monde)* | Bob envoie les liens personnels de connexion au site : coaching, candidature, et admin pour toi |
| `/lier code:` *(tout le monde)* | relie un paiement mobile money au compte Discord, grâce au code affiché après le paiement, et donne le rôle |
| `/configurer-attente salon:` | crée (ou utilise) le salon d'attente, seul salon visible pour En Attente, et bloque tous les autres |
| `/publier bouton:` | publie le bouton **Postuler** ou **Se connecter au site** dans le salon |
| `/lien-elite note:` | crée un lien de paiement Elite personnel, utilisable une seule fois |
| `/prolonger membre: jours: offre:` | prolonge gratuitement un accès, sur le site et sur Whop (lien de grâce) |
| `/membre membre:` | affiche l'accès mobile money d'un membre (offre, fin, prix garanti) |

Les décisions sur les candidatures se prennent avec les boutons **Retenir / Refuser / Valider** des messages de Bob,
ou sur **overmaxx.online/admin/candidatures**.

## Revenus, messages et À traiter

- **Revenus** : le total vient des updates du compte (28 derniers jours), plus des vidéos. La première update validée compte entièrement. Ensuite, chaque jour : valeur des 28 jours + total d'il y a 28 jours. Le total ne baisse jamais.
- **Planifier → Envoyer un message** : remplace « Remarque » et « Message à tous ».
  - Choisis les destinataires : liste à cocher, recherche, « Tout sélectionner ».
  - Titre en gras ; gras / italique / souligné avec G, I, S.
  - Chaque élève le voit dans ses Remarques et reçoit une notification.
- **Accusés sous chaque message** : 👎 non délivré, 👍 délivré, 👁️ lu. Touche un nombre pour voir qui. « Relancer » renvoie le message à ceux qui ne l'ont pas lu.
- **Fiche d'un élève** : « Envoyer un message » à lui seul. Le bouton existe aussi sur son profil.
- **Écrire au coach** : l'élève écrit depuis ses Remarques. Le message arrive dans À traiter (Messages) ; tu y réponds, ou tu le marques traité.
- **À traiter** affiche aussi tes notifications non lues (filtre Notifications). Seule une notification que tu ouvres devient lue : rien ne se marque lu en bloc.

## Ressources, stratégie de l'étape 3, créneaux

- **Ressources** (menu) : trois onglets.
  - **Niches** : nom, sujet, L1 ou L2, pays recommandés, RPM, exemples, contre-exemples, comptes sources.
  - **Méthodes 10K** : nom facultatif ; type vidéo, carrousel ou CTA ; « meilleure pour L1 / L2 », que toi seul choisis.
  - **Tutoriels** : montage, ciblage, scripting, astuce ou autre.
- **Ce que font les élèves avec les ressources** :
  - ils les aiment ♥ ;
  - ils proposent une niche ou une méthode : elle arrive dans À traiter (filtre Ressources), tu valides ou refuses avec un motif ;
  - ils peuvent modifier leur proposition tant qu'elle n'est pas validée (toi, toujours) ;
  - ils t'envoient une remarque sur une ressource.
- **Étape 3** : l'élève choisit sa niche (ou ajoute la sienne), sa méthode 10K et son pays parmi les 8. Tu les vois seul, sur son profil (« Sa stratégie »), jamais dans le classement.
- **Étape 4** : le lien du compte TikTok est demandé en premier. Sans lui, pas de publication.
- **Calendrier** : touche un créneau réservé pour ouvrir sa page. Tu y trouves sa fiche, un message, et « Demander à l'élève ».
  - La demande : le déplacer vers une heure libre, ou l'annuler (tu n'es pas disponible).
  - Rien ne change tout seul : l'élève reçoit la demande et agit depuis Mes coachings.
- **Notifications** : « Coaching réservé » ouvre le créneau, un message ouvre le message, une notification sur un élève ouvre sa fiche.
- **À traiter** : en orange, ce qui attend ta décision ; en noir, sous « Déjà traité », ce que tu as déjà lu ou traité (7 derniers jours).

## Profil et parcours : régularité, Je suis, formation Whop

- **Flamme** (en haut de Mon profil) : elle ouvre la régularité, un calendrier du mois façon GitHub ou Duolingo.
  - Chaque jour se colore selon les tâches faites : exercices ou vidéos envoyés, vidéos déclarées, résultats donnés, update du compte.
  - 1 tâche = vert foncé, 2 = plus clair, 3 et plus = le plus vif.
  - ‹ › pour voir les 6 derniers mois.
- **Je suis** : une carte qui défile toute seule, « Mes concurrents » puis « Mes suivis ».
- **Mon parcours**, dans l'ordre :
  1. À faire maintenant ;
  2. Ma régularité (le même calendrier) ;
  3. la dernière remarque du coach, repliée : ses images s'affichent quand on l'ouvre.
- **Formation sur Whop** : un bouton « Continuer la formation sur Whop ». Il ouvre l'application Whop si elle est installée, sinon le site.
  - Par défaut, il mène au lien de l'offre Elite sur Whop.
  - Pour un autre lien : `LIEN_FORMATION_WHOP=https://whop.com/...` dans overmaxx.env.

## Ressources : images, liens un par un, tutoriels en étapes

- **Liste façon Discord** : miniature à gauche (la première image), titre en gras, aperçu, likes.
- **Images** : jusqu'à 5 par ressource. La première est la miniature (une capture d'un compte exemple), les autres montrent le contenu. × pour en retirer une.
- **Liens** (exemples, contre-exemples, sources) : « + Ajouter un lien » ouvre un champ par lien ; × pour le retirer.
- **Tutoriels et astuces** : les élèves peuvent aussi en proposer (validés par toi). Un tutoriel se découpe en étapes, chacune avec son explication et le lien du tuto à suivre, dans l'ordre.
- **Notifications** : le titre s'affiche en gras dans tes notifications et dans À traiter (les anciennes restent comme avant).

## Compte TikTok à l'étape 4, niche choisie dans les listes

- **Compte TikTok** : demandé seulement à l'étape 4, à l'élève lui-même, quand il commence à publier.
  - Avant l'étape 4, il n'apparaît ni dans ses Réglages, ni sur sa fiche, ni dans le texte du coaching d'entrée.
  - Tu n'as plus à le renseigner pour faire passer quelqu'un à l'étape 4.
- **Niche, méthode 10K, pays visé** se choisissent dans des listes : sur la fiche, et dans « Infos » du tableau des élèves.
  - Les niches et les méthodes viennent des Ressources publiées ; le pays est l'un des 8.
  - Une niche ou une méthode manque : ajoute-la d'abord dans les Ressources.
- **Profil L1** : les niches L2 (commentaire) ne lui sont pas proposées, ni par toi ni par l'élève à l'étape 3. Un profil L2 les voit toutes.
- **Plus de niveau ni de date d'entrée** dans la fenêtre « Infos ».

## Forum « ressources » sur Discord (double base)

- Au démarrage, **Bob crée lui-même le forum `ressources`**, avec 4 tags :
  - 🚀 **10k Abos** : méthodes ;
  - 🔁 **repost** : niches L1 ;
  - 💡 **Cmtry** : niches L2 ;
  - 📘 **guide** : tutoriels et astuces.
- **Visibilité** : il est caché à tout le monde sauf aux rôles Elite, GOAT et revenus. Ils lisent et répondent dans les posts ; seul Bob crée les posts.
- **Quand une ressource est postée** : quand toi tu l'ajoutes, ou quand tu valides une proposition d'élève.
- **Contenu du post** : titre avec emoji (« 🚀 Tricotage (Repost amélioré) », « 😈 (Méthode) 10k - … »), thématique, pays en drapeaux, RPM, liens, étapes, ses images, et le lien vers la plateforme.
- **Une ressource modifiée** met à jour le même post.
- **Les ressources publiques déjà sur la plateforme** sont postées au démarrage.
- **Si le forum ne se crée pas** : le serveur doit être en mode **Communauté** (les forums en ont besoin) et Bob doit avoir **Gérer les salons**. Bob te prévient si ça bloque.
- Les posts que tu avais faits à la main avant restent dans ton ancien forum : Bob ne les copie pas.

## Vidéos à relire, réalisations, notifications partout

- **Étape 4, « Faire relire une vidéo »** : facultatif. L'élève envoie une vidéo avant de la publier, 3 en attente au plus.
  - Tu réponds « Prête à publier » ou « À retravailler », sans délai imposé.
  - Seules ses 3 dernières vidéos restent sur le serveur : la plus ancienne est effacée, ton avis reste.
- **Remarque et script** : à chaque vidéo envoyée (étapes 3 et 4), l'élève peut ajouter une remarque et coller le script français. Tu les vois dans la page de la vidéo et sur sa fiche.
- **Fiche d'un élève** :
  - « ✉️ Envoyer un message » s'ouvre d'un clic.
  - « **Réalisations** » montre ses vidéos (lecteur, état, remarque, script, ton avis), visible par toi et par lui.
  - Les vidéos de l'étape 3 y restent jusqu'au passage à l'étape 4, puis sont effacées.
- **Notifications** :
  - Dès qu'un téléphone a activé les notifications de l'application, elles s'y affichent, même écran éteint, que la personne ait choisi Bob ou non.
  - Si « Bob » est choisi explicitement, Bob l'envoie aussi sur Discord.
  - Tu es prévenu de chaque action d'élève :
    - vidéo envoyée, résultats et updates ;
    - vidéo publiée ;
    - compte TikTok ajouté ou changé ;
    - heures choisies, stratégie choisie ;
    - messages, propositions de ressources, coachings réservés ou déplacés.

## Positionnement et compte validés par le coach ; tableau des élèves allégé

- **Positionnement** (niche, méthode 10K, pays) : l'élève l'envoie à l'étape 3.
  - Sur sa fiche : rouge (pas envoyé), jaune (envoyé, à valider), vert (acté).
  - Tu le valides (À traiter ou sa fiche) : il est verrouillé, l'élève ne peut plus le changer.
  - Toi, tu peux toujours le modifier avec « Modifier ».
- **Compte TikTok** : l'élève l'envoie à l'étape 4, tu le valides, il est verrouillé.
  - En cas de problème (shadowban…), l'élève demande un changement depuis ses Réglages, avec la raison.
  - Tu autorises (il envoie un nouveau lien une fois, puis tu revalides) ou tu gardes l'ancien.
- **Fiche** : plus de formulaires ouverts. Des états en couleur, et « Modifier » pour ouvrir le formulaire.
- **Tableau des élèves** :
  - colonnes séparées par des lignes verticales ;
  - cartes allégées, sans niche ni compte ;
  - plus de bouton « Déplacer » : sur ordinateur on glisse, sur téléphone appui long puis on glisse ;
  - « Compléter » apparaît seulement s'il manque quelque chose ;
  - dans chaque colonne, les élèves les plus complets sont en haut.

## Notifications : diagnostic, bannière dans l'application, resynchronisation

- **Application ouverte** : une notification reçue s'affiche aussi en bannière en haut de l'écran, avec une vibration. Certains téléphones, l'iPhone surtout, n'affichent pas la notification système quand l'application est au premier plan.
- **Resynchronisation** : à chaque ouverture, le téléphone redonne son abonnement au site. Un téléphone peut le changer tout seul ; avant, le site gardait l'ancien et la notification partait dans le vide.
- **Notifications › Réglages › « Je ne reçois rien : diagnostic »**, à ouvrir sur le téléphone qui ne reçoit pas :
  - les vérifications : application installée, notifications autorisées, service actif, téléphone abonné et connu du site ;
  - test 1 : affiche une notification directement sur le téléphone. S'il ne s'affiche pas, c'est un réglage du téléphone (Notifications › Overmaxx, mode Concentration).
  - test 2 : passe par Apple ou Google et affiche leur réponse exacte (acceptée, refusée et pourquoi).
- **Mes appareils** : chaque appareil montre la réponse au dernier envoi (accepté ou refusé).

## Gestion, profil du coach, notifications triées

- **Barre du bas (coach)** : Profil, À traiter, Calendrier, Gestion.
- **Gestion** : quatre cases côte à côte : Planifier, Gérer les élèves, Ressources, Mes rappels. Chacune affiche un chiffre, et une alerte s'il y a quelque chose à relire.
- **Mon profil (coach)** :
  - « À la une » remplace « À traiter » : les meilleurs résultats de vidéos validés des 7 derniers jours.
  - Le Classement est accessible depuis ton profil.
- **Notifications (coach)** : les 5 premières, puis « Afficher plus ». Les non lues restent en haut ; une notification ouverte descend en bas.

## Validation des coachings

- **Après chaque coaching**, 5 minutes après la fin des 30 minutes, toi et l'élève recevez « **Valider ce coaching** ».
  - Toi : dans À traiter, filtre « Coachings à valider ».
  - L'élève : dans Mes coachings, carte « À confirmer ». Il valide seulement si le coaching a vraiment eu lieu ; sinon, il **conteste** en expliquant (« j'ai attendu pendant tout le coaching »).
- **Contestation** : tu la traites dans À traiter.
  - « Donner un coaching en réserve » : il le reprogramme dans Mes coachings.
  - Ou « Classer ».
- **Coaching fait en avance** (ou annulé car non nécessaire, remplacé par un live de groupe, autre raison) : ouvre le créneau dans le Calendrier, puis « **Valider ce coaching en avance** ».
  - L'élève approuve : la séance disparaît du programme et le créneau se libère.
  - Ou il refuse en disant pourquoi : tu es prévenu, la séance reste.

## Importer un ancien forum Discord

- **Ressources › « 📥 Importer un ancien forum Discord »** (coach).
  1. « Inviter Bob » sur l'ancien serveur. Il ne lui faut que « Voir les salons » et « Lire l'historique ». Si le forum est privé, donne-lui accès au forum.
  2. Colle le lien du forum (clic droit sur le forum › Copier le lien), puis « Importer ».
- **Ce que fait Bob** : il lit chaque post (actifs et archivés) et le crée en ressource publique.
  - Les tags donnent le type : 10k Abos → méthode, repost → niche L1, Cmtry → niche L2, le reste → tutoriel.
  - « Thématique : … » donne le nom, les drapeaux les pays, les liens TikTok les comptes (après « Comptes sources » : les sources).
  - Il copie les images (5 au plus) et poste chaque ressource dans le nouveau forum.
- **Bilan** : Bob te l'envoie quand c'est fini, avec les posts à reprendre à la main s'il y en a.
- **Relancer** ne crée jamais deux fois le même post : il met à jour ceux déjà importés (texte, images).
- **Prérequis** : sur discord.com/developers › application de Bob › Bot, active « Message Content Intent », puis relance le site. Sans ça, Bob ne lit que les titres.

## Deux comptes dans le même navigateur ; affichage ordinateur

- **Le site répond aussi sur www.overmaxx.online**, avec sa propre connexion : les cookies sont propres à chaque adresse.
  - Ton compte coach reste sur `overmaxx.online`, ton compte test sur `www.overmaxx.online`.
  - Ils sont ouverts en même temps, dans deux espaces Opera, sans que l'un déconnecte l'autre.
- **Pour ouvrir la 2e session** : menu › « Autre compte (2e session) ↗ ».
  - Connecte-toi avec ton pseudo Discord et le code de Bob (ou son bouton : il ramène sur la même adresse).
  - Sur www, utilise la connexion par pseudo, pas « Se connecter avec Discord » qui revient sur l'adresse principale.
- **Ordinateur** : Mon profil (élève et coach) s'affiche en deux colonnes, et À traiter aussi sur grand écran.

## Progresser, trophées et « Garde ce qui marche »

- **Étape 4, section Progresser** : 3 leçons conseillées dans l'ordre (Hook, Engagement, Watchtime), avec « J'ai regardé ». L'élève peut envoyer une vidéo à relire pour chaque point (3 en attente au plus). La leçon « Routine de travail » est proposée au choix des 3 heures.
- **Objectifs**, dans l'ordre (on montre le premier pas encore atteint) : 10K vues, 1 000 abonnés, 100K vues, 5 000 abonnés, 10 000 abonnés, 1M vues, puis $50, $100, $500, $1 000, $1 500, $5 000, $10 000.
- **Trophées**, gagnés sur les résultats validés par le coach :
  - Banger (vues d'une vidéo en 24 h) : Bronze 10K, Argent 100K, Or 1M, Platine 5M.
  - Compte (vues au total) : Bronze 100K, Argent 1M, Or 5M, Platine 15M.
  - Abonnés : Junior 1K, Sophomore 5K, Créateur 10K.
  - Revenus : Rookie $50 ($ bronze), Amateur $100 ($ argent), Pro $500 ($ or), GOAT $1 000 sur 28 jours ($$ or), puis les clubs avec une couronne : 1K5 Club (platine), 5K Club (or), 10K Club (émeraude). À partir de $1 000, la pièce est un hexagone.
  - Régularité (updates envoyées jour après jour, meilleure série) : Bronze 10 jours, Argent 30, Or 50, Platine 99.
  - Images : déposer les PNG dans `public/trophees/` (banger-bronze.png, compte-or.png, abonnes-argent.png, revenus-bronze.png, revenus2-or.png, club-platine.png, club-or.png, club-emeraude.png, regularite-platine.png…). Tant qu'une image manque, une pièce dessinée la remplace.
  - Une fenêtre « pièce » s'ouvre une seule fois par trophée. Bob prévient l'élève et le coach.
  - Page « Mes trophées », Trophy room sur le profil (avec les concurrents en faisant défiler), dernier trophée au classement.
- **« Garde ce qui marche »** : dès que l'élève donne les résultats d'une vidéo, si elle dépasse 10K vues, 5 % d'abonnés par rapport aux vues, $1 de RPM ou $50 de revenus. Chaque signal s'affiche une seule fois, avec la leçon. « Ne plus afficher ce message » coupe tout, après un message dissuasif.

## Demander de l'aide

- L'élève ouvre « Demander de l'aide » : menu (☰ sur Mon profil), page Remarques, ou section Progresser de l'étape 4.
- Une question par page : le problème (vues, abonnés, compte bloqué, revenus, application ou Bob, autre).
  - Vues ou abonnés : il voit où il en est sur les 3 points (Hook, Engagement, Watchtime : leçon regardée, vidéo relue), dit ce qui bloque selon lui, et choisit la vidéo concernée.
  - Compte bloqué : lien pour demander à changer de compte (si son compte est validé).
  - Enfin : son explication et des captures.
- Le coach la reçoit comme un message d'élève (« Demande d'aide · Vues »…), dans À traiter et par Bob, avec un résumé : problème, ce qui bloque, vidéo, leçons regardées, vidéos relues. Il répond comme à un message ; l'élève lit la réponse dans ses Remarques.

## Deux serveurs : membres (payant) et gratuit (l'ancien serveur)

- Le serveur de Bob (`DISCORD_GUILD_ID`) est réservé aux membres qui ont payé (Community, Elite).
- L'ancien serveur devient le serveur gratuit / d'attente :
  - les candidats à l'Elite y sont ajoutés (connexion Discord du formulaire) ;
  - à la fin des 15 jours d'attente, un membre est retiré du serveur des membres et reste (ou est invité) sur le serveur gratuit ;
  - un nouveau venu sans programme sur le serveur des membres est prévenu, puis retiré au bout de 24 h, avec le lien du serveur gratuit.
- Mise en place : Gestion → « Serveur gratuit » → « Inviter Bob sur l'ancien serveur », puis choisir l'ancien serveur. Bob le reconnaît tout seul
  (le seul autre serveur où il est), y crée une invitation permanente et te prévient. Rien à écrire dans overmaxx.env.
  - Le lien public « Rejoindre le Discord » du site devient celui du serveur gratuit ; l'ancien lien (serveur des membres) sert après paiement.
  - Facultatif dans overmaxx.env : `DISCORD_GUILD_ATTENTE_ID` (si Bob est sur plusieurs autres serveurs), `DISCORD_ROLE_ATTENTE_ANCIEN`
    (rôle donné sur l'ancien serveur aux accès expirés), `DISCORD_INVITE_MEMBRES` (invitation du serveur des membres),
    `ATTENTE_NOUVEAUX_HEURES` (délai avant retrait d'un nouveau venu sans programme ; 0 = jamais).
- Les membres actuels déjà sur l'ancien serveur : ils passent sur le nouveau quand ils reviennent par le site (bouton Discord de leur accès).
- Whop (paiement par carte) : vérifie que l'intégration Discord de Whop donne bien le rôle sur le **nouveau** serveur.

## Résultats publiés par Bob (serveur de l'accompagnement)

- **Salon des résultats** (`DISCORD_SALON_RESULTATS_ID`, par défaut le salon texte fourni) :
  - chaque résultat de vidéo envoyé par un élève (une seule fois par vidéo) : mention de l'élève, vues, abonnés, revenus, RPM, lien et captures ;
  - chaque preuve de monétisation « acceptée » : mention et capture.
  - Les updates du soir (compte complet) ne sont pas publiées.
- **Forum « Testimonials »** (`DISCORD_FORUM_TESTIMONIALS_ID`, par défaut le forum fourni) : les updates de fin de mois, un post chacune (titre, texte, images).
- **Updates du mois** (page « Updates du mois », du 28 au 5 du mois suivant ; rappel chaque jour tant qu'elles manquent) :
  1. Update du mois : « As-tu fait de l'argent sur TikTok ce mois-ci ? ». Oui : le total, une capture, et 3 questions (comment ça a commencé, ton conseil, ton prochain objectif). Non : rien à publier.
  2. Plus gros résultat du mois : vues sur une vidéo, abonnés gagnés en une vidéo, revenus d'une vidéo (désactivé sans revenus ce mois-ci), ou autre ; son ressenti ; des images.
- Serveur gratuit : Gestion → « Serveur gratuit » → colle les liens Discord du salon des résultats et du forum Testimonials. Bob y publie
  aussi chaque résultat (prénom de l'élève, sans mention, et un lien pour rejoindre l'accompagnement).
- Bob doit pouvoir écrire et joindre des fichiers dans les salons, et créer des posts dans les forums.

## Événements (challenges)

- Gestion → Événements : nom, défi en une phrase, description, début (dans 3 à 15 jours), fin (durée 3 à 30 jours), bannière, affiche,
  couleur, conditions (pour chaque famille de trophées : le trophée minimum, ou aucun). Au plus 5 événements à venir ou en cours.
- La bannière défile en haut des pages et ouvre la page de l'événement (affiche, description, conditions, « Je participe »,
  classement de l'événement : revenus générés pendant l'événement par les inscrits, d'après les updates validées).
- Classement : les événements en haut, puis « Classement all-time » et « Classement événement ». Toute la carte d'un membre est cliquable.
- Badges : envoie la planche des 3 badges (or, argent, bronze côte à côte, fond blanc) ou une image par badge ; le fond blanc est retiré,
  la pièce recadrée et réduite à 320 px directement sur ton téléphone, avec un aperçu sur fond sombre.
- Chaque événement : les stats suivies (argent, vues, abonnés : une = monostat, plusieurs = un classement et un podium par stat),
  « Pour gagner », « Validation des résultats », le badge de récompense (nom + 3 images : or, argent, bronze).
- Rejoindre : 1. « J'ai lu, j'ai compris » ; 2. les trophées demandés (en bleu s'il les a ; sinon « Continuer » est bloqué) ;
  3. les règles pour gagner, puis « Je participe ».
- Calcul : tout le monde part de 0 au début de l'événement, d'après les updates du soir validées.
- Challenge global (les 3 stats) : les rappels quotidiens des inscrits deviennent ceux du challenge.
- À la fin : le podium de chaque stat reçoit le badge (fenêtre de victoire, message de Bob). Trophy room : 3 trophées, une barre,
  le dernier badge spécial. Page des trophées : « Badges spéciaux » (cadre bleu foncé, 5 visibles, « Voir tous mes badges »),
  seulement pour ceux qui en ont gagné.

## Profil du coach

- Photo et nom à gauche ; à droite, un carrousel : À la une, Classement (Top 100).
- Programme des coachings en heatmap (orange réservé, gris libre, rouge annulé, hachuré absent) : Aujourd'hui (avec les noms), Semaine, Mois.
- Toucher une séance : l'élève, la date, son étape, la dernière remarque, ses questions et demandes d'aide récentes (ou « Aucune »).
- Côté élève : quand un coaching approche (aujourd'hui ou demain), « Ton coaching approche : un problème ? Dis-le à ton coach » (Demander de l'aide),
  et le rappel de Bob propose le même bouton.

## « Mon coach me livre un compte »

- Étape 4, première question du compte TikTok : 3e choix « Mon coach me livre un compte prêt » (avec une précision facultative).
- L'élève voit « En préparation » (et peut annuler s'il a finalement son compte) ; la demande arrive dans À traiter et par Bob.
- Fiche de l'élève → Compte TikTok → « Livrer le compte » : le lien et un message. Le compte est validé d'office, l'élève est prévenu
  et passe au choix de ses 3 heures. Jamais de mot de passe sur la plateforme : les identifiants s'envoient en message privé.

## Lancement des calls de coaching

- Le lien du salon de coaching privé est réglé par défaut ; Gestion → « Lancement des calls » permet de le changer.
- 10 minutes avant chaque séance, Bob t'écrit en privé : « Call avec X dans 10 minutes. J'envoie l'invitation au call ? » (bouton Oui).
- Oui : l'élève reçoit « Ton coaching commence » avec le bouton « Rejoindre le call », une seule fois ; Bob te confirme en privé
  (« Lien du call envoyé »). Sans réponse, 5 minutes avant, Bob envoie tout seul le lien du salon à l'élève et à toi.
  Le même bouton existe sur la page de la séance (Calendrier → la séance).
