#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
PLAYWRIGHT_BROWSERS_PATH="" HOME=. npm_i playwright
echo "Running sanity.js"
# Firefox does not work with relative HOME.
PLAYWRIGHT_BROWSERS_PATH="" HOME=. node sanity.js playwright chromium webkit
