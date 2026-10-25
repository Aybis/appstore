#!/usr/bin/env bash
# Starts the API in the background. Safe to run twice: it says so and exits 0.
#
#   deploy/local-host/start.sh            start (builds first if dist/ is missing)
#   deploy/local-host/start.sh --build    rebuild first, always
#   deploy/local-host/start.sh --local    http + non-secure cookie, for testing on this Mac only
#
# Exit codes: 0 running, 1 failed to start.
. "$(dirname "$0")/_common.sh"

BUILD=0; LOCAL=0
for arg in "$@"; do
  case "$arg" in --build) BUILD=1 ;; --local) LOCAL=1 ;; *) echo "unknown flag: $arg"; exit 2 ;; esac
done

if alive "$RUN_DIR/api.pid"; then echo "already running (pid $(cat "$RUN_DIR/api.pid"))"; health; echo; exit 0; fi

"$(dirname "$0")/make-env.sh" >/dev/null
cd "$ROOT"

if [ "$BUILD" = 1 ] || [ ! -f apps/api/dist/main.js ]; then
  echo "building..."
  pnpm install --frozen-lockfile --filter "@appstore/api..." >"$LOG_DIR/build.log" 2>&1
  pnpm --filter "@appstore/api..." build >>"$LOG_DIR/build.log" 2>&1 || { echo "build failed, see $LOG_DIR/build.log"; exit 1; }
fi

set -a; . "$ENV_FILE"; set +a
export PORT
if [ "$LOCAL" = 1 ]; then export PUBLIC_BASE_URL="http://localhost:$PORT" COOKIE_SECURE=false TRUST_PROXY=; fi

nohup node apps/api/dist/main.js >>"$LOG_DIR/api.log" 2>&1 &
echo $! > "$RUN_DIR/api.pid"

for _ in $(seq 1 30); do
  if health >/dev/null; then echo "up on :$PORT (pid $(cat "$RUN_DIR/api.pid")), logs: $LOG_DIR/api.log"; exit 0; fi
  alive "$RUN_DIR/api.pid" || { echo "exited during start:"; tail -15 "$LOG_DIR/api.log"; rm -f "$RUN_DIR/api.pid"; exit 1; }
  sleep 1
done
echo "no /health after 30s, see $LOG_DIR/api.log"; exit 1
