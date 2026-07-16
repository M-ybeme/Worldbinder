#!/usr/bin/env bash
# Milestone 14 Phase 12 — dumps the database at $DATABASE_URL to a local
# file. Runs pg_dump inside a throwaway postgres:17-alpine container
# (matching this repo's compose Postgres version) instead of requiring
# Postgres client tools on the host — the only real dependency is Docker,
# already required for local dev. rewrite-url.js handles the
# localhost -> host.docker.internal translation the throwaway container
# needs to reach local docker-compose Postgres; a real remote DATABASE_URL
# passes through unchanged, so this script needs no modification to back
# up a real deployed database later, only a different DATABASE_URL.
#
# Usage: DATABASE_URL=... infrastructure/scripts/backup.sh [output-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_IMAGE="postgres:17-alpine"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

OUTPUT_FILE="${1:-backup-$(date +%Y%m%dT%H%M%S).dump}"
REWRITTEN_URL="$(node "$SCRIPT_DIR/rewrite-url.js" "$DATABASE_URL")"

echo "Backing up database to $OUTPUT_FILE..."
# Custom format (-Fc): compressed, and the only format pg_restore's
# selective/parallel restore features support — plain SQL dumps can't do
# either. --no-owner/--no-privileges: a restore target's role names won't
# generally match the source's, so ownership/grant statements would just
# fail or restore the wrong owner; the schema/data is what matters here.
docker run --rm "$PG_IMAGE" \
  pg_dump --format=custom --no-owner --no-privileges "$REWRITTEN_URL" \
  > "$OUTPUT_FILE"

echo "Backup complete: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"
