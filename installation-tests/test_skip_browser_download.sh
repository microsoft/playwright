#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
OUTPUT=$(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --foreground-script ${PLAYWRIGHT_TGZ})
if [[ "${OUTPUT}" != *"Skipping browsers download because"* ]]; then
  echo "missing log message that browsers download is skipped"
  exit 1
fi

if [[ -d ./node_modules/playwright/.local-browsers ]]; then
  echo "local browsers folder should be empty"
  exit 1
fi

