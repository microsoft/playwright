#!/bin/bash
set -e

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

SCREEN_WIDTH=1360
SCREEN_HEIGHT=1020
SCREEN_DEPTH=24
SCREEN_DPI=96
GEOMETRY="$SCREEN_WIDTH""x""$SCREEN_HEIGHT""x""$SCREEN_DEPTH"

# Launch x11
nohup /usr/bin/xvfb-run --server-num=$DISPLAY_NUM \
     --listen-tcp \
     --server-args="-screen 0 "$GEOMETRY" -fbdir /var/tmp -dpi "$SCREEN_DPI" -listen tcp -noreset -ac +extension RANDR" \
     /usr/bin/fluxbox -display "$DISPLAY" >/dev/null 2>&1 &

# Launch x11vnc
nohup x11vnc -noprimary -nosetprimary -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &

# Launch novnc
nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &

# Wait for x11 display to start
for i in $(seq 1 500); do
  if xdpyinfo -display $DISPLAY >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Make sure to re-start container agent if something goes wrong.
# The approach taken from: https://stackoverflow.com/a/697064/314883
until npx playwright container start-agent --novnc-endpoint="http://127.0.0.1:7900" --port 5400; do
  echo "Server crashed with exit code $?. Respawning.." >&2
  sleep 1
done


