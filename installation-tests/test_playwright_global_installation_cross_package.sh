#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-firefox
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-webkit
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-chromium

BROWSERS="$(pwd -P)/browsers"
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm_i playwright
if [[ ! -d "${BROWSERS}" ]]; then
  echo "Directory for shared browsers was not created!"
  exit 1
fi

echo "Running sanity.js"
# Every package should be able to launch.
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-chromium all
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-firefox all
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-webkit all
