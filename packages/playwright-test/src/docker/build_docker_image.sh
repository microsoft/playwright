export NOVNC_REF='1.3.0'
export WEBSOCKIFY_REF='0.10.0'
export DEBIAN_FRONTEND=noninteractive

# Install FluxBox, VNC & noVNC
mkdir -p /opt/bin && chmod +x /dev/shm \
    && apt-get update && apt-get install -y unzip fluxbox x11vnc \
    && curl -L -o noVNC.zip "https://github.com/novnc/noVNC/archive/v${NOVNC_REF}.zip" \
    && unzip -x noVNC.zip \
    && rm -rf noVNC-${NOVNC_REF}/{docs,tests} \
    && mv noVNC-${NOVNC_REF} /opt/bin/noVNC \
    && cp /opt/bin/noVNC/vnc.html /opt/bin/noVNC/index.html \
    && rm noVNC.zip \
    && curl -L -o websockify.zip "https://github.com/novnc/websockify/archive/v${WEBSOCKIFY_REF}.zip" \
    && unzip -x websockify.zip \
    && rm websockify.zip \
    && rm -rf websockify-${WEBSOCKIFY_REF}/{docs,tests} \
    && mv websockify-${WEBSOCKIFY_REF} /opt/bin/noVNC/utils/websockify

# Configure FluxBox menus
mkdir /root/.fluxbox
cd /ms-playwright-agent
cat <<'EOF' | node > /root/.fluxbox/menu
  const { chromium, firefox, webkit } = require('playwright-core');

  console.log(`
    [begin] (fluxbox)
      [submenu] (Browsers) {}
        [exec] (Chromium) { ${chromium.executablePath()} --no-sandbox --test-type= } <>
        [exec] (Firefox) { ${firefox.executablePath()} } <>
        [exec] (WebKit) { ${webkit.executablePath()} } <>
      [end]
      [include] (/etc/X11/fluxbox/fluxbox-menu)
    [end]
  `);
EOF

cat <<'EOF' > /root/.fluxbox/lastwallpaper
$center $full|/ms-playwright-agent/node_modules/playwright-core/lib/server/chromium/appIcon.png||:99
$center $full|/ms-playwright-agent/node_modules/playwright-core/lib/server/chromium/appIcon.png||:99.0
EOF

# Create entrypoint.sh
cat <<'EOF' > /entrypoint.sh
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

nohup x11vnc -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &
nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &

cd /ms-playwright-agent

NOVNC_UUID=$(cat /proc/sys/kernel/random/uuid)
echo "novnc is listening on http://127.0.0.1:7900?path=$NOVNC_UUID&resize=scale&autoconnect=1"

PW_UUID=$(cat /proc/sys/kernel/random/uuid)
npx playwright run-server --port=5400 --path=/$PW_UUID
EOF
chmod 755 /entrypoint.sh
