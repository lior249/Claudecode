#!/usr/bin/env bash
# Met en ligne la page TikTok Elite (dossier landing/) à la place de l'application Creato.
# L'application est mise en pause : plus aucun message Discord ni notification. Rien n'est effacé.
# Usage (dans /opt/creato) : ./deploy/landing.sh   — à relancer après chaque modification de landing.env.
# Pour revenir à l'application plus tard : docker rm -f creato-landing landing-app && docker compose up -d
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d'"' -f2)
[ -n "$DOMAIN" ] || { echo "DOMAIN manquant dans .env"; exit 1; }

if [ ! -f landing.env ]; then
  cp deploy/landing.env.example landing.env
  chmod 600 landing.env
  echo "Fichier de réglages créé : $ROOT/landing.env"
fi
if ! grep -Eq '^SASPAY_API_KEY="[^"]+"' landing.env; then
  echo "⚠️  La clé SasPay n'est pas encore dans landing.env : la page sera en ligne, mais le paiement affichera « indisponible »."
  echo "    Pour l'ajouter : nano $ROOT/landing.env   puis relance ./deploy/landing.sh"
fi

echo "▶ Mise en pause de l'application Creato (site, worker, bot, base)…"
docker compose stop >/dev/null 2>&1 || true

echo "▶ Démarrage de la page sur https://$DOMAIN …"
docker network create creato-landing >/dev/null 2>&1 || true
docker rm -f creato-landing landing-app >/dev/null 2>&1 || true
docker run -d --name landing-app --restart unless-stopped --network creato-landing \
  -e LANDING_ENV=/run/landing.env -e STATIC_DIR=/app -e DATA_DIR=/data \
  -v "$ROOT/landing:/app:ro" \
  -v "$ROOT/landing.env:/run/landing.env:ro" \
  -v creato_landing_data:/data \
  node:22-alpine node /app/server.mjs >/dev/null
# Réutilise le volume des certificats HTTPS déjà obtenus par l'application.
docker run -d --name creato-landing --restart unless-stopped --network creato-landing \
  -p 80:80 -p 443:443 -p 443:443/udp \
  -e DOMAIN="$DOMAIN" \
  -v "$ROOT/deploy/Caddyfile.landing:/etc/caddy/Caddyfile:ro" \
  -v creato_caddy_data:/data \
  -v creato_caddy_config:/config \
  caddy:2-alpine >/dev/null

sleep 6
docker logs landing-app 2>&1 | tail -2
if curl -fsS -o /dev/null "https://$DOMAIN/"; then
  echo "✅ La page est en ligne : https://$DOMAIN"
else
  echo "⏳ La page démarre. Ouvre https://$DOMAIN dans une minute. En cas de souci : docker logs landing-app --tail 30"
fi
echo "Liste des paiements réussis : docker exec landing-app cat /data/paiements.jsonl"
