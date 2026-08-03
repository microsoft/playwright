#!/usr/bin/env bash
set -e
set -o pipefail
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
  echo "usage: $(basename $0) [--release|--alpha|--beta] [--pack-destination <dir>]"
  echo
  echo "Publishes all packages, or packs them into <dir> for ESRP."
  echo
  echo "--release                publish @latest version of all packages"
  echo "--alpha                  publish @next version of all packages"
  echo "--beta                   publish @beta version of all packages"
  echo "--pack-destination <dir> pack .tgz files into <dir> instead of npm publish"
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

CHANNEL=""
PACK_DESTINATION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release|--alpha|--beta)
      if [[ -n "${CHANNEL}" ]]; then
        echo "ERROR: multiple channel flags specified"
        exit 1
      fi
      CHANNEL="$1"
      shift
      ;;
    --pack-destination)
      if [[ -z "${2:-}" ]]; then
        echo "ERROR: --pack-destination requires a directory argument"
        exit 1
      fi
      PACK_DESTINATION="$2"
      shift 2
      ;;
    *)
      echo "unknown argument - '$1'"
      exit 1
      ;;
  esac
done

if [[ -z "${CHANNEL}" ]]; then
  echo "Please specify either --release, --beta or --alpha"
  exit 1
fi

NPM_PUBLISH_TAG="next"

VERSION=$(node -e 'console.log(require("./package.json").version)')

if [[ "${CHANNEL}" == "--release" ]]; then
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
elif [[ "${CHANNEL}" == "--alpha" ]]; then
  # Ensure package version contains alpha.
  if [[ "${VERSION}" != *-alpha* ]]; then
    echo "ERROR: cannot publish release version ${VERSION} with --alpha flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="next"
elif [[ "${CHANNEL}" == "--beta" ]]; then
  # Ensure package version contains beta.
  if [[ "${VERSION}" != *-beta* ]]; then
    echo "ERROR: cannot publish release version ${VERSION} with --beta flag"
    exit 1
  fi

  NPM_PUBLISH_TAG="beta"
fi

node ./utils/workspace.js --ensure-consistent

if [[ -n "${PACK_DESTINATION}" ]]; then
  echo "==================== Packing version ${VERSION} (tag ${NPM_PUBLISH_TAG}) ================"
  mkdir -p "${PACK_DESTINATION}"
  # Record the dist-tag for the ESRP productstate input.
  echo -n "${NPM_PUBLISH_TAG}" > "${PACK_DESTINATION}/.npm-tag"
  node ./utils/workspace.js --list-public-package-paths | while read package
  do
    npm pack --pack-destination="${PACK_DESTINATION}" "${package}"
  done
else
  echo "==================== Publishing version ${VERSION} ================"
  node ./utils/workspace.js --list-public-package-paths | while read package
  do
    npm publish --access=public ${package} --tag="${NPM_PUBLISH_TAG}"
  done
fi

echo "Done."
