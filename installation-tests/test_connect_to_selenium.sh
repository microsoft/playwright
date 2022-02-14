#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm i playwright-core
node "./download-chromedriver.js" "${PWD}"
export PWTEST_CHROMEDRIVER="${PWD}/chromedriver"
cd "${PLAYWRIGHT_CHECKOUT}"
npm run test -- --reporter=list selenium.spec
