#!/usr/bin/env bash
# A script to roll browser patches from internal repository.

set -e
set +x

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  echo "Usage: $0 <path to playwright-browsers checkout> [firefox|webkit|winldd]"
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

webkit_files=(
  "./webkit/embedder/"
  "./webkit/patches/"
  "./webkit/pw_run.sh"
  "./webkit/UPSTREAM_CONFIG.sh"
)

winldd_files=(
  "./winldd/"
)

case "${FILTER}" in
  firefox)
    files=("${firefox_files[@]}")
    ;;
  webkit)
    files=("${webkit_files[@]}")
    ;;
  winldd)
    files=("${winldd_files[@]}")
    ;;
  "")
    files=("${firefox_files[@]}" "${webkit_files[@]}" "${winldd_files[@]}")
    ;;
  *)
    echo "ERROR: unknown filter '${FILTER}'; supported filters: firefox, webkit, winldd"
    exit 1
    ;;
esac

for file in "${files[@]}"; do
  rsync -av --delete "${SOURCE_DIRECTORY}/browser_patches/${file}" "${SCRIPT_PATH}/${file}"
done

