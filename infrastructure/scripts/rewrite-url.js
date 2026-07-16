#!/usr/bin/env node
// Milestone 14 Phase 12 — used by backup.sh/restore.sh/restore-drill.sh.
// Usage: node rewrite-url.js <url> [newDbName]
//
// Prints a rewritten connection URL: a localhost/127.0.0.1 host becomes
// host.docker.internal, so a throwaway `docker run` container (which the
// backup/restore scripts use instead of requiring Postgres client tools on
// the host) can reach this repo's local docker-compose Postgres via the
// host's published port. Any other host is left untouched — a real
// deployed DATABASE_URL is never localhost-scoped, so this is a no-op
// there, which is exactly what makes the same scripts work unmodified
// against a real target later.
//
// Node's URL class (not sed/regex) handles this so query strings (e.g. a
// real host's `?sslmode=require`), credentials, and IPv6 hosts all parse
// correctly rather than needing increasingly fragile pattern matching.
//
// If a second argument is given, the URL's database name is replaced with
// it — used to point the same base connection at a different database on
// the same server (e.g. the `postgres` maintenance db, or a scratch
// database for the restore drill) without hand-editing the whole URL.

const url = new URL(process.argv[2])
if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
  url.hostname = 'host.docker.internal'
}
if (process.argv[3]) {
  url.pathname = `/${process.argv[3]}`
}
process.stdout.write(url.toString())
