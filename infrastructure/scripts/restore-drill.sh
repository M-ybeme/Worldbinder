#!/usr/bin/env bash
# Milestone 14 Phase 12 — rehearses the full backup -> restore mechanism
# end to end against local docker-compose Postgres, proving it actually
# works rather than being a paper exercise. Never touches the real dev
# database destructively: backs it up, restores that backup into a fresh,
# isolated scratch database, verifies row counts match, then drops the
# scratch database. A live drill against a real hosted Postgres instance
# is deferred to Milestone 16 once Railway exists — this is deliberately
# the local rehearsal only.
#
# Usage: DATABASE_URL=... infrastructure/scripts/restore-drill.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_IMAGE="postgres:17-alpine"
SCRATCH_DB="worldbinder_restore_drill"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set." >&2
  exit 1
fi

SOURCE_URL="$(node "$SCRIPT_DIR/rewrite-url.js" "$DATABASE_URL")"
ADMIN_URL="$(node "$SCRIPT_DIR/rewrite-url.js" "$DATABASE_URL" postgres)"
SCRATCH_URL="$(node "$SCRIPT_DIR/rewrite-url.js" "$DATABASE_URL" "$SCRATCH_DB")"
DUMP_FILE="restore-drill-$(date +%Y%m%dT%H%M%S).dump"

psql_exec() {
  docker run --rm "$PG_IMAGE" psql "$1" -tAc "$2"
}

cleanup() {
  echo "== Cleanup: dropping scratch database and dump file =="
  psql_exec "$ADMIN_URL" "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null 2>&1 || true
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

echo "== Step 1: back up the source database =="
"$SCRIPT_DIR/backup.sh" "$DUMP_FILE"

echo "== Step 2: create an isolated scratch database =="
psql_exec "$ADMIN_URL" "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null
psql_exec "$ADMIN_URL" "CREATE DATABASE ${SCRATCH_DB};" >/dev/null

echo "== Step 3: restore the backup into the scratch database =="
"$SCRIPT_DIR/restore.sh" "$DUMP_FILE" "$SCRATCH_URL"

echo "== Step 4: verify restored row counts match the source =="
TABLES="users campaigns entities entity_relationships sessions plot_threads timeline_events maps"
FAILED=0
for TABLE in $TABLES; do
  SOURCE_COUNT="$(psql_exec "$SOURCE_URL" "SELECT count(*) FROM ${TABLE};")"
  SCRATCH_COUNT="$(psql_exec "$SCRATCH_URL" "SELECT count(*) FROM ${TABLE};")"
  if [ "$SOURCE_COUNT" = "$SCRATCH_COUNT" ]; then
    echo "  ${TABLE}: ${SOURCE_COUNT} rows -- MATCH"
  else
    echo "  ${TABLE}: source=${SOURCE_COUNT} restored=${SCRATCH_COUNT} -- MISMATCH" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -eq 0 ]; then
  echo ""
  echo "RESTORE DRILL PASSED — backup/restore mechanism verified against real data."
else
  echo ""
  echo "RESTORE DRILL FAILED — see mismatches above." >&2
  exit 1
fi
