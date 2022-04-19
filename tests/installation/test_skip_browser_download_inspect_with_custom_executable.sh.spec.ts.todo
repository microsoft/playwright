#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
OUTPUT=$(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i --foreground-script playwright)
if [[ "${OUTPUT}" != *"Skipping browsers download because"* ]]; then
  echo "missing log message that browsers download is skipped"
  exit 1
fi

if [[ "$(uname)" != "Linux" ]]; then
  echo
  echo "Skipping test on non-Linux platform"
  echo
  return
fi

OUTPUT=$(PWDEBUG=1 node inspector-custom-executable.js)
if [[ "${OUTPUT}" != *"SUCCESS"* ]]; then
  echo "missing log message that launch succeeded: ${OUTPUT}"
  exit 1
fi

