#!/usr/bin/env bash
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
  echo "usage: $(basename $0) [--release|--alpha|--beta]"
  echo
  echo "Publishes all packages."
  echo
  echo "--release                publish @latest version of all packages"
  echo "--alpha                  publish @next version of all packages"
  echo "--beta                   publish @beta version of all packages"
  exit 1
fi

if [[ $# < 1 ]]; then
  echo "Please specify either --release, --beta or --alpha"
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "ERROR: NPM is not found"
  exit 1
fi

cd ..

NPM_PUBLISH_TAG="next"

VERSION=$(node -e 'console.log(require("./package.json").version)')

if [[ "$1" == "--release" ]]; then
  if [[ -n $(git status -s) ]]; then
    echo "ERROR: git status is dirty; some uncommitted changes or untracked files"
    exit 1
  fi
  # Ensure package version does not contain dash.
  if [[ "${VERSION}" == *-* ]]; then
    echo "ERROR: cannot publish pre-release version ${VERSION} with --release flag"
    exit 1
  fi
  NPM_PUBLISH_TAG="latest"
elif [[ "$1" == "--alpha" ]]; then
  # Ensure package version contains alpha.
  if [[ "${VERSION}" != *-alpha* ]]; then
    echo "ERROR: cannot publish release version ${VERSION} with --alpha flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="next"
elif [[ "$1" == "--beta" ]]; then
  # Ensure package version contains beta.
  if [[ "${VERSION}" != *-beta* ]]; then
    echo "ERROR: cannot publish release version ${VERSION} with --beta flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="beta"
else
  echo "unknown argument - '$1'"
  exit 1
fi

# A successful `npm publish` only means the registry accepted the package: it is processed
# asynchronously and may show up minutes later, or never (playwright-core@1.65.0 never did,
# leaving playwright@1.65.0 on @latest pointing to a missing dependency).
function wait_until_available {
  local name="$1"
  local attempt
  for attempt in $(seq 60); do
    if [[ "$(npm view "${name}@${VERSION}" version --prefer-online 2>/dev/null)" == "${VERSION}" ]]; then
      return 0
    fi
    sleep 15
  done
  echo "ERROR: ${name}@${VERSION} was accepted by npm but did not become available within 15 minutes"
  return 1
}

echo "==================== Publishing version ${VERSION} ================"
node ./utils/workspace.js --ensure-consistent
# Packages are listed in dependency order. Wait for each one to go live before publishing the next,
# so nothing is published (and tagged) while a package it depends on is missing.
PACKAGE_PATHS=$(node ./utils/workspace.js --list-public-package-paths)
for package in ${PACKAGE_PATHS}; do
  name=$(node -p "require('${package}/package.json').name")
  npm publish --access=public "${package}" --tag="${NPM_PUBLISH_TAG}"
  wait_until_available "${name}"
done

echo "Done."
