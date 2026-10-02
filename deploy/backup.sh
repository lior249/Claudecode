#!/usr/bin/env bash
# Sauvegarde quotidienne : base de données (14 jours gardés) + fichiers envoyés (7 jours gardés).
# Lancée chaque nuit par cron (installé par install.sh). À la main : sudo /opt/creato/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${BACKUP_DIR:-/var/backups/creato}"
mkdir -p "$DEST"
chmod 700 "$DEST"
STAMP="$(date +%F-%H%M)"

docker compose exec -T db pg_dump -U creato -Fc creato > "$DEST/db-$STAMP.dump.tmp"
mv "$DEST/db-$STAMP.dump.tmp" "$DEST/db-$STAMP.dump"
docker run --rm -v creato_storage:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/files-$STAMP.tar.gz" -C /data .

find "$DEST" -name 'db-*.dump' -mtime +14 -delete
find "$DEST" -name 'files-*.tar.gz' -mtime +7 -delete
echo "[sauvegarde] $(date) : db-$STAMP.dump ($(du -h "$DEST/db-$STAMP.dump" | cut -f1)), files-$STAMP.tar.gz"
