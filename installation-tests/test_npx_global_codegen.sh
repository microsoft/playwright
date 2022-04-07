#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

echo "Running codegen command without installing"
OUTPUT="$(npx_playwright codegen || true)"
local-playwright-registry assert-local-pkg playwright
if [[ "${OUTPUT}" != *'Please run the following command to download new browsers'* ]]; then
  echo "ERROR: should instruct user to download browsers"
  exit 1
fi
if [[ "${OUTPUT}" == *"Downloading"*"chromium"* ]]; then
  echo "ERROR: should not download chromium"
  exit 1
fi
if [[ "${OUTPUT}" == *"Downloading"*"webkit"* ]]; then
  echo "ERROR: should not download webkit"
  exit 1
fi
if [[ "${OUTPUT}" == *"Downloading"*"firefox"* ]]; then
  echo "ERROR: should not download firefox"
  exit 1
fi
