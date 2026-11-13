#!/usr/bin/env bash
set -e

if [[ $# != 1 || $1 == "--help" ]]; then
  echo "usage: $(basename $0) <version>"
  echo
  echo "Checks that all packages of the given version, for example 1.65.2, are live on npm."
  echo
  echo "publish_all_packages.sh publishes the packages under <tag>-pending. npm makes a package live"
  echo "after it processes it, and that can take hours. Run this before you publish the GitHub release:"
  echo "the promote-npm job of publish_manual.yml moves <tag> to the version only when this check passes."
  exit 1
fi

VERSION="$1"
if [[ "${VERSION}" == v* ]]; then
  echo "ERROR: the version must not start with \"v\""
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "ERROR: NPM is not found"
  exit 1
fi

cd "$(dirname $0)/.."

PACKAGES=()
MISSING=()
for package in $(node ./utils/workspace.js --list-public-package-paths); do
  PACKAGE="$(node -p "require('${package}/package.json').name")@${VERSION}"
  PACKAGES+=("${PACKAGE}")
  if [[ "$(npm view "${PACKAGE}" version --prefer-online 2>/dev/null)" == "${VERSION}" ]]; then
    echo "live:     ${PACKAGE}"
  else
    echo "NOT live: ${PACKAGE}"
    MISSING+=("${PACKAGE}")
  fi
done

if [[ ${#MISSING[@]} != 0 ]]; then
  echo "ERROR: ${#MISSING[@]} of ${#PACKAGES[@]} packages are not live on npm"
  exit 1
fi

echo "All ${#PACKAGES[@]} packages of version ${VERSION} are live on npm."
