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
   https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=343865822227
   ```
   Ce lien donne à Bob ces droits : voir les salons, envoyer des messages, expulser des membres, gérer les rôles, gérer les salons et créer des invitations.
   Si Bob est déjà invité : **Paramètres du serveur** → **Rôles** → rôle de Bob → active **Gérer les salons**,
   **Créer des fils privés** et **Envoyer des messages dans les fils**.
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

Seule la page d'accueil (**overmaxx.online**) est ouverte à tous : logo, vidéo, bouton **Rejoindre le Discord**.
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
- Tutos vidéo des étapes : `WISTIA_ETAPE_1`, `WISTIA_ETAPE_2`, `WISTIA_ETAPE_3`.

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
