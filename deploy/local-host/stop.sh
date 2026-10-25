#!/usr/bin/env bash
# Stops what start.sh and tunnel.sh started. Always exits 0.
#
#   stop.sh          the API and the tunnel
#   stop.sh api      only the API  (leaves the tunnel, and so its URL, alone)
#   stop.sh tunnel   only the tunnel
. "$(dirname "$0")/_common.sh"
case "${1:-all}" in
  all) names="tunnel api" ;; api) names="api" ;; tunnel) names="tunnel" ;;
  *) echo "usage: stop.sh [api|tunnel]"; exit 2 ;;
esac
for name in $names; do
  f="$RUN_DIR/$name.pid"
  if alive "$f"; then kill "$(cat "$f")" && echo "stopped $name"; else echo "$name not running"; fi
  rm -f "$f"; [ "$name" = tunnel ] && rm -f "$RUN_DIR/tunnel.url"
done
