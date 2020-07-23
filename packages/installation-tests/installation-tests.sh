#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

rm -rf ./output
mkdir ./output
cd ./output

# cleanup environment
unset PLAYWRIGHT_DOWNLOAD_HOST
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
export PLAYWRIGHT_BROWSERS_PATH=0

# Pack all packages and put them in our output folder.
PACKAGE_BUILDER="../../../packages/build_package.js"
PLAYWRIGHT_CORE_TGZ="$(node ${PACKAGE_BUILDER} playwright-core ./playwright-core.tgz)"
PLAYWRIGHT_TGZ="$(node ${PACKAGE_BUILDER} playwright ./playwright.tgz)"
PLAYWRIGHT_CHROMIUM_TGZ="$(node ${PACKAGE_BUILDER} playwright-chromium ./playwright-chromium.tgz)"
PLAYWRIGHT_WEBKIT_TGZ="$(node ${PACKAGE_BUILDER} playwright-webkit ./playwright-webkit.tgz)"
PLAYWRIGHT_FIREFOX_TGZ="$(node ${PACKAGE_BUILDER} playwright-firefox ./playwright-firefox.tgz)"

SCRIPTS_PATH="$(pwd -P)/.."
TEST_ROOT="$(pwd -P)"
NODE_VERSION="$(node --version)"

function copy_test_scripts {
  cp "${SCRIPTS_PATH}/sanity.js" .
  cp "${SCRIPTS_PATH}/esm-playwright.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-chromium.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-firefox.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-webkit.mjs" .
}

function run_tests {
  test_typescript_types
  test_skip_browser_download
  test_playwright_global_installation_subsequent_installs
  test_playwright_should_work
  test_playwright_chromium_should_work
  test_playwright_webkit_should_work
  test_playwright_firefox_should_work
  test_playwright_global_installation
}

function test_typescript_types {
  initialize_test "${FUNCNAME[0]}"

  # install all packages.
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_CORE_TGZ}
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_TGZ}
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_FIREFOX_TGZ}
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_WEBKIT_TGZ}
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install ${PLAYWRIGHT_CHROMIUM_TGZ}

  # typecheck all packages.
  for PKG_NAME in "playwright" \
                  "playwright-core" \
                  "playwright-firefox" \
                  "playwright-chromium" \
                  "playwright-webkit"
  do
    echo "Checking types of ${PKG_NAME}"
    echo "import { Page } from '${PKG_NAME}';" > "${PKG_NAME}.ts" && tsc "${PKG_NAME}.ts"
  done;
}

function test_playwright_global_installation {
  initialize_test "${FUNCNAME[0]}"

  local BROWSERS="$(pwd -P)/browsers"
  PLAYWRIGHT_BROWSERS_PATH="${BROWSERS}" npm install ${PLAYWRIGHT_TGZ}
  if [[ ! -d "${BROWSERS}" ]]; then
    echo "Directory for shared browsers was not created!"
    exit 1
  fi
  copy_test_scripts
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

  npm install ${PLAYWRIGHT_TGZ}
  copy_test_scripts
  node sanity.js playwright chromium firefox webkit
  if [[ "${NODE_VERSION}" == *"v14."* ]]; then
    node esm-playwright.mjs
  fi
}

function test_playwright_chromium_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_CHROMIUM_TGZ}
  copy_test_scripts
  node sanity.js playwright-chromium chromium
  if [[ "${NODE_VERSION}" == *"v14."* ]]; then
    node esm-playwright-chromium.mjs
  fi
}

function test_playwright_webkit_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_WEBKIT_TGZ}
  copy_test_scripts
  node sanity.js playwright-webkit webkit
  if [[ "${NODE_VERSION}" == *"v14."* ]]; then
    node esm-playwright-webkit.mjs
  fi
}

function test_playwright_firefox_should_work {
  initialize_test "${FUNCNAME[0]}"

  npm install ${PLAYWRIGHT_FIREFOX_TGZ}
  copy_test_scripts
  node sanity.js playwright-firefox firefox
  if [[ "${NODE_VERSION}" == *"v14."* ]]; then
    node esm-playwright-firefox.mjs
  fi
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
