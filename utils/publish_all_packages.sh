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
  echo "Publishes all packages under <tag>-pending; the promote-npm job of publish_release.yml or publish_manual.yml moves <tag> to them."
  echo
  echo "--release                publish the @latest version of all packages"
  echo "--alpha                  publish the @next version of all packages"
  echo "--beta                   publish the @beta version of all packages"
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

# A successful `npm publish` only means the registry accepted the package: it goes live after npm
# processes it, usually within 3 minutes, but playwright-core@1.65.0 took 110 minutes, during which
# playwright@latest depended on a missing package. So the packages are published under
# "<tag>-pending" and <tag> stays where it is: the promote-npm job of publish_release.yml moves it once
# all of them are live, reading the list of published packages from npm-publish.json. For a patch
# release, the promote-npm job of publish_manual.yml moves it when the GitHub release is published.
echo "==================== Publishing version ${VERSION} ================"
node ./utils/workspace.js --ensure-consistent
PACKAGE_PATHS=$(node ./utils/workspace.js --list-public-package-paths)
PACKAGE_NAMES=()
for package in ${PACKAGE_PATHS}; do
  PACKAGE_NAMES+=("$(node -p "require('${package}/package.json').name")")
  npm publish --access=public "${package}" --tag="${NPM_PUBLISH_TAG}-pending"
done

node -e 'const [version, tag, ...packages] = process.argv.slice(1); console.log(JSON.stringify({ version, tag, packages }, null, 2));' \
  "${VERSION}" "${NPM_PUBLISH_TAG}" "${PACKAGE_NAMES[@]}" > npm-publish.json

echo "Done."
