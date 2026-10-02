#!/usr/bin/env bash
# Restaure une sauvegarde de la base (et, si donnée, des fichiers).
# Usage : sudo ./deploy/restore.sh /var/backups/creato/db-AAAA-MM-JJ-HHMM.dump [/var/backups/creato/files-….tar.gz]
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP="${1:?Indique le fichier db-….dump à restaurer}"
FILES="${2:-}"
read -r -p "La base actuelle va être remplacée par $DUMP. Taper OUI pour continuer : " ok
[ "$ok" = "OUI" ] || { echo "Annulé."; exit 1; }

docker compose stop app worker
docker compose exec -T db pg_restore -U creato -d creato --clean --if-exists --no-owner < "$DUMP"
if [ -n "$FILES" ]; then
  docker run --rm -v creato_storage:/data -v "$(dirname "$(realpath "$FILES")")":/backup alpine \
    sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$FILES") -C /data"
fi
docker compose up -d
echo "Restauration terminée."
