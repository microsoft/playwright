#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

copy_test_scripts

npm install ${PLAYWRIGHT_CORE_TGZ}
OUTPUT=$(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --foreground-script ${PLAYWRIGHT_TGZ})
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

