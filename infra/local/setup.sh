#!/usr/bin/env bash
#
# One-shot local database setup for the enterprise app store.
#
#   ./infra/local/setup.sh
#
# Idempotent: safe to re-run after adding migrations or resetting your machine.
#
# Requires a running PostgreSQL 15+ that you can reach as a superuser. It does
# NOT install or start Postgres, and it never touches databases other than
# `appstore` and `appstore_test`.
#
# Override any of these:
#   PGHOST, PGPORT, PGUSER   connection to the maintenance database
#   APP_RUNTIME_PASSWORD     local-only password for the app_runtime role
#   PSQL                     path to psql

set -euo pipefail

# Prefer the PostgreSQL 17 client so server and client majors match; fall back to
# whatever psql is on PATH.
for candidate in /opt/homebrew/opt/postgresql@17/bin/psql /opt/homebrew/opt/libpq/bin/psql; do
  [ -x "$candidate" ] && DEFAULT_PSQL="$candidate" && break
done
PSQL="${PSQL:-${DEFAULT_PSQL:-$(command -v psql || true)}}"

PGHOST="${PGHOST:-localhost}"
# 5433 is this project's PostgreSQL 17 cluster, matching Supabase's major version.
# An unrelated PostgreSQL 15 may be running on 5432; this script never touches it.
PGPORT="${PGPORT:-5433}"
APP_RUNTIME_PASSWORD="${APP_RUNTIME_PASSWORD:-devpassword}"
export PGHOST PGPORT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -x "$PSQL" ]; then
  echo "error: psql not found. Set PSQL=/path/to/psql, or: brew install libpq" >&2
  exit 1
fi

if ! "$PSQL" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  echo "error: cannot connect to postgres at ${PGHOST}:${PGPORT}." >&2
  echo "       Is the server running?  brew services start postgresql@17" >&2
  exit 1
fi

server_version="$("$PSQL" -d postgres -tAc 'show server_version')"
major="${server_version%%.*}"
echo "==> PostgreSQL ${server_version} at ${PGHOST}:${PGPORT}"

if [ "$major" -lt 15 ]; then
  echo "error: PostgreSQL 15 or newer required (found ${server_version})." >&2
  exit 1
fi

if [ "$major" -ne 17 ]; then
  echo "    warning: Supabase runs PostgreSQL 17 and you are on ${major}."
  echo "             Nothing in this schema needs 17, but local and production"
  echo "             then differ. This project's 17 cluster is on port 5433:"
  echo "               brew services start postgresql@17"
  echo "             See docs/04-plan/database-and-storage.md for the skew note."
fi

echo "==> Creating app_runtime role and databases"
"$PSQL" -q -d postgres -v runtime_password="'${APP_RUNTIME_PASSWORD}'" -f "${SCRIPT_DIR}/bootstrap.sql"

for database in appstore appstore_test; do
  echo "==> Applying grants in ${database}"
  "$PSQL" -q -d "$database" -f "${SCRIPT_DIR}/grants.sql"
done

cat <<EOF

Local database ready.

  app database   postgres://app_runtime:${APP_RUNTIME_PASSWORD}@${PGHOST}:${PGPORT}/appstore
  test database  postgres://app_runtime:${APP_RUNTIME_PASSWORD}@${PGHOST}:${PGPORT}/appstore_test
  migrations as  $("$PSQL" -d postgres -tAc 'select current_user')

Next:
  cp .env.example .env      # already points at the URLs above
  pnpm install
  pnpm --filter @appstore/api exec drizzle-kit migrate
EOF
