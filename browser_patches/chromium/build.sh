#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

rm -rf output
mkdir -p output
cd output

CRREV=$(head -1 ../BUILD_NUMBER)

CHROMIUM_URL=""
CHROMIUM_FOLDER_NAME=""
CHROMIUM_FILES_TO_REMOVE=()

PLATFORM="$1"
if [[ -z "${PLATFORM}" ]]; then
  CURRENT_HOST_OS="$(uname)"
  if [[ "${CURRENT_HOST_OS}" == "Darwin" ]]; then
    PLATFORM="--mac"
  elif [[ "${CURRENT_HOST_OS}" == "Linux" ]]; then
    PLATFORM="--linux"
  elif [[ "${CURRENT_HOST_OS}" == MINGW* ]]; then
    PLATFORM="--win64"
  else
    echo "ERROR: unsupported host platform - ${CURRENT_HOST_OS}"
    exit 1
  fi
fi

if [[ "${PLATFORM}" == "--win32" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win/${CRREV}/chrome-win.zip"
  CHROMIUM_FOLDER_NAME="chrome-win"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
elif [[ "${PLATFORM}" == "--win64" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${CRREV}/chrome-win.zip"
  CHROMIUM_FOLDER_NAME="chrome-win"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
elif [[ "${PLATFORM}" == "--mac" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Mac/${CRREV}/chrome-mac.zip"
  CHROMIUM_FOLDER_NAME="chrome-mac"
elif [[ "${PLATFORM}" == "--linux" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${CRREV}/chrome-linux.zip"
  CHROMIUM_FOLDER_NAME="chrome-linux"
else
  echo "ERROR: unknown platform to build: $1"
  exit 1
fi

echo "--> Pulling Chromium ${CRREV} for ${PLATFORM#--}"

curl --output chromium-upstream.zip "${CHROMIUM_URL}"
unzip chromium-upstream.zip
for file in ${CHROMIUM_FILES_TO_REMOVE[@]}; do
  rm -f "${file}"
done

zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
