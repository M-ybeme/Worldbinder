#!/usr/bin/env bash
# Milestone 14 Phase 12 — restores a pg_dump custom-format archive (as
# produced by backup.sh) into a target database. Same "run inside a
# throwaway postgres:17-alpine container" approach as backup.sh, for the
# same host-tooling-independence reason.
#
# This IS the project's designated migration-rollback procedure: drizzle-kit
# only generates forward migrations (no down-migrations by design), so
# recovering from a bad migration means restoring a pre-migration backup —
# there is no other rollback path. See docs/runbooks/backup-restore.md.
#
# Usage: infrastructure/scripts/restore.sh <dump-file> [target-database-url]
# Target defaults to $DATABASE_URL if the second argument is omitted.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_IMAGE="postgres:17-alpine"

if [ -z "${1:-}" ]; then
  echo "Usage: restore.sh <dump-file> [target-database-url]" >&2
  exit 1
fi

DUMP_FILE="$1"
TARGET_URL="${2:-${DATABASE_URL:-}}"

if [ -z "$TARGET_URL" ]; then
  echo "No target: pass a database URL as the second argument or set DATABASE_URL." >&2
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

REWRITTEN_URL="$(node "$SCRIPT_DIR/rewrite-url.js" "$TARGET_URL")"

echo "Restoring $DUMP_FILE into target database..."
# --clean --if-exists: drop existing objects before recreating them, so a
# restore onto a non-empty database (e.g. re-running a drill, or a real
# rollback onto the still-migrated database) ends up exactly matching the
# archive rather than erroring on already-existing tables.
docker run --rm -i "$PG_IMAGE" \
  pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$REWRITTEN_URL" \
  < "$DUMP_FILE"

echo "Restore complete."
