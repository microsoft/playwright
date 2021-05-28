#!/bin/bash
set -e
set -x

function cleanup {
  # Cleanup all possibly created package tars.
  if [[ ! -z "${PLAYWRIGHT_TGZ}" ]]; then rm -rf "${PLAYWRIGHT_TGZ}"; fi
  if [[ ! -z "${PLAYWRIGHT_CORE_TGZ}" ]]; then rm -rf "${PLAYWRIGHT_CORE_TGZ}"; fi
  if [[ ! -z "${PLAYWRIGHT_WEBKIT_TGZ}" ]]; then rm -rf "${PLAYWRIGHT_WEBKIT_TGZ}"; fi
  if [[ ! -z "${PLAYWRIGHT_FIREFOX_TGZ}" ]]; then rm -rf "${PLAYWRIGHT_FIREFOX_TGZ}"; fi
  if [[ ! -z "${PLAYWRIGHT_CHROMIUM_TGZ}" ]]; then rm -rf "${PLAYWRIGHT_CHROMIUM_TGZ}"; fi
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ $1 == "--help" ]]; then
  echo "usage: $(basename $0) [--release|--tip-of-tree]"
  echo
  echo "Publishes all packages."
  echo
  echo "--release                publish @latest version of all packages"
  echo "--tip-of-tree            publish @next version of all packages"
  exit 1
fi

if [[ $# < 1 ]]; then
  echo "Please specify either --release or --tip-of-tree"
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "ERROR: NPM is not found"
  exit 1
fi

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: NPM is not logged in."
  exit 1
fi

cd ..

NPM_PUBLISH_TAG="next"

VERSION=$(node -e 'console.log(require("./package.json").version)')

if [[ $1 == "--release" ]]; then
  if [[ -n $(git status -s) ]]; then
    echo "ERROR: git status is dirty; some uncommitted changes or untracked files"
    exit 1
  fi
  # Ensure package version does not contain dash.
  if [[ "${VERSION}" == *-* ]]; then
    echo "ERROR: cannot publish pre-release version with --release flag"
    exit 1
  fi
  NPM_PUBLISH_TAG="latest"
elif [[ $1 == "--tip-of-tree" ]]; then
  if [[ $(git status -s) != " M package.json" ]]; then
    echo "ERROR: git status is unexpected; some uncommitted changes or untracked files"
    exit 1
  fi
  # Ensure package version contains dash.
  if [[ "${VERSION}" != *-* ]]; then
    echo "ERROR: cannot publish release version with --tip-of-tree flag"
    exit 1
  fi

  # Ensure this is actually tip-of-tree.
  UPSTREAM_SHA=$(git ls-remote https://github.com/microsoft/playwright --tags $(git rev-parse --abbrev-ref HEAD) | cut -f1)
  CURRENT_SHA=$(git rev-parse HEAD)
  if [[ "${UPSTREAM_SHA}" != "${CURRENT_SHA}" ]]; then
    echo "FYI: REFUSING TO PUBLISH since this is not tip-of-tree"
    exit 0
  fi
  NPM_PUBLISH_TAG="next"
else
  echo "unknown argument - '$1'"
  exit 1
fi

echo "==================== Building version ${VERSION} ================"

PLAYWRIGHT_TGZ="$PWD/playwright.tgz"
PLAYWRIGHT_CORE_TGZ="$PWD/playwright-core.tgz"
PLAYWRIGHT_WEBKIT_TGZ="$PWD/playwright-webkit.tgz"
PLAYWRIGHT_FIREFOX_TGZ="$PWD/playwright-firefox.tgz"
PLAYWRIGHT_CHROMIUM_TGZ="$PWD/playwright-chromium.tgz"
PLAYWRIGHT_TEST_TGZ="$PWD/playwright-test.tgz"
node ./packages/build_package.js playwright "${PLAYWRIGHT_TGZ}"
node ./packages/build_package.js playwright-core "${PLAYWRIGHT_CORE_TGZ}"
node ./packages/build_package.js playwright-webkit "${PLAYWRIGHT_WEBKIT_TGZ}"
node ./packages/build_package.js playwright-firefox "${PLAYWRIGHT_FIREFOX_TGZ}"
node ./packages/build_package.js playwright-chromium "${PLAYWRIGHT_CHROMIUM_TGZ}"
node ./packages/build_package.js playwright-test "${PLAYWRIGHT_TEST_TGZ}"

echo "==================== Publishing version ${VERSION} ================"

npm publish ${PLAYWRIGHT_TGZ}           --tag="${NPM_PUBLISH_TAG}"
npm publish ${PLAYWRIGHT_CORE_TGZ}      --tag="${NPM_PUBLISH_TAG}"
npm publish ${PLAYWRIGHT_WEBKIT_TGZ}    --tag="${NPM_PUBLISH_TAG}"
npm publish ${PLAYWRIGHT_FIREFOX_TGZ}   --tag="${NPM_PUBLISH_TAG}"
npm publish ${PLAYWRIGHT_CHROMIUM_TGZ}  --tag="${NPM_PUBLISH_TAG}"
npm publish ${PLAYWRIGHT_TEST_TGZ}      --tag="${NPM_PUBLISH_TAG}"

echo "Done."
