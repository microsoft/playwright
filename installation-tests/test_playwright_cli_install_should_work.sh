#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_TGZ}

BROWSERS="$(pwd -P)/browsers"

echo "Running playwright install chromium"
OUTPUT=$(PLAYWRIGHT_BROWSERS_PATH=${BROWSERS} npx playwright install chromium)
if [[ "${OUTPUT}" != *"chromium"* ]]; then
  echo "ERROR: should download chromium"
  exit 1
fi
if [[ "${OUTPUT}" != *"ffmpeg"* ]]; then
  echo "ERROR: should download ffmpeg"
  exit 1
fi
if [[ "${OUTPUT}" == *"webkit"* ]]; then
  echo "ERROR: should not download webkit"
  exit 1
fi
if [[ "${OUTPUT}" == *"firefox"* ]]; then
  echo "ERROR: should not download firefox"
  exit 1
fi

echo "Running playwright install"
OUTPUT=$(PLAYWRIGHT_BROWSERS_PATH=${BROWSERS} npx playwright install)
if [[ "${OUTPUT}" == *"chromium"* ]]; then
  echo "ERROR: should not download chromium"
  exit 1
fi
if [[ "${OUTPUT}" == *"ffmpeg"* ]]; then
  echo "ERROR: should not download ffmpeg"
  exit 1
fi
if [[ "${OUTPUT}" != *"webkit"* ]]; then
  echo "ERROR: should download webkit"
  exit 1
fi
if [[ "${OUTPUT}" != *"firefox"* ]]; then
  echo "ERROR: should download firefox"
  exit 1
fi

copy_test_scripts
echo "Running sanity.js"
node sanity.js playwright none
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright

