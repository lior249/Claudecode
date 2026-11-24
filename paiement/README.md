# Paiement mobile money (SasPay) → accès Whop → Discord

Site de paiement en mobile money pour Overmaxx : **29 € d'inscription** (30 premiers jours inclus),
puis **5 € par mois** pour garder l'accès. Whop héberge la formation, mais ne propose pas le mobile money :
ce site encaisse via **SasPay**, vérifie le paiement puis débloque l'accès.

## Le parcours

| Étape | Page | Ce qui se passe |
|---|---|---|
| 1 | `/` | Page d'accueil : infos, prix, bouton **« Payer par mobile money »** |
| 2 | `/paiement` | Nom, email du compte Whop, numéro (optionnel) |
| 3 | page SasPay | Le client paie (Wave, Orange Money, MTN, Moov, carte…) |
| 3 bis | `/confirmation/:ref` | Page « Ta commande » : onglet **Statut** (frise qui se met à jour toutes les 3 s → **Paiement confirmé** ou **Paiement non confirmé**) et onglet **Détails** (ce que le client a rempli) |
| 4 | `/acces/:ref` | Redirection automatique vers le guide : vidéo Wistia (`WISTIA_MEDIA_ID`), code unique, étapes écrites |

**Renouvellement** : `/renouveler` → page SasPay → chargement → `/renouvele/:ref`
(« Abonnement renouvelé, retourne sur le Discord »). Chaque renouvellement ajoute 30 jours à la date de fin,
même si le membre paie en avance.

Le bot Discord pourra envoyer à chaque membre son **lien personnel** de renouvellement
(`lienRenouvellement(config, email)` dans `src/app.js`) : l'email y est déjà rempli et ne peut pas être modifié.

## Comment l'accès est protégé

- Le serveur ne croit jamais la page de retour : il **revérifie chaque paiement auprès de SasPay** (statut, devise, montant).
- Le webhook SasPay (`/webhooks/saspay`) est vérifié par signature HMAC + horodatage (5 min max). Il donne l'accès
  même si le client ferme la page avant la fin.
- Le code Whop est **à -100 %, utilisable une seule fois, valable uniquement sur l'offre cachée**. Un même paiement
  donne toujours le même code : un rechargement de page ou un webhook rejoué ne crée jamais de doublon.
- La base SQLite (`FICHIER_BASE`) garde les membres et leur **date de fin d'accès** : c'est ce que le bot lira.

## Mise en place (en sandbox d'abord)

### 1. Whop (sandbox : https://sandbox.whop.com)

1. Crée une **offre cachée** pour les membres mobile money, en paiement unique (par exemple 29 €), sans
   abonnement Whop : c'est notre site qui gère le mensuel. Elle n'est débloquée qu'avec un code -100 %.
   N'utilise pas une offre gratuite : quiconque aurait le lien pourrait entrer.
2. Note l'identifiant de l'offre (`plan_...`) → `WHOP_PLAN_ID`, et sa devise → `WHOP_DEVISE_OFFRE`.
3. Note l'identifiant de ton entreprise (`biz_...`) → `WHOP_COMPANY_ID`.
4. Tableau de bord → Développeur : crée une clé API qui peut créer des codes promo et lire les offres → `WHOP_API_KEY`.
5. **Discord** : ajoute l'application Discord au produit, relie ton serveur et choisis le rôle à donner.

### 2. SasPay (sandbox : https://app.saspay.me en mode Sandbox)

1. Développeur → clé API `sk_test_...` avec le scope `PAYIN` → `SASPAY_API_KEY`.
2. Développeur → Webhooks : webhook vers `https://TON-SERVEUR/webhooks/saspay`, abonné à `transaction.success`.
   **Copie le secret de signature tout de suite** : il ne s'affiche qu'une fois → `SASPAY_WEBHOOK_SECRET`.

### 3. Hébergement

Sur ton serveur Namecheap : suis **`DEPLOIEMENT.md`** (Docker + Caddy, à côté de creatoskills.site). Ailleurs :

1. Déploie le dossier `paiement/` avec **Node 22.13 minimum** (commande de démarrage : `npm start`).
2. Ajoute un **volume persistant** et fais pointer `FICHIER_BASE` dessus (sinon les membres sont perdus à chaque redéploiement).
3. Renseigne les variables de `.env.example`. `BASE_URL` = l'URL publique du site.
4. Génère `APP_SECRET` une fois pour toutes et ne le change plus (codes et liens de renouvellement en dépendent) :
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 4. Tester en sandbox

1. Paie avec un **numéro de test SasPay finissant par 0** : chargement → « Paiement confirmé » → tutoriel avec le code.
2. Vérifie dans Whop (sandbox) que le code existe, utilise-le, puis connecte Discord.
3. Numéro finissant par `1` : « Paiement non confirmé », aucun code créé.
4. Va sur `/renouveler` avec le même email : la date de fin avance de 30 jours.

### 5. Passage en production

Remplace en même temps : `SASPAY_API_URL=https://api.saspay.me/api/v1`, la clé `sk_live_...`, le secret du webhook de
production, `WHOP_API_URL=https://api.whop.com/api/v1`, ainsi que la clé, `WHOP_COMPANY_ID` et `WHOP_PLAN_ID` de production.

## Personnaliser

- Textes de la page d'accueil (accroche, avantages) : `CONTENU`, en haut de `src/pages.js`.
- Direction artistique Overmaxx (noir et blanc, logo glitch, globe en pointillés) : bloc `STYLE` du même fichier.
- Vidéo du guide : mets l'identifiant Wistia dans `WISTIA_MEDIA_ID` (la fin de l'URL `wistia.com/medias/...`).

## À venir : le bot Discord

Il lira la table `membres` (`acces_jusqu_au`) pour envoyer les rappels avec le lien de renouvellement, puis retirer
l'accès à l'expiration. Il faudra d'abord relier chaque membre à son compte Discord (`discord_id`).

## Tests

```bash
npm install
npm test
```
