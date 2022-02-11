#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_TGZ}

echo "Running playwright install"
PLAYWRIGHT_BROWSERS_PATH="0" npx playwright install

copy_test_scripts
echo "Running driver-client.js"
PLAYWRIGHT_BROWSERS_PATH="0" node driver-client.js

