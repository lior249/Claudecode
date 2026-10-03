#!/usr/bin/env bash
# Remet Creato à zéro : supprime TOUS les utilisateurs, leur progression, tickets, posts, preuves, notifications,
# et tous les fichiers envoyés. Le parcours de départ est recréé (contenus provisoires à remplir dans l'Admin).
# Une sauvegarde est faite avant. Usage : ./deploy/reset.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "⚠️  Tous les utilisateurs et toutes les données de Creato vont être effacés (une sauvegarde est faite avant)."
read -r -p "Tape EFFACER pour confirmer : " ok
[ "$ok" = "EFFACER" ] || { echo "Annulé."; exit 1; }

./deploy/backup.sh
docker compose stop app worker
docker compose exec -T db psql -U creato -d creato -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('TRUNCATE %I CASCADE', t);
  END LOOP;
END $$;
SQL
docker run --rm -v creato_storage:/data alpine sh -c "rm -rf /data/*"
# Le service « migrate » recrée le parcours de départ au redémarrage.
docker compose up -d
echo "✅ Creato est remis à zéro. Reconnecte-toi avec Discord : tu redeviens admin et coach n° 1."
