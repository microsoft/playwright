#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright
npm_i electron@12
npm_i -D typescript@3.8
npm_i -D @types/node@14
echo "import { Page, _electron, ElectronApplication, Electron } from 'playwright';" > "test.ts"

echo "Running tsc"
npx -p typescript@3.7.5 tsc "test.ts"

