#!/bin/bash

# break script execution if some command returns non-zero exit code
set -e

TEST_FRAMEWORK_RUN_ROOT="/tmp/playwright-installation-tests"

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

function report_test_result {
  RV=$?
  set +x
  if [[ $RV == 0 ]]; then
    echo
    cecho "GREEN" "<<<<<<<<<<<<"
    cecho "GREEN" "  Test '${TEST_FILE}' PASSED"
    cecho "GREEN" "<<<<<<<<<<<<"
  else
    cecho "RED" "<<<<<<<<<<<<"
    cecho "RED" "  Test '${TEST_FILE}' FAILED"
    cecho "RED" "  To debug locally, run:"
    cecho "RED" "       bash ${TEST_FILE}"
    cecho "RED" "<<<<<<<<<<<<"
    echo
  fi
  echo
}

function setup_env_variables() {
  # Package paths.
  NODE_VERSION=$(node -e "console.log(process.version.slice(1).split('.')[0])")

  export PLAYWRIGHT_CORE_TGZ="${PWD}/output/playwright-core.tgz"
  export PLAYWRIGHT_TGZ="${PWD}/output/playwright.tgz"
  export PLAYWRIGHT_CHROMIUM_TGZ="${PWD}/output/playwright-chromium.tgz"
  export PLAYWRIGHT_WEBKIT_TGZ="${PWD}/output/playwright-webkit.tgz"
  export PLAYWRIGHT_FIREFOX_TGZ="${PWD}/output/playwright-firefox.tgz"
  export PLAYWRIGHT_TEST_TGZ="${PWD}/output/playwright-test.tgz"
  PLAYWRIGHT_CHECKOUT="${PWD}/.."
  export PLAYWRIGHT_VERSION_UNDER_TEST="$(node ${PLAYWRIGHT_CHECKOUT}/utils/workspace.js --get-version)"
}

function clean_test_root() {
  rm -rf "${TEST_FRAMEWORK_RUN_ROOT}"
  mkdir -p "${TEST_FRAMEWORK_RUN_ROOT}"
}

function initialize_test {
  trap "report_test_result; kill %1; cd $(pwd -P);" EXIT
  cd "$(dirname $0)"

  # cleanup environment
  unset PLAYWRIGHT_DOWNLOAD_HOST
  unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
  export PLAYWRIGHT_BROWSERS_PATH=0

  local SCRIPTS_PATH="$(pwd -P)"
  setup_env_variables
  TEST_FILE=$(basename $0)
  TEST_NAME=$(basename ${0%%.sh})

  # Check if test tries to install using npm directly
  if grep 'npm i.*playwright' "$0" 2>&1 >/dev/null; then
    # If it does, this is an error: you will miss output
    cecho "RED" "ERROR: test tries to install playwright-family package from NPM registry!"
    cecho "RED" "       Do not use NPM to install playwright packages!"
    cecho "RED" "       Instead, use 'npm_i' command to install local package"
    exit 1
  fi

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
  cd ${TEST_FRAMEWORK_RUN_ROOT}

  cecho "YELLOW" ">>>>>>>>>>>>"
  cecho "YELLOW" "  Running test - '${TEST_FILE}'"
  cecho "YELLOW" "  Workdir - ${PWD}/${TEST_NAME}"
  cecho "YELLOW" ">>>>>>>>>>>>"
  mkdir ${TEST_NAME} && cd ${TEST_NAME} && npm init -y 1>/dev/null 2>/dev/null

  cp "${SCRIPTS_PATH}/fixture-scripts/"* .
  export PATH="${SCRIPTS_PATH}/bin:${PATH}"

  # Start up our local registry and configure npm to use it
  local-playwright-registry start &
  TEST_TMP_NPM_SCRATCH_SPACE="${TEST_FRAMEWORK_RUN_ROOT}/${TEST_NAME}--npm-scratch-space"
  export npm_config_prefix="$TEST_TMP_NPM_SCRATCH_SPACE/npm_prefix"
  export npm_config_cache="$TEST_TMP_NPM_SCRATCH_SPACE/npm_cache"
  export npm_config_registry="$(local-playwright-registry wait-for-ready)"
  export EXPECTED_NODE_MODULES_PARENT="$(pwd -P)"
  echo '.playwright-registry/' >> .gitignore

  # Enable bash lines logging.
  set -x
}
