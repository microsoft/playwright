#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

# 1. Pack all packages.

rm -rf ./output
mkdir ./output
cd ./output

npm pack ../../..
npm pack ../../../packages/playwright
npm pack ../../../packages/playwright-chromium
npm pack ../../../packages/playwright-webkit
npm pack ../../../packages/playwright-firefox

# cleanup environment
unset PLAYWRIGHT_DOWNLOAD_HOST
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
export PLAYWRIGHT_BROWSERS_PATH=0

# There is no option to specify output for `npm pack`, but the format is
# fixed.
PACKAGE_VERSION=$(node -e 'console.log(require("../../../package.json").version)')
PLAYWRIGHT_CORE_TGZ="$(pwd -P)/playwright-core-${PACKAGE_VERSION}.tgz"
PLAYWRIGHT_TGZ="$(pwd -P)/playwright-${PACKAGE_VERSION}.tgz"
PLAYWRIGHT_CHROMIUM_TGZ="$(pwd -P)/playwright-chromium-${PACKAGE_VERSION}.tgz"
PLAYWRIGHT_WEBKIT_TGZ="$(pwd -P)/playwright-webkit-${PACKAGE_VERSION}.tgz"
PLAYWRIGHT_FIREFOX_TGZ="$(pwd -P)/playwright-firefox-${PACKAGE_VERSION}.tgz"

SANITY_JS="$(pwd -P)/../sanity.js"
TEST_ROOT="$(pwd -P)"

function run_tests {
  test_skip_browser_download
  test_playwright_global_installation_subsequent_installs
  test_playwright_should_work
  test_playwright_chromium_should_work
  test_playwright_webkit_should_work
  test_playwright_firefox_should_work
  test_playwright_global_installation
}

function test_playwright_global_installation {
  initialize_test "${FUNCNAME[0]}"

  local BROWSERS="$(pwd -P)/browsers"
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_CORE_TGZ}
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
  if [[ ! -d "${BROWSERS}" ]]; then
    echo "Directory for shared browsers was not created!"
    exit 1
  fi
  cp ${SANITY_JS} .
  if node sanity.js playwright chromium 2>/dev/null; then
    echo "Should not be able to launch chromium without PLAYWRIGHT_BROWSERS_PATH variable!"
    exit 1
  fi
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node sanity.js playwright chromium
}


# @see https://github.com/microsoft/playwright/issues/1651
function test_playwright_global_installation_subsequent_installs {
  initialize_test "${FUNCNAME[0]}"

  local BROWSERS="$(pwd -P)/browsers"

  mkdir install-1 && pushd install-1 && npm init -y
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_CORE_TGZ}
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
  # Note: the `npm install` would not actually crash, the error
  # is merely logged to the console. To reproduce the error, we should make
  # sure that script's install.js can be run subsequently without unhandled promise rejections.
  # Note: the flag `--unahdnled-rejections=strict` will force node to terminate in case
  # of UnhandledPromiseRejection.
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" node --unhandled-rejections=strict node_modules/playwright/install.js
}

function test_skip_browser_download {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CORE_TGZ}
  OUTPUT=$(PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_TGZ})
  if [[ "${OUTPUT}" != *"Skipping browsers download because"* ]]; then
    echo "missing log message that browsers download is skipped"
    exit 1
  fi

  if [[ -d ./node_modules/playwright/.local-browsers ]]; then
    echo "local browsers folder should be empty"
    exit 1
  fi
}

function test_playwright_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CORE_TGZ}
  npm install ${PLAYWRIGHT_TGZ}
  cp ${SANITY_JS} . && node sanity.js playwright chromium firefox webkit
}

function test_playwright_chromium_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CORE_TGZ}
  npm install ${PLAYWRIGHT_CHROMIUM_TGZ}
  cp ${SANITY_JS} . && node sanity.js playwright-chromium chromium
}

function test_playwright_webkit_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CORE_TGZ}
  npm install ${PLAYWRIGHT_WEBKIT_TGZ}
  cp ${SANITY_JS} . && node sanity.js playwright-webkit webkit
}

function test_playwright_firefox_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CORE_TGZ}
  npm install ${PLAYWRIGHT_FIREFOX_TGZ}
  cp ${SANITY_JS} . && node sanity.js playwright-firefox firefox
}

function initialize_test {
  cd ${TEST_ROOT}
  local TEST_NAME="./$1"
  mkdir ${TEST_NAME} && cd ${TEST_NAME} && npm init -y
  echo "====================================================================================="
  echo "====================================================================================="
  echo
  echo "  RUNNING TEST:  ${TEST_NAME}"
  echo
  echo "====================================================================================="
  echo "====================================================================================="
}

# Run all tests
# Script will terminate if there's some error somewhere.
run_tests

echo
echo "SUCCESS!"
