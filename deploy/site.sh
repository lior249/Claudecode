#!/usr/bin/env bash
# Met en ligne le site Creato (page principale et page de paiement) sur ce serveur, en HTTPS.
# Usage (dans /opt/creato-site) : ./deploy/site.sh   — à relancer après chaque mise à jour (git pull) ou modification de site.env.
# Remplace la page TikTok Elite seule (conteneurs landing-app et creato-landing). Rien n'est effacé.
# Revenir à l'ancienne page : docker rm -f creato-site creato-https && cd /opt/creato && ./deploy/landing.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# ----- Réglages -----
if [ ! -f site.env ]; then
  cp deploy/site.env.example site.env
  chmod 600 site.env
  # Reprend les réglages de l'ancienne page de paiement (clé SasPay, code d'accès…) s'ils existent,
  # sauf le montant : le nouveau (115 € hors frais) reste celui du modèle.
  if [ -f /opt/creato/landing.env ]; then
    awk -v src=/opt/creato/landing.env '
      BEGIN { while ((getline l < src) > 0) if (l ~ /^[A-Z0-9_]+=/) { k = l; sub(/=.*/, "", k); if (k != "SASPAY_AMOUNT") v[k] = l } }
      /^[A-Z0-9_]+=/ { k = $0; sub(/=.*/, "", k); if (k in v) { print v[k]; next } }
      { print }' site.env > site.env.tmp && cat site.env.tmp > site.env && rm site.env.tmp
    echo "Réglages repris de /opt/creato/landing.env (SasPay, code d'accès, lien de la communauté)."
  fi
  echo "✅ Fichier de réglages créé : $ROOT/site.env"
  echo "   Ton site actuel n'a pas été touché."
  echo "   Étape suivante : nano site.env   (remplis les réglages), puis relance ./deploy/site.sh"
  exit 0
fi
rempli() { grep -Eq "^$1=(\"[^\"]+\"|[^\"[:space:]]+)" site.env; }
rempli MAKETOU_API_KEY || echo "⚠️  MAKETOU_API_KEY est vide : le paiement par carte sera fermé."
rempli SASPAY_API_KEY || echo "⚠️  SASPAY_API_KEY est vide : le paiement par mobile money sera fermé."
{ rempli ACCESS_CODE && rempli COMMUNITY_URL; } || echo "⚠️  ACCESS_CODE ou COMMUNITY_URL est vide : les deux paiements seront fermés."
DOMAIN=$(grep -E '^DOMAIN=' site.env | tail -1 | cut -d= -f2- | tr -d '"')
DOMAIN=${DOMAIN:-creatoskills.site}

# ----- Arrêt de l'ancienne page (l'application Creato reste en pause) -----
docker rm -f creato-landing landing-app >/dev/null 2>&1 || true
if [ -f /opt/creato/compose.yaml ]; then (cd /opt/creato && docker compose stop >/dev/null 2>&1) || true; fi

# ----- Démarrage -----
echo "▶ Démarrage du site sur https://$DOMAIN …"
docker network create creato-site >/dev/null 2>&1 || true
docker rm -f creato-site creato-https >/dev/null 2>&1 || true
docker run -d --name creato-site --restart unless-stopped --network creato-site \
  -e SITE_ENV=/run/site.env -e DATA_DIR=/data -e STATIC_DIR=/app/site \
  -v "$ROOT:/app:ro" \
  -v "$ROOT/site.env:/run/site.env:ro" \
  -v creato_site_data:/data \
  node:22-alpine node /app/serveur.mjs >/dev/null
# Réutilise le volume des certificats HTTPS déjà obtenus.
docker run -d --name creato-https --restart unless-stopped --network creato-site \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -e DOMAIN="$DOMAIN" \
  -v "$ROOT/deploy/Caddyfile.site:/etc/caddy/Caddyfile:ro" \
  -v creato_caddy_data:/data \
  -v creato_caddy_config:/config \
  caddy:2-alpine >/dev/null

sleep 6
docker logs creato-site 2>&1 | tail -4
if curl -fsS "https://$DOMAIN/api/sante"; then
  echo
  echo "✅ Le site est en ligne : https://$DOMAIN  (paiement : https://$DOMAIN/paiement/)"
else
  echo "⏳ Le site démarre. Ouvre https://$DOMAIN dans une minute. En cas de souci : docker logs creato-site --tail 30"
fi
