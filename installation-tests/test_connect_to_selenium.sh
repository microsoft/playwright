#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

node "${SCRIPTS_PATH}/download-chromedriver.js" ${TEST_ROOT}
cd ${SCRIPTS_PATH}/output
PWTEST_CHROMEDRIVER="${TEST_ROOT}/chromedriver" npm run test -- --reporter=list selenium.spec
