#!/usr/bin/env bash
# Installation complète de Creato sur un serveur Ubuntu 24.04 neuf.
# Usage (en root, dans /opt/creato) : ./deploy/install.sh
# Sans danger à relancer : il ne refait que ce qui manque.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Lance ce script en root (sudo)."; exit 1; }

say "Mise à jour du système et outils de base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl openssl ufw unattended-upgrades cron >/dev/null

say "Pare-feu : seulement SSH, HTTP et HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443 >/dev/null
ufw --force enable >/dev/null

if ! swapon --show | grep -q .; then
  say "Mémoire d'appoint (swap 2 Go)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  say "Installation de Docker"
  curl -fsSL https://get.docker.com | sh >/dev/null
fi

if [ ! -f .env ]; then
  say "Création du fichier de réglages .env"
  cp deploy/env.production.example .env
  sed -i "s|^POSTGRES_PASSWORD=\"\"|POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\"|" .env
  sed -i "s|^SESSION_SECRET=\"\"|SESSION_SECRET=\"$(openssl rand -hex 32)\"|" .env
  chmod 600 .env
fi

missing=()
for key in DISCORD_CLIENT_SECRET DISCORD_BOT_TOKEN ANTHROPIC_API_KEY; do
  grep -Eq "^$key=\"[^\"]+\"" .env || missing+=("$key")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "Il manque dans .env : ${missing[*]}"
  echo "Ouvre le fichier avec :  nano $ROOT/.env   (colle les valeurs, Ctrl+O, Entrée, Ctrl+X)"
  echo "Puis relance :           sudo ./deploy/install.sh"
  exit 1
fi

say "Construction et démarrage (quelques minutes la première fois)"
docker compose up -d --build

say "Sauvegarde automatique chaque nuit à 3 h 30"
chmod +x deploy/*.sh
CRON="30 3 * * * $ROOT/deploy/backup.sh >> /var/log/creato-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' ; echo "$CRON" ) | crontab -

say "Vérification"
for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d'"' -f2)
    echo "✅ Creato tourne. Ouvre https://$DOMAIN (le certificat HTTPS peut prendre 1 minute)."
    docker compose ps
    exit 0
  fi
  sleep 4
done
echo "⚠️ Le site ne répond pas encore. Regarde les messages avec : docker compose logs app --tail 50"
exit 1
