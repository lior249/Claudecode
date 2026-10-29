# PlugBot — événements et lives

Ce document décrit comment PlugBot planifie les événements de la semaine, et tous les modèles de messages.

Toutes les heures sont en **GMT**.

---

## 1. Le fonctionnement

### Le salon de planification

Un salon privé, **#plugbot-planning**, visible seulement par toi et PlugBot. C'est là que PlugBot te pose ses questions.

En haut du salon, PlugBot épingle un **panneau** :

- **un bouton par type de live** (14 boutons) : un clic ouvre un ticket pour ce live ;
- **un menu** pour ouvrir plusieurs tickets d'un coup : coche tous les types que tu veux, un ticket s'ouvre pour chacun ;
- **✅ Planning terminé** : à cliquer quand tu as fini de planifier la semaine (plus de relance) ;
- **📋 Événements à venir** : la liste des événements programmés, avec un lien vers leur ticket.

### La demande du planning

PlugBot te demande le programme de la semaine qui commence le lundi :

| Jour | Heures |
|---|---|
| Dimanche | 9 h, puis 15 h et 18 h si tu n'as pas cliqué sur « Planning terminé » |
| Lundi | 9 h, 15 h et 18 h si tu n'as toujours pas cliqué |

Il s'arrête dès que tu cliques sur **✅ Planning terminé**, et ne relance plus après le lundi 18 h.

> @toi
> 📅 **Planning de la semaine du lundi 2 novembre au dimanche 8 novembre**
> Salut ! Quels événements sont prévus cette semaine ?
> Déjà au programme : 🔴 Live accompagnement — mercredi 4 novembre à 22 h 00 (GMT) et vendredi 6 novembre à 22 h 00 (GMT).
>
> Crée tes lives avec le panneau en haut du salon (un ticket par live), puis clique sur **✅ Planning terminé**.

Les relances :

> @toi ⏰ Petit rappel : le planning de la semaine n'est pas encore fait. Utilise le panneau en haut du salon, puis clique sur **✅ Planning terminé**.

### Un ticket par événement

Chaque ticket est un **fil** dans #plugbot-planning. Il contient deux messages :

1. **Les réglages**, avec des menus :
   - **Public** : Free ou Accompagnement (absent pour le coaching gratuit, réservé aux Free, et pour le live accompagnement). Il décide du salon d'annonce : annonces free ou annonces accompagnement.
   - **Lieu** : un salon vocal ou « stage » du serveur.
   - **Texte de présentation** : les modèles prévus pour ce type et ce public, ou « Aucun modèle, seulement mon texte ».
   - **Rôles à mentionner** : @everyone, Free, TikTok (un, plusieurs ou aucun).
   - **Rappels** : à la création (l'annonce), 7 jours, 3 jours, 24 heures et 3 heures avant. Tout est coché au départ.
2. **Le résumé**, avec des boutons :
   - **📝 Sujet, date, heure** : un formulaire avec le sujet, la date (JJ/MM), l'heure en GMT (HH:MM), la durée en minutes et un texte libre pour donner envie ;
   - **🔗 Lien externe** : un lien YouTube, Zoom, Google Meet… à la place d'un salon du serveur ;
   - **👁️ Aperçu** : tous les messages qui partiront, avec leur date d'envoi, sans notifier personne ;
   - **✅ Valider** et **🗑️ Supprimer** (pour un brouillon).

Un rappel déjà passé au moment de la validation est ignoré. Par exemple, pas de rappel « 7 jours avant » pour un live dans 4 jours.

Dès que tu cliques sur **✅ Valider** :
- l'événement Discord est créé ;
- l'annonce part tout de suite ;
- les autres rappels sont programmés.

**Le ticket reste ouvert jusqu'à la fin du live**, pour que tu puisses encore le modifier. Les boutons deviennent :

- **💾 Enregistrer les changements** : l'événement Discord et les rappels sont mis à jour. Si la date, l'heure ou le lieu changent, les membres sont prévenus.
- **❌ Annuler l'événement** : l'événement et ses rappels sont supprimés, et les membres sont prévenus si l'annonce était déjà partie.

À la fin du live, PlugBot publie le sondage d'avis, puis ferme le ticket.

### Les lives de l'accompagnement (mercredi et vendredi, 22 h)

Le jour du live, à **9 h**, PlugBot te demande dans #plugbot-planning si le live est maintenu. Il relance à 12 h et 15 h si tu n'as pas répondu.

> @toi 🔴 **Live accompagnement ce soir à 22 h 00 (GMT)** : il est maintenu ?
> Réagis avec 👍 pour le confirmer ou ❌ pour l'annuler. PlugBot prévient ensuite les membres de l'accompagnement.

- **👍** : PlugBot annonce le live dans le salon annonces accompagnement, en mentionnant le rôle TikTok, avec un sondage de présence qui se ferme à 22 h.
- **❌** : PlugBot prévient les membres de l'accompagnement, dans le même salon, qu'il n'y a pas de live ce soir.
- **Pas de réponse** : rien n'est publié.

### Après le live

Le **sondage d'avis** est publié à la fin du live, dans le salon de l'annonce. Il reste ouvert 24 heures.
Les points de présence ne sont pas comptés pour l'instant.

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

### Jour du live de l'accompagnement (confirmé avec 👍)

> @TikTok
> ✅ **Live confirmé ce soir à 22 h 00 (GMT) !** Rendez-vous ce soir 🔥
> Live réservé aux membres de l'accompagnement. Dis-nous dans le sondage si tu seras là 👇
>
> 🕒 **L'heure chez toi :**
> {horaires}

Avec le sondage : « Tu participes au live de ce soir ? », ✅ Oui, je serai là / ❌ Non, je ne pourrai pas. Il se ferme au début du live.

### Jour du live de l'accompagnement (annulé avec ❌)

> @TikTok
> ❌ **Pas de live ce soir.** Le live de l'accompagnement prévu à 22 h 00 (GMT) est annulé. On se retrouve au prochain live !

### Fin du live (sondage d'avis)

> 🙏 Merci d'avoir participé à **{titre}** ! Ton avis nous aide à faire encore mieux 👇

Sondage : « Comment as-tu trouvé le live ? », 🔥 Excellent / 👍 Bien / 😐 Moyen / 👎 Décevant. Il reste ouvert 24 heures.

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
