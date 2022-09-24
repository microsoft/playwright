#!/bin/bash
set -e
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

nohup x11vnc -noprimary -nosetprimary -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &
nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &

cd /ms-playwright-agent

NOVNC_UUID=$(cat /proc/sys/kernel/random/uuid)
echo "novnc is listening on http://127.0.0.1:7900?path=$NOVNC_UUID&resize=scale&autoconnect=1"

PW_UUID=$(cat /proc/sys/kernel/random/uuid)
npx playwright run-server --port=5400 --path=/$PW_UUID
