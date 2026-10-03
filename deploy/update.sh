#!/usr/bin/env bash
# Met le site à jour avec la dernière version sur GitHub (sauvegarde d'abord).
set -euo pipefail
cd "$(dirname "$0")/.."
./deploy/backup.sh
git pull --ff-only
docker compose up -d --build
# Libère l'espace disque : anciennes images et cache de construction (plusieurs Go à chaque mise à jour).
docker image prune -af >/dev/null
docker builder prune -af >/dev/null
docker compose ps
