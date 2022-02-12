#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_TGZ}
npm install -D typescript@3.8
npm install -D @types/node@14
echo "import { AndroidDevice, _android, AndroidWebView, Page } from 'playwright';" > "test.ts"

echo "Running tsc"
npx -p typescript@3.7.5 tsc "test.ts"
