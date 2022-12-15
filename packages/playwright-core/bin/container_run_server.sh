#!/bin/bash
set -e

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

SCREEN_WIDTH=1360
SCREEN_HEIGHT=1020
SCREEN_DEPTH=24
SCREEN_DPI=96
GEOMETRY="$SCREEN_WIDTH""x""$SCREEN_HEIGHT""x""$SCREEN_DEPTH"

nohup /usr/bin/xvfb-run --server-num=$DISPLAY_NUM \
     --listen-tcp \
     --server-args="-screen 0 "$GEOMETRY" -fbdir /var/tmp -dpi "$SCREEN_DPI" -listen tcp -noreset -ac +extension RANDR" \
     /usr/bin/fluxbox -display "$DISPLAY" >/dev/null 2>&1 &

for i in $(seq 1 500); do
  if xdpyinfo -display $DISPLAY >/dev/null 2>&1; then
    break
  fi
  echo "Waiting for Xvfb..."
  sleep 0.2
done

# Launch x11
nohup x11vnc -noprimary -nosetprimary -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &
# Launch novnc
nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &
# Launch reverse proxy
NOVNC_UUID=$(cat /proc/sys/kernel/random/uuid)
node ./container_novnc_proxy.js start --server-endpoint="http://127.0.0.1:5200" --novnc-endpoint="http://127.0.0.1:7900" --novnc-ws-path="${NOVNC_UUID}" --port 5400 &

cd /ms-playwright-agent

PW_UUID=$(cat /proc/sys/kernel/random/uuid)

# Make sure to re-start playwright server if something goes wrong.
# The approach taken from: https://stackoverflow.com/a/697064/314883

until npx playwright run-server --port=5200 --path=/$PW_UUID --proxy-mode=tether; do
  echo "Server crashed with exit code $?. Respawning.." >&2
  sleep 1
done

