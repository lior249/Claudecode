# Page TikTok Elite

- `index.html` : l'image, le titre, le prix, deux boutons (carte, mobile money) → nom + e-mail → paiement SasPay ;
- `merci.html` : retour de paiement. Le serveur demande à SasPay si le paiement est réussi : vert + code seulement si `SUCCESS` ;
- `server.mjs` : petit serveur sans dépendance (page + `/api/checkout`, `/api/status`, `/api/saspay/webhook`) ;
- `config.js` : réglages publics (prix affiché, liste des captures) ;
- `img/resultats/` : les captures de résultats (2 par ligne). Pour en ajouter : mets le fichier ici et ajoute son nom dans `results` de `config.js`.

Les secrets (clé SasPay, secret du webhook, montant facturé, code d'accès, lien de la communauté) sont dans
`/opt/creato/landing.env` sur le serveur (modèle : `deploy/landing.env.example`), jamais dans le dépôt.

## Mise en ligne (serveur /opt/creato)
```
cd /opt/creato && git pull && ./deploy/landing.sh
```
Webhook à créer dans SasPay : `https://creatoskills.site/api/saspay/webhook` (événement `transaction.success`).
Paiements réussis : `docker exec landing-app cat /data/paiements.jsonl`.
Revenir à l'application : `docker rm -f creato-landing landing-app && docker compose up -d`.
