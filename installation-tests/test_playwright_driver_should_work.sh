#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright

echo "Running playwright install"
PLAYWRIGHT_BROWSERS_PATH="0" npx playwright install

echo "Running driver-client.js"
PLAYWRIGHT_BROWSERS_PATH="0" node driver-client.js

