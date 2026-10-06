#!/usr/bin/env bash
# Met en ligne la page TikTok Elite (dossier landing/) à la place de l'application Creato.
# L'application est mise en pause : plus aucun message Discord ni notification. Rien n'est effacé.
# Usage (dans /opt/creato) : ./deploy/landing.sh
# Pour revenir à l'application plus tard : docker rm -f creato-landing && docker compose up -d
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d'"' -f2)
[ -n "$DOMAIN" ] || { echo "DOMAIN manquant dans .env"; exit 1; }

echo "▶ Mise en pause de l'application Creato (site, worker, bot, base)…"
docker compose stop

echo "▶ Mise en ligne de la page sur https://$DOMAIN …"
docker rm -f creato-landing >/dev/null 2>&1 || true
# Réutilise le volume des certificats HTTPS déjà obtenus par l'application.
docker run -d --name creato-landing --restart unless-stopped \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -e DOMAIN="$DOMAIN" \
  -v "$ROOT/landing:/srv:ro" \
  -v "$ROOT/deploy/Caddyfile.landing:/etc/caddy/Caddyfile:ro" \
  -v creato_caddy_data:/data \
  -v creato_caddy_config:/config \
  caddy:2-alpine >/dev/null

sleep 5
if curl -fsS -o /dev/null "https://$DOMAIN/"; then
  echo "✅ La page est en ligne : https://$DOMAIN"
else
  echo "⏳ La page démarre. Ouvre https://$DOMAIN dans une minute. En cas de souci : docker logs creato-landing --tail 30"
fi
