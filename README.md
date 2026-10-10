# Creato — Learn

Projet repris depuis zéro.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet. Elles priment sur la spécification.

## Site Creato (creatoskills.site)

Pages (`site/`) :
- `/` : vidéo, bouton « Je veux rejoindre maintenant », résultats clients, « Pour qui ? », FAQ, puis paiement ;
- `/paiement/` : page TikTok Elite (même paiement, autre présentation) ; `/paiement/merci.html` : validation et code.
Carte bancaire → Maketou, mobile money → SasPay ; code d'accès et lien de la communauté après paiement confirmé.

Serveur : `serveur.mjs` (Node 22, aucune dépendance) sert `site/` et l'API :
- `/api/checkout`, `/api/status`, `/api/saspay/webhook` : paiements (Maketou : https://docs-api.maketou.com) ;
- `/api/sante` : quels services sont actifs (aucun secret).
À chaque vente confirmée : message privé Discord du bot Creato, en embed (barre jaune, vignette `site/img/discord/argent.png`) (`DISCORD_BOT_TOKEN`, `DISCORD_USER_ID` ; `lib/discord.mjs`).
Test : `docker exec creato-site node /app/outils/tester-discord.mjs`.
Données dans `DATA_DIR` (`lib/stockage.mjs`, un fichier JSON par paiement).

### Mise en ligne sur le serveur

Guide pas à pas : `docs/MISE-EN-LIGNE.md`.

Première fois (connecté au serveur en `ssh root@<IP>`) :
```
git clone -b claude/laughing-wright-igl9h0 https://github.com/lior249/Claudecode.git /opt/creato-site
cd /opt/creato-site && ./deploy/site.sh     # crée seulement site.env (reprend /opt/creato/landing.env)
nano site.env                               # ajoute MAKETOU_API_KEY et le nouveau ACCESS_CODE
./deploy/site.sh                            # relance avec les réglages
```
Mise à jour : `cd /opt/creato-site && git pull && ./deploy/site.sh`.
Réglages : `site.env` (modèle : `deploy/site.env.example`), jamais sur GitHub.
Webhook SasPay : `https://creatoskills.site/api/saspay/webhook` (événement `transaction.success`).
Paiements réussis : `docker exec creato-site grep -rl '"paid":true' /data/paiements/sessions`.
Revenir à l'ancienne page : `docker rm -f creato-site creato-https && cd /opt/creato && ./deploy/landing.sh`.

Tests : `npm test`. Essai en local : `SITE_ENV=./site.env DATA_DIR=./donnees PORT=8080 node serveur.mjs`.
