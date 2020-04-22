#!/bin/bash
set -e
set -x

trap "cd $(pwd -P)" EXIT
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
  # Ensure package version contains dash.
  if [[ "${VERSION}" != *-* ]]; then
    echo "ERROR: cannot publish release version with --tip-of-tree flag"
    exit 1
  fi

  # Ensure this is actually tip-of-tree.
  UPSTREAM_SHA=$(git ls-remote https://github.com/microsoft/playwright --tags $(git rev-parse --abbrev-ref HEAD) | cut -f1)
  CURRENT_SHA=$(git rev-parse HEAD)
  if [[ "${UPSTREAM_SHA}" != "${CURRENT_SHA}" ]]; then
    echo "REFUSING TO PUBLISH: this is not tip-of-tree"
    exit 1
  fi
  NPM_PUBLISH_TAG="next"
else
  echo "unknown argument - '$1'"
  exit 1
fi

npm run clean
npm publish .                            --tag="${NPM_PUBLISH_TAG}"
npm publish packages/playwright-firefox  --tag="${NPM_PUBLISH_TAG}"
npm publish packages/playwright-webkit   --tag="${NPM_PUBLISH_TAG}"
npm publish packages/playwright-chromium --tag="${NPM_PUBLISH_TAG}"
npm publish packages/playwright          --tag="${NPM_PUBLISH_TAG}"

echo "Done."
