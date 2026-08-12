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

PSQL="${PSQL:-$(command -v psql || echo /opt/homebrew/opt/libpq/bin/psql)}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
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
  echo "    note: Supabase runs PostgreSQL 17. You are on ${major}, so local and"
  echo "          production differ. Nothing in this schema needs 17, but see"
  echo "          docs/04-plan/00-overview.md for the version-skew note."
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
