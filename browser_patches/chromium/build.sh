#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

rm -rf output
mkdir -p output
cd output

BUILD_NUMBER=$(head -1 ../BUILD_NUMBER)

CHROMIUM_URL=""
CHROMIUM_FOLDER_NAME=""
CHROMIUM_FILES_TO_REMOVE=()

FFMPEG_VERSION="4.3.1"
FFMPEG_URL=""
FFMPEG_BIN_PATH=""

if [[ $1 == "--win32" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win/${BUILD_NUMBER}/chrome-win.zip"
  CHROMIUM_FOLDER_NAME="chrome-win"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-win32.zip"
  FFMPEG_BIN_PATH="ffmpeg.exe"
elif [[ $1 == "--win64" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${BUILD_NUMBER}/chrome-win.zip"
  CHROMIUM_FOLDER_NAME="chrome-win"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-win64.zip"
  FFMPEG_BIN_PATH="ffmpeg.exe"
elif [[ $1 == "--mac" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Mac/${BUILD_NUMBER}/chrome-mac.zip"
  CHROMIUM_FOLDER_NAME="chrome-mac"
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-mac.zip"
  FFMPEG_BIN_PATH="ffmpeg"
elif [[ $1 == "--linux" ]]; then
  CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${BUILD_NUMBER}/chrome-linux.zip"
  CHROMIUM_FOLDER_NAME="chrome-linux"
  # Even though we could bundle ffmpeg on Linux (2.5MB zipped), we
  # prefer rely on system-installed ffmpeg instead.
else
  echo "ERROR: unknown platform to build: $1"
  exit 1
fi

curl --output chromium-upstream.zip "${CHROMIUM_URL}"
unzip chromium-upstream.zip
for file in ${CHROMIUM_FILES_TO_REMOVE[@]}; do
  rm -f "${file}"
done

if [[ -n "${FFMPEG_URL}" ]]; then
  curl --output ffmpeg-upstream.zip "${FFMPEG_URL}"
  unzip ffmpeg-upstream.zip
  cp "$FFMPEG_BIN_PATH" "${CHROMIUM_FOLDER_NAME}"
fi

zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
