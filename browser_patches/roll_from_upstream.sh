#!/usr/bin/env bash
# A script to roll browser patches from internal repository.

set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

SCRIPT_PATH=$(pwd -P)

if [[ "$#" -ne 1 ]]; then
  echo "Usage: $0 <path to playwright-browsers checkout>"
  exit 1
fi

SOURCE_DIRECTORY="$1"

if [[ $(basename "${SOURCE_DIRECTORY}") != "playwright-browsers" ]]; then
  echo "ERROR: the source directory must be named 'playwright-browsers'"
  exit 1
fi

if ! [[ -d "${SOURCE_DIRECTORY}/browser_patches" ]]; then
  echo "ERROR: the ${SOURCE_DIRECTORY}/browser_patches does not exist"
  exit 1
fi

files=(
  "./firefox/juggler/"
  "./firefox/patches/"
  "./firefox/preferences/"
  "./firefox/UPSTREAM_CONFIG.sh"
  "./webkit/embedder/"
  "./webkit/patches/"
  "./webkit/pw_run.sh"
  "./webkit/UPSTREAM_CONFIG.sh"
  "./winldd/"
)

for file in "${files[@]}"; do
  rsync -av --delete "${SOURCE_DIRECTORY}/browser_patches/${file}" "${SCRIPT_PATH}/${file}"
done

