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
cat <<'EOF' > /root/.fluxbox/menu
  [begin] (fluxbox)
    [submenu] (Browsers) {}
      [exec] (Chromium) { /ms-playwright-agent/node_modules/.bin/playwright docker launch --endpoint http://127.0.0.1:5400 --browser chromium } <>
      [exec] (Firefox) { /ms-playwright-agent/node_modules/.bin/playwright docker launch --endpoint http://127.0.0.1:5400 --browser firefox  } <>
      [exec] (WebKit) { /ms-playwright-agent/node_modules/.bin/playwright docker launch --endpoint http://127.0.0.1:5400 --browser webkit  } <>
    [end]
    [include] (/etc/X11/fluxbox/fluxbox-menu)
  [end]
EOF

cat <<'EOF' > /root/.fluxbox/lastwallpaper
$center $full|/ms-playwright-agent/node_modules/playwright-core/lib/server/chromium/appIcon.png||:99
$center $full|/ms-playwright-agent/node_modules/playwright-core/lib/server/chromium/appIcon.png||:99.0
EOF

