#!/usr/bin/env bash
# Builds deploy/backend.env.local from deploy/env.production.local.
#
#   deploy/local-host/make-env.sh          create it if it does not exist
#   deploy/local-host/make-env.sh --force  rebuild it (KEEPS the existing JWT_SECRET)
#
# JWT_SECRET is generated once and then kept: a new one signs everybody out.
. "$(dirname "$0")/_common.sh"

[ -f "$SOURCE_ENV" ] || { echo "missing $SOURCE_ENV (copy deploy/env.production.example)"; exit 1; }
if [ -f "$ENV_FILE" ] && [ "${1:-}" != "--force" ]; then echo "exists: $ENV_FILE"; exit 0; fi

JWT=""
[ -f "$ENV_FILE" ] && JWT="$(grep '^JWT_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$JWT" ] || JWT="$(openssl rand -hex 32)"
PUB="https://maya-api.example.invalid"
CORS="https://maya-console-uhnwi.vercel.app"
if [ -f "$ENV_FILE" ]; then
  PUB="$(grep '^PUBLIC_BASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
  CORS="$(grep '^CORS_ORIGINS=' "$ENV_FILE" | cut -d= -f2-)"
fi

set -a; . "$SOURCE_ENV"; set +a
: "${SUPABASE_DB_PASSWORD:?}" "${R2_ACCOUNT_ID:?}" "${R2_BUCKET:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"

umask 077
cat > "$ENV_FILE" <<EOT
NODE_ENV=production
BLOB_STORE=s3
S3_REGION=auto
S3_BUCKET=$R2_BUCKET
S3_ENDPOINT=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY
DATABASE_URL=postgres://postgres.cschfyufthmknuyffczn:$SUPABASE_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET=$JWT
TRUST_PROXY=1
COOKIE_SECURE=true
PUBLIC_BASE_URL=$PUB
CORS_ORIGINS=$CORS
EOT
echo "wrote $ENV_FILE"
