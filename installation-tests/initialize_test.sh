#!/bin/bash

# break script execution if some command returns non-zero exit code
set -e

function build_packages() {
  local PACKAGE_BUILDER="../../utils/pack_package.js"
  rm -rf ./output
  mkdir ./output
  pushd ./output >/dev/null

  node ${PACKAGE_BUILDER} playwright-core "${PLAYWRIGHT_CORE_TGZ}" 2>&1 1>/dev/null
  node ${PACKAGE_BUILDER} playwright-test "${PLAYWRIGHT_TEST_TGZ}" 2>&1 1>/dev/null
  node ${PACKAGE_BUILDER} playwright "${PLAYWRIGHT_TGZ}" 2>&1 1>/dev/null
  node ${PACKAGE_BUILDER} playwright-chromium "${PLAYWRIGHT_CHROMIUM_TGZ}" 2>&1 1>/dev/null
  node ${PACKAGE_BUILDER} playwright-webkit "${PLAYWRIGHT_WEBKIT_TGZ}" 2>&1 1>/dev/null
  node ${PACKAGE_BUILDER} playwright-firefox "${PLAYWRIGHT_FIREFOX_TGZ}" 2>&1 1>/dev/null
  popd >/dev/null
}

function cecho(){
  local RED="\033[0;31m"
  local GREEN="\033[0;32m"
  local YELLOW="\033[1;33m"
  local NC="\033[0m" # No Color
  printf "${!1}${2} ${NC}\n"
}

function complete_test {
  set +x
  if [[ $? == 0 ]]; then
    echo
    cecho "GREEN" "<<<<<<<<<<<<"
    cecho "GREEN" "  Test '${TEST_FILE}' PASSED"
    cecho "GREEN" "<<<<<<<<<<<<"
  else
    cecho "RED" "<<<<<<<<<<<<"
    cecho "RED" "  Test '${TEST_FILE}' FAILED"
    cecho "RED" "  To debug locally, run:"
    cecho "RED" "       bash ${TEST_PATH} --debug"
    cecho "RED" "<<<<<<<<<<<<"
    echo
  fi
  echo
}

function setup_env_variables() {
  # Package paths.
  SCRIPTS_PATH="$(pwd -P)"
  TEST_ROOT="/tmp/playwright-installation-tests"
  NODE_VERSION=$(node -e "console.log(process.version.slice(1).split('.')[0])")

  PLAYWRIGHT_CORE_TGZ="${PWD}/output/playwright-core.tgz"
  PLAYWRIGHT_TGZ="${PWD}/output/playwright.tgz"
  PLAYWRIGHT_CHROMIUM_TGZ="${PWD}/output/playwright-chromium.tgz"
  PLAYWRIGHT_WEBKIT_TGZ="${PWD}/output/playwright-webkit.tgz"
  PLAYWRIGHT_FIREFOX_TGZ="${PWD}/output/playwright-firefox.tgz"
  PLAYWRIGHT_TEST_TGZ="${PWD}/output/playwright-test.tgz"
}

function clean_test_root() {
  rm -rf "${TEST_ROOT}"
  mkdir -p "${TEST_ROOT}"
}

function initialize_test {
  trap "complete_test;cd $(pwd -P)" EXIT
  cd "$(dirname $0)"

  # cleanup environment
  unset PLAYWRIGHT_DOWNLOAD_HOST
  unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
  export PLAYWRIGHT_BROWSERS_PATH=0

  setup_env_variables

  if [[ "$1" != "--no-build" && "$2" != "--no-build" ]]; then
    echo 'Building packages... NOTE: run with `--no-build` to reuse previous builds'
    build_packages
  else
    if [[ ! -f "${PLAYWRIGHT_TGZ}" || \
          ! -f "${PLAYWRIGHT_CORE_TGZ}" || \
          ! -f "${PLAYWRIGHT_CHROMIUM_TGZ}" || \
          ! -f "${PLAYWRIGHT_WEBKIT_TGZ}" || \
          ! -f "${PLAYWRIGHT_FIREFOX_TGZ}" || \
          ! -f "${PLAYWRIGHT_TEST_TGZ}" ]]; then
      echo 'ERROR: cannot run test with `--no-build` flag! One of the packages is missing!'
      exit 1
    fi
  fi
  if [[ "$1" != "--do-not-clean-test-root" && "$2" != "--do-not-clean-test-root" ]]; then
    clean_test_root
  fi
  cd ${TEST_ROOT}
  TEST_FILE=$(basename $0)
  TEST_NAME=$(basename ${0%%.sh})
  TEST_PATH="${PWD}/${TEST_FILE}"

  cecho "YELLOW" ">>>>>>>>>>>>"
  cecho "YELLOW" "  Running test - '${TEST_FILE}'"
  cecho "YELLOW" ">>>>>>>>>>>>"
  mkdir ${TEST_NAME} && cd ${TEST_NAME} && npm init -y 1>/dev/null 2>/dev/null

  # enable bash lines logging if --debug is passed
  if [[ $1 == "--debug" || $2 == "--debug" ]]; then
    set -x
  fi
}

function copy_test_scripts {
  cp "${SCRIPTS_PATH}/inspector-custom-executable.js" .
  cp "${SCRIPTS_PATH}/sanity.js" .
  cp "${SCRIPTS_PATH}/screencast.js" .
  cp "${SCRIPTS_PATH}/validate-dependencies.js" .
  cp "${SCRIPTS_PATH}/validate-dependencies-skip-executable-path.js" .
  cp "${SCRIPTS_PATH}/esm.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-chromium.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-firefox.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-webkit.mjs" .
  cp "${SCRIPTS_PATH}/esm-playwright-test.mjs" .
  cp "${SCRIPTS_PATH}/sanity-electron.js" .
  cp "${SCRIPTS_PATH}/electron-app.js" .
  cp "${SCRIPTS_PATH}/driver-client.js" .
  cp "${SCRIPTS_PATH}/sample.spec.js" .
  cp "${SCRIPTS_PATH}/failing.spec.js" .
  cp "${SCRIPTS_PATH}/read-json-report.js" .
  cp "${SCRIPTS_PATH}/playwright-test-types.ts" .
}

