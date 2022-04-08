#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
OUTPUT=$(npm_i --foreground-script playwright-webkit)
if [[ "${OUTPUT}" == *'To avoid unexpected behavior, please install your dependencies first'* ]]; then
  echo "ERROR: should not warn user about global installation"
  exit 1
fi
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

echo "Running sanity.js"
node sanity.js playwright-webkit
if [[ ${NODE_VERSION} -ge 14 ]]; then
  echo "Running esm.js"
  node esm-playwright-webkit.mjs
fi
