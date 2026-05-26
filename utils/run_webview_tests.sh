#!/usr/bin/env bash
# Bring up ios_webkit_debug_proxy against the booted iOS Simulator and exec
# whatever command is passed (defaulting to playwright test against the webview
# config). Endpoint discovery and Mobile Safari freshness are owned by the
# worker fixture in tests/webview/webviewTest.ts — this script's only job is
# to ensure the proxy is listening on localhost:9221/9222.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v ios_webkit_debug_proxy >/dev/null; then
  echo "ios_webkit_debug_proxy not found. Install with: brew install ios-webkit-debug-proxy" >&2
  exit 1
fi

SOCK=""
for i in $(seq 1 15); do
  SOCK=$(lsof -aUc launchd_sim 2>/dev/null | awk '/com\.apple\.webinspectord_sim\.socket/{print $NF; exit}' || true)
  [[ -n "$SOCK" ]] && break
  echo "attempt $i: webinspectord_sim socket not found yet"
  sleep 1
done
if [[ -z "$SOCK" ]]; then
  echo "Failed to locate com.apple.webinspectord_sim.socket. Is Simulator running?" >&2
  exit 1
fi
echo "Socket: $SOCK"

PROXY_LOG="$(mktemp -t iwdp.XXXXXX.log)"
ios_webkit_debug_proxy -F -d -s "unix:$SOCK" -c "null:9221,:9222-9322" >"$PROXY_LOG" 2>&1 &
PROXY_PID=$!
# Only clean up on a forced abort. A clean exit leaves the proxy running so
# subsequent `npm run wvtest` invocations can use it; stop manually with
# `kill <pid>` printed below.
trap 'kill "$PROXY_PID" 2>/dev/null || true' INT TERM
disown "$PROXY_PID" 2>/dev/null || true
echo "Started ios_webkit_debug_proxy pid=$PROXY_PID (log: $PROXY_LOG)"

sleep 2
if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  echo "Proxy died immediately. Log:" >&2
  cat "$PROXY_LOG" >&2
  exit 1
fi

# Wait until /json answers on 9221 — once the device list is available, the
# fixture's /json polls on 9222 will work too.
for i in $(seq 1 15); do
  if curl -sf http://localhost:9221/json >/dev/null; then
    break
  fi
  sleep 1
done
echo "Proxy listening on http://localhost:9222 (stop with: kill $PROXY_PID)"
