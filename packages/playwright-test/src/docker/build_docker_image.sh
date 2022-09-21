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

# Patch noVNC

cat <<'EOF' > /opt/bin/noVNC/clip.patch
diff --git a/app/ui.js b/app/ui.js
index cb6a9fd..dbe42e0 100644
--- a/app/ui.js
+++ b/app/ui.js
@@ -951,6 +951,7 @@ const UI = {
     clipboardReceive(e) {
         Log.Debug(">> UI.clipboardReceive: " + e.detail.text.substr(0, 40) + "...");
         document.getElementById('noVNC_clipboard_text').value = e.detail.text;
+        navigator.clipboard.writeText(e.detail.text).catch(() => {});
         Log.Debug("<< UI.clipboardReceive");
     },
 
diff --git a/core/rfb.js b/core/rfb.js
index ea3bf58..fad57bc 100644
--- a/core/rfb.js
+++ b/core/rfb.js
@@ -176,6 +176,7 @@ export default class RFB extends EventTargetMixin {
             handleMouse: this._handleMouse.bind(this),
             handleWheel: this._handleWheel.bind(this),
             handleGesture: this._handleGesture.bind(this),
+            handleFocus: () => navigator.clipboard.readText().then(this.clipboardPasteFrom.bind(this)).catch(() => {})
         };
 
         // main setup
@@ -515,6 +516,7 @@ export default class RFB extends EventTargetMixin {
         this._canvas.addEventListener("gesturestart", this._eventHandlers.handleGesture);
         this._canvas.addEventListener("gesturemove", this._eventHandlers.handleGesture);
         this._canvas.addEventListener("gestureend", this._eventHandlers.handleGesture);
+        window.addEventListener('focus', this._eventHandlers.handleFocus);
 
         Log.Debug("<< RFB.connect");
     }
@@ -522,6 +524,7 @@ export default class RFB extends EventTargetMixin {
     _disconnect() {
         Log.Debug(">> RFB.disconnect");
         this._cursor.detach();
+        window.removeEventListener('focus', this._eventHandlers.handleFocus);
         this._canvas.removeEventListener("gesturestart", this._eventHandlers.handleGesture);
         this._canvas.removeEventListener("gesturemove", this._eventHandlers.handleGesture);
         this._canvas.removeEventListener("gestureend", this._eventHandlers.handleGesture);
EOF

cd /opt/bin/noVNC
git apply clip.patch

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

nohup x11vnc -noprimary -nosetprimary -forever -shared -rfbport 5900 -rfbportv6 5900 -display "$DISPLAY" >/dev/null 2>&1 &
nohup /opt/bin/noVNC/utils/novnc_proxy --listen 7900 --vnc localhost:5900 >/dev/null 2>&1 &

cd /ms-playwright-agent

NOVNC_UUID=$(cat /proc/sys/kernel/random/uuid)
echo "novnc is listening on http://127.0.0.1:7900?path=$NOVNC_UUID&resize=scale&autoconnect=1"

PW_UUID=$(cat /proc/sys/kernel/random/uuid)
npx playwright run-server --port=5400 --path=/$PW_UUID
EOF
chmod 755 /entrypoint.sh
