#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

BROWSERS="$(pwd -P)/browsers"
npm_i playwright-core
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm_i playwright
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm_i playwright-firefox
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm_i playwright-webkit
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm_i playwright-chromium

echo "Running screencast.js"
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-chromium
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-webkit
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-firefox

