# PlugBot — événements et lives (proposition)

Ce document décrit comment PlugBot planifiera les événements de la semaine, et tous les modèles de messages.
**Rien n'est encore codé** : relis, corrige, puis on passe au code.

Toutes les heures sont en **GMT**.

---

## 1. Le fonctionnement

### Le salon de planification

Un salon privé, par exemple **#plugbot-planning**, visible seulement par toi et PlugBot. C'est là que PlugBot te pose ses questions.

### La demande du planning

PlugBot te demande le programme de la semaine qui commence le lundi :

| Jour | Heures |
|---|---|
| Dimanche | 9 h, puis 15 h et 18 h si tu n'as pas répondu |
| Lundi | 9 h, 15 h et 18 h si tu n'as toujours pas répondu |

Il s'arrête dès que tu as répondu, et ne relance plus après le lundi 18 h.

> 📅 **Planning de la semaine du 2 au 8 novembre**
> Salut ! Quels événements sont prévus cette semaine ?
> Déjà au programme : 🔴 Live accompagnement — mercredi et vendredi à 22 h 00 (GMT).
>
> [➕ Ajouter un événement] [✅ Planning terminé] [🚫 Rien de plus cette semaine]

Les relances :

> ⏰ Petit rappel : le planning de la semaine n'est pas encore fait.

### Un ticket par événement

Le bouton **➕ Ajouter un événement** ouvre un **fil privé** (le ticket) dans #plugbot-planning, un par événement.
Ça reste lisible même avec beaucoup d'événements : chaque ticket a son nom, et il se ferme une fois l'événement validé.

Dans le ticket, PlugBot pose les questions une par une, avec des menus et des cases à remplir (aucune IA) :

1. **Type de live** : un menu avec les 14 types (voir plus bas).
2. **Public** : Accompagnement ou Free. Il décide du salon d'annonce :
   - Free : salon annonces free (`1540657873468653653`) ;
   - Accompagnement : salon annonces accompagnement (`1551373510180347904`).
