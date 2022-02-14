#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

BROWSERS="$(pwd -P)/browsers"
npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
if [[ ! -d "${BROWSERS}" ]]; then
  echo "Directory for shared browsers was not created!"
  exit 1
fi

echo "Running sanity.js"
node sanity.js playwright none
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright
