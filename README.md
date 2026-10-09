# Creato — Learn

Projet repris depuis zéro.

- `docs/SPEC.md` : spécification d'origine.
- `docs/DECISIONS.md` : décisions du porteur de projet. Elles priment sur la spécification.

## Site Creato (creatoskills.site)

Pages (`site/`) :
- `/` : vidéo, résultats clients, « Pour qui ? », FAQ, réservation d'un appel, puis renvoi vers Instagram ;
- `/paiement/` : page TikTok Elite (lien envoyé après l'appel, aucun lien depuis `/`).
  Carte bancaire → Maketou, mobile money → SasPay ; code d'accès et lien de la communauté après paiement confirmé.

Serveur : `serveur.mjs` (Node 22, aucune dépendance) sert `site/` et l'API :
- `/api/creneaux`, `/api/reserver` : réservation d'appels (jours, heures, durée : `lib/agenda.mjs`) ;
- `/api/checkout`, `/api/status`, `/api/saspay/webhook` : paiements (Maketou : https://docs-api.maketou.com) ;
- `/api/sante` : quels services sont actifs (aucun secret).
Données dans `DATA_DIR` (`lib/stockage.mjs`, un fichier JSON par réservation ou paiement).

### Mise en ligne sur le serveur

Guide pas à pas : `docs/MISE-EN-LIGNE.md`.

Première fois (connecté au serveur en `ssh root@<IP>`) :
```
git clone -b claude/laughing-wright-igl9h0 https://github.com/lior249/Claudecode.git /opt/creato-site
cd /opt/creato-site && ./deploy/site.sh     # crée seulement site.env (reprend /opt/creato/landing.env)
nano site.env                               # ajoute MAKETOU_API_KEY, Discord, etc.
./deploy/site.sh                            # relance avec les réglages
```
Mise à jour : `cd /opt/creato-site && git pull && ./deploy/site.sh`.
Réglages : `site.env` (modèle : `deploy/site.env.example`), jamais sur GitHub.
Webhook SasPay : `https://creatoskills.site/api/saspay/webhook` (événement `transaction.success`).
Paiements réussis : `docker exec creato-site grep -rl '"paid":true' /data/paiements/sessions`.
Revenir à l'ancienne page : `docker rm -f creato-site creato-https && cd /opt/creato && ./deploy/landing.sh`.

Tests : `npm test`. Essai en local : `SITE_ENV=./site.env DATA_DIR=./donnees PORT=8080 node serveur.mjs`.
