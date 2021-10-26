#!/bin/bash
set -e
set +x

SCREEN_WIDTH=1360
SCREEN_HEIGHT=1020
SCREEN_DEPTH=24
SCREEN_DPI=96
GEOMETRY="${SCREEN_WIDTH}""x""${SCREEN_HEIGHT}""x""${SCREEN_DEPTH}"

nohup /usr/bin/xvfb-run --server-num=${DISPLAY_NUM} \
     --listen-tcp \
     --server-args="-screen 0 ${GEOMETRY} -fbdir /var/tmp -dpi ${SCREEN_DPI} -listen tcp -noreset -ac +extension RANDR" \
     /usr/bin/fluxbox -display ${DISPLAY} >/dev/null 2>&1 &

for i in $(seq 1 50)
  do
    if xdpyinfo -display ${DISPLAY} >/dev/null 2>&1; then
      break
    fi
    echo "Waiting for Xvfb..."
    sleep 0.2
  done

nohup x11vnc -forever -shared -rfbport 5900 -rfbportv6 5900 -display ${DISPLAY} >/dev/null 2>&1 &
nohup /opt/bin/noVNC/utils/launch.sh --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &

npx playwright experimental-grid-agent --agent-id "$1" --grid-url "$2"
