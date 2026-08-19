#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/.run/vite.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "[Frontend] Not running (no managed PID file)"
    exit 0
fi

pid="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    echo "[Frontend] Removing stale PID file"
    rm -f "$PID_FILE"
    exit 0
fi

echo "[Frontend] Stopping PID $pid..."
kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
for _ in $(seq 1 15); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
done
if kill -0 "$pid" 2>/dev/null; then
    echo "[Frontend] Graceful stop timed out; terminating process group"
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
fi
rm -f "$PID_FILE"
echo "[Frontend] Stopped"
