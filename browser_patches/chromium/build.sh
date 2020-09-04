#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

mkdir -p output
cd output

BUILD_NUMBER=$(head -1 ../BUILD_NUMBER)
FOLDER_NAME=""
ZIP_NAME=""
FILES_TO_REMOVE=()

if [[ $1 == "--win32" ]]; then
  FOLDER_NAME="Win"
  ZIP_NAME="chrome-win.zip"
  FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
elif [[ $1 == "--win64" ]]; then
  FOLDER_NAME="Win_x64"
  ZIP_NAME="chrome-win.zip"
  FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
elif [[ $1 == "--mac" ]]; then
  FOLDER_NAME="Mac"
  ZIP_NAME="chrome-mac.zip"
elif [[ $1 == "--linux" ]]; then
  FOLDER_NAME="Linux_x64"
  ZIP_NAME="chrome-linux.zip"
else
  echo "ERROR: unknown platform to build: $1"
  exit 1
fi

URL="https://storage.googleapis.com/chromium-browser-snapshots/${FOLDER_NAME}/${BUILD_NUMBER}/${ZIP_NAME}"
curl --output upstream.zip "${URL}"

unzip upstream.zip

for file in ${FILES_TO_REMOVE[@]}; do
  rm -f "${file}"
done

zip --symlinks -r build.zip ${ZIP_NAME%.zip}
