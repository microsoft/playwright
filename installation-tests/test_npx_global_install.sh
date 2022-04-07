#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

echo "Running install explcitly"
OUTPUT="$(npx_playwright install || true)"
local-playwright-registry assert-served-from-local-tgz playwright
if [[ "${OUTPUT}" == *'Please run the following command to download new browsers'* ]]; then
  echo "ERROR: should not tell the user to run install"
  exit 1
fi
if [[ "${OUTPUT}" != *'To avoid unexpected behavior, please install your dependencies first'* ]]; then
  echo "ERROR: should warn user about global installation"
  exit 1
fi
if [[ "${OUTPUT}" != *"Downloading"*"chromium"* ]]; then
  echo "ERROR: should download chromium"
  exit 1
fi
if [[ "${OUTPUT}" != *"Downloading"*"firefox"* ]]; then
  echo "ERROR: should download firefox"
  exit 1
fi
if [[ "${OUTPUT}" != *"Downloading"*"webkit"* ]]; then
  echo "ERROR: should download webkit"
  exit 1
fi
