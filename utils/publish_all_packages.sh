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
  echo "usage: $(basename $0) [--release|--release-candidate|--alpha|--beta]"
  echo
  echo "Publishes all packages."
  echo
  echo "--release                publish @latest version of all packages"
  echo "--release-candidate      publish @rc version of all packages"
  echo "--alpha                  publish @next version of all packages"
  echo "--beta                   publish @beta version of all packages"
  exit 1
fi

if [[ $# < 1 ]]; then
  echo "Please specify either --release, --beta or --alpha or --release-candidate"
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

if [[ "$1" == "--release" ]]; then
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
elif [[ "$1" == "--release-candidate" ]]; then
  if [[ -n $(git status -s) ]]; then
    echo "ERROR: git status is dirty; some uncommitted changes or untracked files"
    exit 1
  fi
  # Ensure package version is properly formatted.
  if [[ "${VERSION}" != *-rc* ]]; then
    echo "ERROR: release candidate version must have a dash"
    exit 1
  fi
  NPM_PUBLISH_TAG="rc"
elif [[ "$1" == "--alpha" ]]; then
  # Ensure package version contains alpha and does not contain rc
  if [[ "${VERSION}" != *-alpha* || "${VERSION}" == *-rc* ]]; then
    echo "ERROR: cannot publish release version with --alpha flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="next"
elif [[ "$1" == "--beta" ]]; then
  # Ensure package version contains dash.
  if [[ "${VERSION}" != *-beta* || "${VERSION}" == *-rc* ]]; then
    echo "ERROR: cannot publish release version with --beta flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="beta"
else
  echo "unknown argument - '$1'"
  exit 1
fi

echo "==================== Publishing version ${VERSION} ================"
node ./utils/workspace.js --ensure-consistent
node ./utils/workspace.js --list-public-package-paths | while read package
do
  npm publish --access=public ${package} --tag="${NPM_PUBLISH_TAG}" --provenance
done

echo "Done."
