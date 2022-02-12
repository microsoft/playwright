#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
npm install ${PLAYWRIGHT_TGZ}

echo "Running playwright screenshot"

node_modules/.bin/playwright screenshot about:blank one.png
if [[ ! -f one.png ]]; then
  echo 'node_modules/.bin/playwright does not work'
  exit 1
fi

npx playwright screenshot about:blank two.png
if [[ ! -f two.png ]]; then
  echo 'npx playwright does not work'
  exit 1
fi
