#!/bin/bash
set -e
set +x

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

if [[ $(git rev-parse --abbrev-ref HEAD) != "master" ]]; then
  echo "ERROR: Cannot publish from branch other then 'master'"
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "ERROR: NPM is not found"
  exit 1
fi

if [[ (-n $CI) && (-n $NPM_AUTH_TOKEN) && (! -f $HOME/.npmrc) ]]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}" > $HOME/.npmrc
fi

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: NPM failed to log in"
  exit 1
fi

UPSTREAM_SHA=$(git ls-remote https://github.com/microsoft/playwright --tags master | cut -f1)
CURRENT_SHA=$(git rev-parse HEAD)

if [[ "${UPSTREAM_SHA}" != "${CURRENT_SHA}" ]]; then
  echo "REFUSING TO PUBLISH: this is not tip-of-tree"
  exit 1
fi

cd ..

if [[ $1 == "--release" ]]; then
  if [[ -n $CI ]]; then
    echo "Found \$CI env - cannot publish real release from CI"
    exit 1
  fi
  if [[ -n $(git status -s) ]]; then
    echo "ERROR: git status is dirty; some uncommitted changes or untracked files"
    exit 1
  fi
  VERSION=$(node -e 'console.log(require("./package.json").version)')
  echo -n "Publish Playwright v${VERSION} (y/n)? "
  read ANSWER
  if [[ "$ANSWER" != "y" ]]; then
    echo "Bailing out."
    exit 1
  fi

  npm run clean
  npm publish .
  npm publish packages/playwright-firefox
  npm publish packages/playwright-webkit
  npm publish packages/playwright-chromium
  npm publish packages/playwright
  echo "Done."
elif [[ $1 == "--tip-of-tree" ]]; then
  if [[ -z $CI ]]; then
    echo "Did not find \$CI env - cannot publish tip-of-tree release not from CI"
    exit 1
  fi
  npm run clean
  npm publish . --tag="next"
  npm publish packages/playwright-firefox --tag="next"
  npm publish packages/playwright-webkit --tag="next"
  npm publish packages/playwright-chromium --tag="next"
  npm publish packages/playwright --tag="next"
  echo "Done."
else
  echo "unknown argument - '$1'"
  exit 1
fi

