#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
OUTPUT=$(npm install --foreground-script ${PLAYWRIGHT_WEBKIT_TGZ})
if [[ "${OUTPUT}" == *"chromium"* ]]; then
  echo "ERROR: should not download chromium"
  exit 1
fi
if [[ "${OUTPUT}" == *"firefox"* ]]; then
  echo "ERROR: should not download firefox"
  exit 1
fi
if [[ "${OUTPUT}" != *"webkit"* ]]; then
  echo "ERROR: should download webkit"
  exit 1
fi
copy_test_scripts

echo "Running sanity.js"
node sanity.js playwright-webkit
if [[ ${NODE_VERSION} -ge 14 ]]; then
  echo "Running esm.js"
  node esm-playwright-webkit.mjs
fi
