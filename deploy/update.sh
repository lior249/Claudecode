#!/usr/bin/env bash
# Met le site à jour avec la dernière version sur GitHub (sauvegarde d'abord).
set -euo pipefail
cd "$(dirname "$0")/.."
./deploy/backup.sh
git pull --ff-only
# Depuis octobre 2026, l'IA est Claude (Anthropic) : sans sa clé, le nouveau site ne démarrerait pas.
sed -i 's/^AI_PROVIDER="gemini"/AI_PROVIDER="claude"/' .env
if ! grep -Eq '^ANTHROPIC_API_KEY="[^"]+"' .env; then
  echo "Il manque la clé Claude dans .env. Le site actuel continue de tourner, rien n'a changé."
  echo "Ouvre le fichier :  nano $(pwd)/.env"
  echo "Ajoute la ligne :   ANTHROPIC_API_KEY=\"ta clé\"   (console.anthropic.com → API Keys), Ctrl+O, Entrée, Ctrl+X"
  echo "Puis relance :      ./deploy/update.sh"
  exit 1
fi
docker compose up -d --build
# Libère l'espace disque : anciennes images et cache de construction (plusieurs Go à chaque mise à jour).
docker image prune -af >/dev/null
docker builder prune -af >/dev/null
docker compose ps
