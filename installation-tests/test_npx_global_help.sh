#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

echo "Running global help command without first installing project"
OUTPUT="$(npx_playwright --help)"
local-playwright-registry assert-served-from-local-tgz playwright
if [[ "${OUTPUT}" == *'To avoid unexpected behavior, please install your dependencies first'* ]]; then
  echo "ERROR: should not warn user about global installation"
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