3. **Formulaire** : sujet (titre), date, heure de début, durée, et un texte libre facultatif pour développer le sujet.
4. **Lieu** : un menu avec les salons vocaux et « stage » du serveur, ou « Lien externe » (YouTube, Zoom, Google Meet…), comme quand on crée un événement Discord à la main.
5. **Texte de présentation** : PlugBot propose les modèles prévus pour ce type et ce public. Tu en choisis un, ou tu écris le tien.
6. **Rôles à mentionner** : un menu à choix multiples (@everyone, Free, TikTok…).
7. **Rappels** : des cases à cocher, toutes cochées au départ :
   - au moment de la création (l'annonce) ;
   - 7 jours avant ;
   - 3 jours avant ;
   - 24 heures avant ;
   - 3 heures avant.

   Un rappel déjà passé au moment de la création est ignoré. Par exemple, pas de rappel « 7 jours avant » pour un live dans 4 jours.
8. **Aperçu** : PlugBot montre l'événement Discord et **tous les messages** qui vont partir, avec leur date et leur heure.

   [✅ Valider] [✏️ Modifier] [🗑️ Supprimer]

Dès que tu valides :
- l'événement Discord est créé ;
- l'annonce part tout de suite ;
- les autres rappels sont programmés ;
- le ticket se ferme.

### La commande /event

Elle affiche la liste des événements à venir. Tu en choisis un, puis :

- **Modifier** : date, heure, lieu, texte, rôles ou rappels. PlugBot met l'événement Discord à jour et peut annoncer le changement.
- **Annuler** : l'événement et ses rappels sont supprimés, et un message d'annulation est publié si tu le veux.

### Les lives de l'accompagnement (mercredi et vendredi, 22 h)

Ce sont des événements qui reviennent chaque semaine. Ils sont déjà dans le planning du dimanche, et tu peux en enlever un.
Le jour du live, PlugBot reconfirme aux membres de l'accompagnement qu'il y a bien live, avec un sondage de présence (voir les modèles).

### Après le live

- **Sondage d'avis** : publié à la fin du live, dans le salon de l'annonce, ouvert 24 heures.
- **Présences** (lives dans un salon vocal ou « stage » de Discord seulement) : PlugBot note qui était là et lui donne des points PlugBot. Pour un lien externe (YouTube, Zoom…), il ne peut pas savoir qui était présent.

### L'heure chez toi

Chaque annonce affiche l'heure GMT, puis l'heure locale par fuseau, avec **5 pays francophones au maximum par ligne**.
Les changements d'heure sont pris en compte automatiquement (la France passe d'une ligne à l'autre entre l'hiver et l'été).

Exemple pour un live à 22 h GMT, en hiver :

> 🕒 **L'heure chez toi :**
> **22 h 00** — 🇸🇳 Sénégal · 🇨🇮 Côte d'Ivoire · 🇲🇱 Mali · 🇧🇫 Burkina Faso · 🇹🇬 Togo
> **23 h 00** — 🇨🇲 Cameroun · 🇧🇯 Bénin · 🇨🇬 Congo · 🇲🇦 Maroc · 🇫🇷 France
> **00 h 00 (jeudi)** — 🇨🇩 RDC (Lubumbashi) · 🇷🇼 Rwanda · 🇧🇮 Burundi
> **01 h 00 (jeudi)** — 🇲🇬 Madagascar · 🇰🇲 Comores · 🇩🇯 Djibouti
> **02 h 00 (jeudi)** — 🇷🇪 La Réunion · 🇲🇺 Maurice

---

## 2. Les types de lives

| | Type | Public |
|---|---|---|
| 🔍 | Live découverte (présentation) | Free, Accompagnement |
| 🎯 | Coaching gratuit | Free |
| 🏆 | Unplug Awards (remise des prix) | Free, Accompagnement |
| ❓ | Questions-réponses | Free, Accompagnement |
| 🔬 | Analyse de comptes (hot seat) | Free, Accompagnement |
| 🎓 | Masterclass | Free, Accompagnement |
| 📈 | Tendances de la semaine | Free, Accompagnement |
| 💻 | Co-working « On poste ensemble » | Free, Accompagnement |
| 🎤 | Témoignage ou invité | Free, Accompagnement |
| 📊 | Bilan de la semaine ou du mois | Free, Accompagnement |
| 👋 | Accueil des nouveaux | Free, Accompagnement |
| ⚔️ | Battle ou défi | Free, Accompagnement |
| 📣 | Annonce et nouveautés | Free, Accompagnement |
| 🔴 | Live accompagnement (mercredi et vendredi) | Accompagnement |

---

## 3. Les modèles de messages

Les mots entre accolades sont remplis par PlugBot :

| Mot | Contenu |
|---|---|
| `{mention}` | les rôles choisis |
| `{emoji}` et `{type}` | le type de live |
| `{titre}` | le sujet |
| `{texte}` | le modèle de présentation choisi (section 4), suivi de ton texte libre si tu en as écrit un |
| `{date}` | « mercredi 5 novembre » |
| `{heure}` | « 22 h 00 (GMT) » |
| `{horaires}` | l'heure chez toi, par fuseau |
| `{lieu}` | le salon vocal ou le lien externe |
| `{lien}` | le lien de l'événement Discord |

### L'annonce (au moment de la création)

> {mention}
> {emoji} **{type} — {titre}**
> {texte}
>
> 📅 {date} à {heure}
> 📍 {lieu}
>
> 🕒 **L'heure chez toi :**
> {horaires}
>
> 👉 Clique sur **« Intéressé »** pour être prévenu au début du live : {lien}

### 7 jours avant

> {mention}
> 📌 **Dans une semaine** : {emoji} {type} — **{titre}**
> 📅 {date} à {heure} · 📍 {lieu}
> 👉 Note-le et clique sur **« Intéressé »** : {lien}

### 3 jours avant

> {mention}
> ⏳ **Plus que 3 jours** avant {emoji} **{titre}** !
> 📅 {date} à {heure} · 📍 {lieu}
> 👉 Clique sur **« Intéressé »** pour ne pas le rater : {lien}

### 24 heures avant

> {mention}
> 🔔 **C'est demain !** {emoji} **{titre}**
> 📅 {date} à {heure} · 📍 {lieu}
>
> 🕒 **L'heure chez toi :**
> {horaires}
>
> 👉 {lien}

### 3 heures avant

> {mention}
> 🚨 **Dans 3 heures !** {emoji} **{titre}** commence à {heure}.
> 📍 {lieu}
> 👉 Clique sur **« Intéressé »** pour être prévenu au lancement : {lien}

### Jour du live de l'accompagnement (reconfirmation)

> {mention}
> ✅ **Live confirmé ce soir à 22 h 00 (GMT)**
> Live réservé aux membres de l'accompagnement. Dis-nous dans le sondage si tu seras là 👇
>
> 🕒 **L'heure chez toi :**
> {horaires}

Avec le sondage : « Tu participes au live de ce soir ? », ✅ Oui, je serai là / ❌ Non, je ne pourrai pas. Il se ferme au début du live.

### Fin du live (sondage d'avis)

> 🙏 Merci d'avoir participé à **{titre}** ! Ton avis nous aide à faire encore mieux 👇

Sondage : « Comment as-tu trouvé le live ? », 🔥 Excellent / 👍 Bien / 😐 Moyen / 👎 Décevant. Il reste ouvert 24 heures.

### Présences

> 🎟️ Merci aux **{nombre} membres** présents au live **{titre}** ! Chacun gagne des points PlugBot.

### Modification

> {mention}
> ✏️ **Changement pour {emoji} {titre}**
> Nouvel horaire : 📅 {date} à {heure} · 📍 {lieu}
> 👉 {lien}

### Annulation

> {mention}
> ❌ **{emoji} {titre}** du {date} est annulé. Désolé pour le changement, on se retrouve très vite !

---

## 4. Les textes de présentation, par type et par public

C'est le `{texte}` de l'annonce. Tu choisis le modèle au moment de créer l'événement, et tu peux toujours le compléter avec ton propre texte.

### 🔍 Live découverte (présentation)

**Free**
1. Tu veux savoir comment des gens comme toi font de l'argent sur TikTok avec juste leur téléphone ? Ce live t'ouvre les coulisses : ce qui marche vraiment, sans blabla.
2. Nouveau sur Unplug, ou encore en train d'hésiter ? En un live, tu vas comprendre toute la méthode et repartir avec un plan clair pour tes prochaines vidéos.
3. On lève le voile sur une stratégie que peu de gens connaissent. Viens la découvrir, poser tes questions et voir si c'est fait pour toi.

**Accompagnement**
1. Nouvelle stratégie à découvrir, en exclusivité pour l'accompagnement. On la décortique ensemble, et tu l'appliques dès demain.
2. On t'emmène plus loin : un nouveau levier pour accélérer tes résultats, présenté étape par étape.
3. Une nouveauté réservée aux membres, à découvrir en avant-première, avant tout le monde.

### 🎯 Coaching gratuit (Free)

> Coaching gratuit en direct : tu viens avec ton blocage, on le règle ensemble.
> **Qui peut participer ?** Les membres Free qui ne sont pas en prison.
> **Comment s'inscrire ?** Clique sur « Intéressé » sur l'événement.
> **À préparer :** le lien de ton compte TikTok et ta question principale.

### 🏆 Unplug Awards

- **Free** : C'est l'heure de récompenser ceux qui n'ont rien lâché ! Les gagnants du top 7, du top 30 et des 21 jours d'affilée sont célébrés en direct. Viens applaudir… et prendre des idées pour être sur scène la prochaine fois.
- **Accompagnement** : Les Unplug Awards de l'accompagnement : on célèbre vos résultats, vos progrès et vos meilleures vidéos. C'est peut-être ton nom qu'on va appeler.

### ❓ Questions-réponses

- **Free** : Une question te bloque ? Viens la poser en direct, on y répond sans détour.
- **Accompagnement** : Questions-réponses réservées à l'accompagnement : ramène tes blocages, on les débloque ensemble.

### 🔬 Analyse de comptes (hot seat)

- **Free** : On analyse des comptes TikTok de membres en direct : ce qui marche, ce qui bloque, quoi changer. Tu apprendras autant en regardant les autres.
- **Accompagnement** : Hot seat : on passe vos comptes au crible, en direct. Prépare ton compte, c'est peut-être ton tour.

### 🎓 Masterclass

- **Free** : Une masterclass, un sujet, zéro remplissage. Tu repars avec des actions concrètes à appliquer tout de suite.
- **Accompagnement** : Masterclass exclusive : on va au fond du sujet, avec des exemples et la méthode complète.

### 📈 Tendances de la semaine

- **Free** : Les sons, formats et sujets qui explosent cette semaine sur TikTok. Viens avec ton téléphone : tu pourras filmer juste après.
- **Accompagnement** : Veille tendances de l'accompagnement : on choisit ensemble les formats à tourner cette semaine.

### 💻 Co-working « On poste ensemble »

- **Free** : On poste ensemble ! Une session pour créer et publier ta vidéo en direct avec les autres membres. Zéro excuse, show-up garanti.
- **Accompagnement** : Co-working de l'accompagnement : on tourne, on monte et on publie ensemble, avec de l'aide en direct.

### 🎤 Témoignage ou invité

- **Free** : Un membre qui était à ta place il y a quelques mois vient raconter son parcours, sans filtre.
- **Accompagnement** : Invité spécial pour l'accompagnement : son parcours, ses chiffres, ses erreurs. Viens avec tes questions.

### 📊 Bilan de la semaine ou du mois

- **Free** : Le bilan : les meilleurs, les progrès, les erreurs à éviter et les objectifs pour la suite.
- **Accompagnement** : Le bilan de l'accompagnement : vos résultats, vos chiffres et le plan d'action pour la suite.

### 👋 Accueil des nouveaux

- **Free** : Tu viens d'arriver sur Unplug ? Ce live t'explique tout : comment marche le serveur, les classements, la prison, et par où commencer dès ce soir.
- **Accompagnement** : Bienvenue dans l'accompagnement ! On fait le tour de tout ce qui t'attend et de tes premières étapes.

### ⚔️ Battle ou défi

- **Free** : Défi en direct ! Le meilleur repart avec la gloire, et peut-être plus. Prêt à relever le défi ?
- **Accompagnement** : Battle de l'accompagnement : montre ce que tu sais faire devant tout le groupe.

### 📣 Annonce et nouveautés

- **Free** : Grosse annonce sur Unplug : des nouveautés arrivent, et tu veux être le premier au courant.
- **Accompagnement** : Annonce importante pour l'accompagnement : les nouveautés, les changements et ce que ça change pour toi.

### 🔴 Live accompagnement (mercredi et vendredi)

- **Accompagnement** : Live de l'accompagnement : on avance ensemble sur tes vidéos, tes chiffres et tes questions.
