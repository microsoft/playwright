#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

echo "Setting up Playwright for global npx execution"
# local-playwright-registry kill || true;
local-playwright-registry start &
rm -rf ./node_modules
export npm_config_cache="$(mktemp -d)"
export npm_config_registry="$(local-playwright-registry wait-for-ready)"
npx playwright --help
npm ls playwright;
local-playwright-registry assert-local-pkg playwright-core
local-playwright-registry kill
# local-playwright-registry wait-for-ready
# npm_config_cache=$(mktemp -d) npm_config_registry=http://localhost:8989 npm i playwright-core
# local-playwright-registry assert-downloaded playwright-core
