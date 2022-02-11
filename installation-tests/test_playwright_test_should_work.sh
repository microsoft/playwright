#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
npm install ${PLAYWRIGHT_TEST_TGZ}
copy_test_scripts

echo "Running playwright test without install"
if npx playwright test -c .; then
  echo "ERROR: should not be able to run tests without installing browsers"
  exit 1
fi

echo "Running playwright install"
PLAYWRIGHT_BROWSERS_PATH="0" npx playwright install

echo "Running playwright test"
PLAYWRIGHT_JSON_OUTPUT_NAME=report.json PLAYWRIGHT_BROWSERS_PATH="0" npx playwright test -c . --browser=all --reporter=list,json sample.spec.js

echo "Checking the report"
node ./read-json-report.js ./report.json

echo "Running sanity.js"
node sanity.js "@playwright/test"
if [[ "${NODE_VERSION}" == *"v14."* ]]; then
  echo "Running esm.js"
  node esm-playwright-test.mjs
fi

