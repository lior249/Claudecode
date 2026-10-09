# Creato — Learn

Projet repris depuis zéro.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet. Elles priment sur la spécification.

## Site Creato (Netlify)

Pages :
- `/` (`site/index.html`) : vidéo, résultats clients, « Pour qui ? », FAQ, réservation d'un appel ;
- `/paiement/` (`site/paiement/`) : page TikTok Elite (lien envoyé après l'appel, aucun lien depuis `/`).
  Carte bancaire → Maketou, mobile money → SasPay ; code d'accès et lien de la communauté après paiement confirmé.

Fonctions (`netlify/functions/`) :
- `/api/creneaux`, `/api/reserver` : réservation d'appels, gardées dans Netlify Blobs (magasin `reservations`).
  Jours, heures et durée : `netlify/lib/agenda.mjs`.
- `/api/checkout`, `/api/status`, `/api/saspay/webhook` : paiement Maketou ou SasPay (magasin `paiements`).
  Maketou : https://docs-api.maketou.com (panier `POST /api/v1/stores/cart/checkout`, accès seulement si le panier est `completed`).

Variables d'environnement à saisir dans Netlify (jamais dans le dépôt) :
- Discord, au choix : `DISCORD_WEBHOOK_URL` (message dans un salon), ou `DISCORD_BOT_TOKEN` + `DISCORD_USER_ID` (message privé du bot).
  Sans l'un des deux, les réservations sont fermées. Les paiements réussis y sont aussi annoncés.
- Un moyen de paiement dont les réglages manquent reste fermé ; l'autre fonctionne.
- Maketou (carte) : `MAKETOU_API_KEY` (Maketou → boutique → Autres → Clés API), `MAKETOU_PRODUCT_ID`
  (fiche du produit → Partager → Identifiant public du produit). Le prix facturé est celui du produit dans Maketou.
- SasPay (mobile money) : `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `SASPAY_AMOUNT` (ex. `120.00`), `SASPAY_CURRENCY` (ex. `EUR`), `SASPAY_DESCRIPTION`.
- Accès après paiement : `ACCESS_CODE`, `COMMUNITY_URL`.
- `SITE_URL` (ex. `https://creatoskills.site`) : adresse de retour après paiement (sinon l'adresse principale du site Netlify).
- Webhook à créer dans SasPay : `<adresse du site>/api/saspay/webhook` (événement `transaction.success`).

Tests : `npm test` (lancés aussi à chaque déploiement Netlify : un test raté bloque la mise en ligne).
