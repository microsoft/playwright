#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

copy_test_scripts

BROWSERS="$(pwd -P)/browsers"
npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_FIREFOX_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_WEBKIT_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_CHROMIUM_TGZ}

echo "Running screencast.js"
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-chromium
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-webkit
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node screencast.js playwright-firefox

