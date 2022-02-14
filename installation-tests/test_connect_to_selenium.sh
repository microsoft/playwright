#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
node "./download-chromedriver.js" "${PWD}"
export PWTEST_CHROMEDRIVER="${PWD}/chromedriver"
cd "${PLAYWRIGHT_CHECKOUT}"
npm run test -- --reporter=list selenium.spec
