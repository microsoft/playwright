#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_BROWSERS_PATH="" HOME=. npm install ${PLAYWRIGHT_TGZ}
copy_test_scripts
echo "Running sanity.js"
# Firefox does not work with relative HOME.
PLAYWRIGHT_BROWSERS_PATH="" HOME=. node sanity.js playwright chromium webkit
