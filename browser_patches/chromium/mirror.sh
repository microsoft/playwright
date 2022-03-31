#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

USAGE=$(cat<<EOF
  usage: $(basename "$0") [--linux|--win64|--mac]

  Mirrors Chromium from Chromium Continuous Builds CDN.
EOF
)

SCRIPT_FOLDER=$(pwd -P)
source "${SCRIPT_FOLDER}/../utils.sh"

main() {
  if [[ $1 == "--help" || $1 == "-h" ]]; then
    echo "$USAGE"
    exit 0
  else
    mirror_chromium "$1"
  fi
}

mirror_chromium() {
  cd "$SCRIPT_FOLDER"
  rm -rf output
  mkdir -p output
  cd output

  CHROMIUM_URL=""

  PLATFORM="$1"
  if [[ -z "${PLATFORM}" ]]; then
    CURRENT_HOST_OS="$(uname)"
    if [[ "${CURRENT_HOST_OS}" == "Darwin" ]]; then
      PLATFORM="--mac"
    elif [[ "${CURRENT_HOST_OS}" == "Linux" ]]; then
      PLATFORM="--linux"
    elif [[ "${CURRENT_HOST_OS}" == MINGW* || "${CURRENT_HOST_OS}" == MSYS* ]]; then
      PLATFORM="--win64"
    else
      echo "ERROR: unsupported host platform - ${CURRENT_HOST_OS}"
      exit 1
    fi
  fi

  CRREV=$(head -1 "${SCRIPT_FOLDER}/BUILD_NUMBER")
  if [[ "${PLATFORM}" == "--win64" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${CRREV}/chrome-win.zip"
  elif [[ "${PLATFORM}" == "--mac" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Mac/${CRREV}/chrome-mac.zip"
  elif [[ "${PLATFORM}" == "--linux" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${CRREV}/chrome-linux.zip"
  else
    echo "ERROR: unknown platform to build: $1"
    exit 1
  fi

  echo "--> Pulling Chromium ${CRREV} for ${PLATFORM#--}"

  curl --output chromium-upstream.zip "${CHROMIUM_URL}"
  unzip chromium-upstream.zip
}

main "$1" "$2" "$3"
