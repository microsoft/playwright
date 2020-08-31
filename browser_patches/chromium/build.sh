#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

source "./UPSTREAM_CONFIG.sh"

mkdir -p output
cd output

FOLDER_NAME=""
ZIP_NAME=""
FFMPEG_URL=""
FFMPEG_BIN_PATH=""
FFMPEG_LICENSE_PATH=""
CHROMIUM_FILES_TO_REMOVE=()


if [[ $1 == "--win32" ]]; then
  FOLDER_NAME="Win"
  ZIP_NAME="chrome-win.zip"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-win32.zip"
  FFMPEG_BIN_PATH="ffmpeg-${FFMPEG_VERSION}-win32-static/bin/ffmpeg.exe"
  FFMPEG_LICENSE_PATH="ffmpeg-${FFMPEG_VERSION}-win32-static/LICENSE.txt"
elif [[ $1 == "--win64" ]]; then
  FOLDER_NAME="Win_x64"
  ZIP_NAME="chrome-win.zip"
  CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-win64.zip"
  FFMPEG_BIN_PATH="ffmpeg-${FFMPEG_VERSION}-win64-static/bin/ffmpeg.exe"
  FFMPEG_LICENSE_PATH="ffmpeg-${FFMPEG_VERSION}-win64-static/LICENSE.txt"
elif [[ $1 == "--mac" ]]; then
  FOLDER_NAME="Mac"
  ZIP_NAME="chrome-mac.zip"
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-mac.zip"
  FFMPEG_BIN_PATH="ffmpeg-${FFMPEG_VERSION}-macos64-static/bin/ffmpeg"
  FFMPEG_LICENSE_PATH="ffmpeg-${FFMPEG_VERSION}-macos64-static/LICENSE.txt"
elif [[ $1 == "--linux" ]]; then
  FOLDER_NAME="Linux_x64"
  ZIP_NAME="chrome-linux.zip"
  FFMPEG_URL="https://playwright2.blob.core.windows.net/builds/ffmpeg/${FFMPEG_VERSION}/ffmpeg-linux.zip"
  FFMPEG_BIN_PATH="ffmpeg-${FFMPEG_VERSION}-amd64-static/ffmpeg"
  FFMPEG_LICENSE_PATH="ffmpeg-${FFMPEG_VERSION}-amd64-static/GPLv3.txt"
else
  echo "ERROR: unknown platform to build: $1"
  exit 1
fi

CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/${FOLDER_NAME}/${UPSTREAM_CHROMIUM_REVISION}/${ZIP_NAME}"
curl --output chromium-upstream.zip "${CHROMIUM_URL}"
unzip chromium-upstream.zip
for file in ${CHROMIUM_FILES_TO_REMOVE[@]}; do
  rm -f "${file}"
done

curl --output ffmpeg-upstream.zip "${FFMPEG_URL}"
unzip ffmpeg-upstream.zip
cp "$FFMPEG_BIN_PATH" ${ZIP_NAME%.zip}
cp "$FFMPEG_LICENSE_PATH" ${ZIP_NAME%.zip}/ffmpeg-license.txt

zip --symlinks -r build.zip ${ZIP_NAME%.zip}
