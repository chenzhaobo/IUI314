#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/.run"
PID_FILE="$RUN_DIR/vite.pid"
LOG_FILE="$RUN_DIR/vite.log"
PORT="${FRONTEND_PORT:-9876}"
# 开发机需要局域网访问（例如 http://192.168.232.38:9876），默认监听全部网卡；
# 需要仅本机访问时设置 FRONTEND_HOST=127.0.0.1
HOST="${FRONTEND_HOST:-0.0.0.0}"
VITE_BIN="$SCRIPT_DIR/node_modules/.bin/vite"

mkdir -p "$RUN_DIR"

port_is_listening() {
    ss -H -ltn "sport = :$1" 2>/dev/null | grep -q ":$1"
}

if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        if port_is_listening "$PORT"; then
            echo "[Frontend] Already running (PID: $pid, port: $PORT)"
            exit 0
        fi
        echo "[Frontend] PID $pid exists but port $PORT is not ready"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

if port_is_listening "$PORT"; then
    echo "[Frontend] Port $PORT is occupied by an unmanaged process"
    exit 1
fi

if [ ! -x "$VITE_BIN" ]; then
    echo "[Frontend] Local Vite executable not found: $VITE_BIN"
    echo "[Frontend] Install dependencies first (pnpm install)"
    exit 1
fi

cd "$SCRIPT_DIR"
: > "$LOG_FILE"
nohup setsid "$VITE_BIN" --host "$HOST" --port "$PORT" --strictPort >"$LOG_FILE" 2>&1 &
pid=$!
echo "$pid" > "$PID_FILE"

for _ in $(seq 1 60); do
    if ! kill -0 "$pid" 2>/dev/null; then
        echo "[Frontend] Startup failed; recent log:"
        tail -n 40 "$LOG_FILE" || true
        rm -f "$PID_FILE"
        exit 1
    fi
    if port_is_listening "$PORT"; then
        echo "[Frontend] Ready: http://127.0.0.1:$PORT (PID: $pid)"
        echo "[Frontend] Log: $LOG_FILE"
        exit 0
    fi
    sleep 1
done

echo "[Frontend] Startup timed out waiting for port $PORT"
kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1
