#!/usr/bin/env bash
# Shared by the other scripts here. Source it; do not run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="$ROOT/deploy"
ENV_FILE="$DEPLOY/backend.env.local"        # what the API runs with (git-ignored)
SOURCE_ENV="$DEPLOY/env.production.local"   # credentials you filled in (git-ignored)
RUN_DIR="$DEPLOY/.run"                      # pid files (git-ignored)
LOG_DIR="${MAYA_LOG_DIR:-$HOME/Library/Logs/maya}"
PORT="${PORT:-3000}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

health() { curl -fsS -m 3 "http://localhost:$PORT/health" 2>/dev/null; }
