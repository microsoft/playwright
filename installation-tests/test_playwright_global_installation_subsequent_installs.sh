#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

# @see https://github.com/microsoft/playwright/issues/1651

BROWSERS="$(pwd -P)/browsers"

mkdir install-1 && pushd install-1 && npm init -y
npm install ${PLAYWRIGHT_CORE_TGZ}
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
# Note: the `npm install` would not actually crash, the error
# is merely logged to the console. To reproduce the error, we should make
# sure that script's install.js can be run subsequently without unhandled promise rejections.
# Note: the flag `--unahdnled-rejections=strict` will force node to terminate in case
# of UnhandledPromiseRejection.
PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node --unhandled-rejections=strict node_modules/playwright/install.js

