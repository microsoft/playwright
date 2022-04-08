#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

# @types/node@14.18.9 is the last version which is compatibel with typescript@3.7.5.
# After @types/node@14.18.9 URLSearchParams from @types/node conflicts with typescript's
# shipped types and it results in a type error / build failure.
npm i -D @types/node@14.18.9

# install all packages.
npm_i playwright-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-firefox
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-webkit
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i playwright-chromium
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_i @playwright/test

# typecheck all packages.
for PKG_NAME in "playwright" \
                "playwright-core" \
                "playwright-firefox" \
                "playwright-chromium" \
                "playwright-webkit"
do
  echo "Checking types of ${PKG_NAME}"
  echo "import { Page } from '${PKG_NAME}';" > "${PKG_NAME}.ts" && npx --yes -p typescript@3.7.5 tsc "${PKG_NAME}.ts"
done;

echo "Checking types of @playwright/test"
echo npx --yes -p typescript@3.7.5 tsc "playwright-test-types.ts"
