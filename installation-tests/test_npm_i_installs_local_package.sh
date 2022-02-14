#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"


PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright{,-core,-webkit,-firefox,-chromium}
# test subshell installation
OUTPUT=$(npm i --foreground-script @playwright/test)

SCRIPT=$(cat <<EOF
  const packageJSON = require('./package.json');
  for (const [entry, value] of Object.entries(packageJSON.dependencies)) {
    if (!value.startsWith('file:')) {
      console.log('ERROR: entry ' + entry + ' installed from NPM registry!');
      process.exit(1);
    }
  }
EOF
)
# make sure all dependencies are locally installed.
node -e "${SCRIPT}"

