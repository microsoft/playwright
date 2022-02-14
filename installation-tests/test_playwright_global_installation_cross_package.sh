#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_FIREFOX_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_WEBKIT_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_CHROMIUM_TGZ}

BROWSERS="$(pwd -P)/browsers"
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
if [[ ! -d "${BROWSERS}" ]]; then
  echo "Directory for shared browsers was not created!"
  exit 1
fi

echo "Running sanity.js"
# Every package should be able to launch.
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-chromium all
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-firefox all
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright-webkit all
