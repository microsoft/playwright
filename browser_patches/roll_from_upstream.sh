#!/usr/bin/env bash
# A script to roll browser patches from the repositories where the browsers are built.

set -e
set +x

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  echo "Usage: $0 <path to playwright-browsers checkout> [firefox|winldd]"
  echo
  echo "To roll ./webkit, run this in a playwright-webkit checkout:"
  echo "  playwright/export.sh <path to playwright checkout> [<ref>]"
  exit 1
fi

if ! [[ -d "$1" ]]; then
  echo "ERROR: the source directory $1 does not exist"
  exit 1
fi

SOURCE_DIRECTORY="$(cd "$1" && pwd -P)"
FILTER="${2:-}"

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

SCRIPT_PATH=$(pwd -P)

# WebKit is developed in playwright-webkit as commits on top of upstream WebKit, not as
# patch files. A script of that repository writes ./webkit.
if [[ "${FILTER}" == "webkit" ]]; then
  echo "ERROR: this script does not roll webkit. In a playwright-webkit checkout, run:"
  echo "  playwright/export.sh $(dirname "${SCRIPT_PATH}") [<ref>]"
  exit 1
fi

# On CI, the playwright-browsers checkout directory can have an arbitrary name,
# so detect the checkout by a marker file instead of the directory name.
if ! [[ -f "${SOURCE_DIRECTORY}/browser_patches/build_flavors.sh" ]]; then
  echo "ERROR: ${SOURCE_DIRECTORY} does not look like a playwright-browsers checkout"
  exit 1
fi

firefox_files=(
  "./firefox/juggler/"
  "./firefox/patches/"
  "./firefox/preferences/"
  "./firefox/UPSTREAM_CONFIG.sh"
)

winldd_files=(
  "./winldd/"
)

case "${FILTER}" in
  firefox)
    files=("${firefox_files[@]}")
    ;;
  winldd)
    files=("${winldd_files[@]}")
    ;;
  "")
    files=("${firefox_files[@]}" "${winldd_files[@]}")
    ;;
  *)
    echo "ERROR: unknown filter '${FILTER}'; supported filters: firefox, winldd"
    exit 1
    ;;
esac

for file in "${files[@]}"; do
  rsync -av --delete "${SOURCE_DIRECTORY}/browser_patches/${file}" "${SCRIPT_PATH}/${file}"
done
