#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  install-deps)
    install -d -m 777 /ms-playwright /ms-playwright/.links
    mkdir /ms-playwright-agent
    cd /ms-playwright-agent
    npm init -y
    npm i /tmp/playwright-core.tar.gz
    npm exec --no -- playwright-core mark-docker-image "${DOCKER_IMAGE_NAME_TEMPLATE}"
    npm exec --no -- playwright-core install-deps
    rm -rf /var/lib/apt/lists/*
    ;;
  remove-gstwebrtc)
    if [ "$(uname -m)" = "aarch64" ]; then
      rm /usr/lib/aarch64-linux-gnu/gstreamer-1.0/libgstwebrtc.so
    else
      rm /usr/lib/x86_64-linux-gnu/gstreamer-1.0/libgstwebrtc.so
    fi
    ;;
  chromium)
    cd /ms-playwright-agent
    npm exec --no -- playwright-core install chromium
    chmod -R 777 /ms-playwright/chromium-* /ms-playwright/chromium_headless_shell-* /ms-playwright/ffmpeg-*
    ;;
  firefox)
    cd /ms-playwright-agent
    npm exec --no -- playwright-core install firefox
    chmod -R 777 /ms-playwright/firefox-*
    ;;
  webkit)
    cd /ms-playwright-agent
    npm exec --no -- playwright-core install webkit
    chmod -R 777 /ms-playwright/webkit-*
    ;;
  cleanup)
    rm /tmp/playwright-core.tar.gz
    rm -rf /ms-playwright-agent
    rm -rf ~/.npm/
    rm /tmp/install_browsers.sh
    ;;
  *)
    echo "usage: $(basename "$0") {install-deps|remove-gstwebrtc|chromium|firefox|webkit|cleanup}"
    exit 1
    ;;
esac
