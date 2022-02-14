#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright
npm_i electron@9.0

echo "Running sanity-electron.js"
node sanity-electron.js
