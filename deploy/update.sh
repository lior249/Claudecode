#!/usr/bin/env bash
# Met le site à jour avec la dernière version sur GitHub (sauvegarde d'abord).
set -euo pipefail
cd "$(dirname "$0")/.."
./deploy/backup.sh
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
