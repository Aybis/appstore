#!/usr/bin/env bash
# One-screen status. Exit 0 if the API answers /health, 1 otherwise.
. "$(dirname "$0")/_common.sh"
api="down"; alive "$RUN_DIR/api.pid" && api="pid $(cat "$RUN_DIR/api.pid")"
tun="down"; alive "$RUN_DIR/tunnel.pid" && tun="pid $(cat "$RUN_DIR/tunnel.pid")"
echo "api:    $api"
echo "tunnel: $tun   $( [ -f "$RUN_DIR/tunnel.url" ] && cat "$RUN_DIR/tunnel.url" )"
if h="$(health)"; then echo "health: $h"; else echo "health: no answer on :$PORT"; exit 1; fi
