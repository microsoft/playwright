#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

# Make sure that browsers path is resolved relative to the `npm install` call location.
mkdir foo
cd foo
npm_i playwright-core
PLAYWRIGHT_BROWSERS_PATH="../relative" npm_i playwright
cd ..

echo "Running sanity.js"
PLAYWRIGHT_BROWSERS_PATH="./relative" node sanity.js playwright

