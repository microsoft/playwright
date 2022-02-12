#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

# Make sure that browsers path is resolved relative to the `npm install` call location.
mkdir foo
cd foo
npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_BROWSERS_PATH="../relative" npm install ${PLAYWRIGHT_TGZ}
cd ..

copy_test_scripts
echo "Running sanity.js"
PLAYWRIGHT_BROWSERS_PATH="./relative" node sanity.js playwright

