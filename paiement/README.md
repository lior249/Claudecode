# Paiement SasPay → accès Whop → Discord

Petit serveur Node.js : le client paie sur **SasPay** (mobile money ou carte). Une fois le paiement vérifié, il reçoit un
**code promo Whop unique à -100 %** pour l'offre cachée de la formation. Il rejoint ensuite le **Discord privé**
grâce à l'intégration Discord de Whop.

```
Page d'achat (nom + email du compte Whop)
  → POST /acheter : crée une session de checkout SasPay (avec l'email) puis redirige vers SasPay
  → le client paie
  → SasPay envoie le webhook transaction.success à /webhooks/saspay (signature HMAC vérifiée)
  → le serveur retrouve la session, revérifie le paiement auprès de SasPay (statut, devise, montant)
  → Whop : création du code promo -100 % (1 utilisation, uniquement sur l'offre cachée)
  → email au client (optionnel) + affichage du code sur /merci
  → le client entre le code sur Whop : il a l'accès
  → dans Whop, « Connecter Discord » : le bot Whop lui donne le rôle du serveur privé
```

Aucune base de données : le code promo est dérivé de la session de paiement (HMAC avec `APP_SECRET`). Un même paiement
donne donc toujours le même code, et un webhook rejoué ne crée jamais de doublon.

## Routes

| Route | Rôle |
|---|---|
| `GET /` | Page d'achat |
| `POST /acheter` | Crée la session SasPay et redirige vers la page de paiement |
| `GET /merci` | Retour après paiement : affiche le code et le lien Whop (ou « paiement en cours ») |
| `POST /webhooks/saspay` | Webhook SasPay (`transaction.success`) |
| `GET /sante` | Vérification que le serveur répond |

## Mise en place (en sandbox d'abord)

### 1. Whop (sandbox : https://sandbox.whop.com)

1. Crée le produit de la formation, puis une **offre payante** (paiement unique) au prix que tu veux afficher.
   **Mets-la en caché** : elle ne doit pas être visible sur ta page Whop.
2. Note l'identifiant de l'offre (`plan_...`) → `WHOP_PLAN_ID`, et sa devise → `WHOP_DEVISE_OFFRE`.
3. Note l'identifiant de ton entreprise (`biz_...`) → `WHOP_COMPANY_ID`.
4. Tableau de bord → Développeur : crée une clé API qui a le droit de créer des codes promo et de lire les offres → `WHOP_API_KEY`.
5. **Discord** : ajoute l'application Discord à ton produit, relie ton serveur et choisis le rôle à donner
   (par exemple @TikTok). Réserve tes salons privés à ce rôle.

### 2. SasPay (sandbox : https://app.saspay.me en mode Sandbox)

1. Développeur → clé API `sk_test_...` avec le scope `PAYIN` → `SASPAY_API_KEY`.
2. Développeur → Webhooks : crée un webhook vers `https://TON-SERVEUR/webhooks/saspay`, abonné à `transaction.success`.
   **Copie le secret de signature tout de suite** : il ne s'affiche qu'une fois → `SASPAY_WEBHOOK_SECRET`.

### 3. Hébergement (Railway, Render, VPS…)

1. Déploie le dossier `paiement/` (commande de démarrage : `npm start`, Node 20 minimum).
2. Renseigne les variables listées dans `.env.example`. Mets `BASE_URL` à l'URL publique du serveur.
3. Génère `APP_SECRET` une fois pour toutes, et ne le change plus : les codes déjà générés en dépendent.
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

### 4. Tester en sandbox

1. Ouvre le site, remplis le formulaire et paie avec un **numéro de test SasPay finissant par 0** (paiement réussi).
2. Tu dois arriver sur `/merci` avec le code. Vérifie dans Whop (sandbox) que le code promo existe.
3. Utilise le code sur le lien Whop : l'accès est donné, puis connecte Discord.
4. Teste aussi un numéro finissant par `1` (échec) : aucun code ne doit être créé.

### 5. Passage en production

Remplace en même temps : `SASPAY_API_URL=https://api.saspay.me/api/v1`, la clé `sk_live_...`, le secret du webhook de
production, `WHOP_API_URL=https://api.whop.com/api/v1`, ainsi que la clé, `WHOP_COMPANY_ID` et `WHOP_PLAN_ID` de production.
Les deux environnements ne partagent rien : ne les mélange jamais.

## Email (optionnel)

Avec `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` (compte sur resend.com, domaine vérifié), le client reçoit aussi son code
par email. Sans email, un client qui revient sur un autre navigateur que celui du paiement ne voit pas son code :
il faut alors le lui retrouver à la main (voir ci-dessous).

## Support : retrouver le code d'un client

Dans le dashboard SasPay, retrouve la session de checkout du client (son `id`), puis :

```bash
APP_SECRET=... node -e "console.log(require('./src/acces').codePourSession(process.argv[1], process.env.APP_SECRET))" ID_DE_SESSION
```

## Limites connues

- Le webhook SasPay ne contient pas l'email : le serveur retrouve la session parmi les plus récentes
  (`SASPAY_PAGES_RECHERCHE` × 100 sessions). Un paiement fait hors de ce tunnel (lien de paiement manuel) est ignoré
  après les 5 tentatives de SasPay.
- Remboursements : pas encore automatisés. Annule l'abonnement du client dans Whop, et le rôle Discord est retiré.
- Le code peut être utilisé par la personne à qui le client le transmet, mais une seule fois.

## Tests

```bash
npm install
npm test
```
