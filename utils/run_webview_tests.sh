#!/usr/bin/env bash
# Bring up one ios_webkit_debug_proxy per booted iOS Simulator and exec
# whatever command is passed (defaulting to playwright test against the webview
# config). Worker i in the test runner talks to the proxy on port
# 9222 + 100*i, so booting N simulators enables N parallel workers.
#
# Endpoint discovery and Mobile Safari freshness are owned by the worker
# fixture in tests/webview/webviewTest.ts.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v ios_webkit_debug_proxy >/dev/null; then
  echo "ios_webkit_debug_proxy not found. Install with: brew install ios-webkit-debug-proxy" >&2
  exit 1
fi

# Collect all currently active webinspectord_sim sockets (one per booted sim).
SOCKETS=()
for i in $(seq 1 15); do
  mapfile -t SOCKETS < <(lsof -aUc launchd_sim 2>/dev/null | awk '/com\.apple\.webinspectord_sim\.socket/{print $NF}' | sort -u)
  [[ ${#SOCKETS[@]} -gt 0 ]] && break
  echo "attempt $i: no webinspectord_sim socket yet"
  sleep 1
done
if [[ ${#SOCKETS[@]} -eq 0 ]]; then
  echo "Failed to locate any com.apple.webinspectord_sim.socket. Is at least one Simulator running?" >&2
  exit 1
fi
echo "Found ${#SOCKETS[@]} simulator socket(s):"
printf '  %s\n' "${SOCKETS[@]}"

PIDS=()
LOGS=()
for idx in "${!SOCKETS[@]}"; do
  SOCK="${SOCKETS[$idx]}"
  LIST_PORT=$((9221 + 100 * idx))
  TAB_PORT=$((9222 + 100 * idx))
  LOG="$(mktemp -t "iwdp-${idx}.XXXXXX.log")"
  ios_webkit_debug_proxy -F -d -s "unix:$SOCK" -c "null:${LIST_PORT},:${TAB_PORT}-$((TAB_PORT + 99))" >"$LOG" 2>&1 &
  PID=$!
  disown "$PID" 2>/dev/null || true
  PIDS+=("$PID")
  LOGS+=("$LOG")
  echo "  worker $idx: pid=$PID list=$LIST_PORT tab=$TAB_PORT log=$LOG"
done

# Only clean up on a forced abort. A clean exit leaves the proxies running so
# subsequent `npm run wvtest` invocations can use them.
trap 'for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done' INT TERM

sleep 2
for idx in "${!PIDS[@]}"; do
  PID="${PIDS[$idx]}"
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Proxy $idx died immediately. Log:" >&2
    cat "${LOGS[$idx]}" >&2
    exit 1
  fi
done

# Wait until the first device list answers — implies the proxy is ready.
for i in $(seq 1 15); do
  if curl -sf http://localhost:9221/json >/dev/null; then
    break
  fi
  sleep 1
done

echo "Stop all with: kill ${PIDS[*]}"
