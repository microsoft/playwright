#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i @playwright/test
PLAYWRIGHT_BROWSERS_PATH="0" npx playwright install chromium

echo "Running playwright test"
OUTPUT=$(DEBUG=pw:api npx playwright test -c . failing.spec.js 2>&1 || true)
if [[ "${OUTPUT}" != *"expect.toHaveText started"* ]]; then
  echo "ERROR: missing 'expect.toHaveText started' in the output"
  exit 1
fi
if [[ "${OUTPUT}" != *"failing.spec.js:5:38"* ]]; then
  echo "ERROR: missing 'failing.spec.js:5:38' in the output"
  exit 1
fi
