#!/bin/bash
set -e
set +x
set -o pipefail

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox-linux|firefox-win32|firefox-win64|webkit-gtk|webkit-wpe|webkit-gtk-wpe|webkit-win64|webkit-mac-10.14|webkit-mac-10.15] [-f|--force]"
  echo
  echo "Prepares checkout under browser folder, applies patches, builds, archives, and uploads if build is missing."
  echo "Script will bail out early if the build for the browser version is already present."
  echo
  echo "Pass -f to upload anyway."
  echo
  echo "NOTE: This script is safe to run in a cronjob - it aquires a lock so that it does not run twice."
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing build flavor!"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

CURRENT_HOST_OS="$(uname)"
CURRENT_HOST_OS_VERSION=""
if [[ "$CURRENT_HOST_OS" == "Darwin" ]]; then
  CURRENT_HOST_OS_VERSION=$(sw_vers -productVersion | grep -o '^\d\+.\d\+')
elif [[ "$CURRENT_HOST_OS" == "Linux" ]]; then
  CURRENT_HOST_OS="$(bash -c 'source /etc/os-release && echo $NAME')"
  CURRENT_HOST_OS_VERSION="$(bash -c 'source /etc/os-release && echo $VERSION_ID')"
fi

BROWSER_NAME=""
EXTRA_BUILD_ARGS=""
BUILD_FLAVOR="$1"
BUILD_BLOB_NAME=""
EXPECTED_HOST_OS=""
EXPECTED_HOST_OS_VERSION=""
if [[ "$BUILD_FLAVOR" == "winldd-win64" ]]; then
  BROWSER_NAME="winldd"
  EXPECTED_HOST_OS="MINGW"
  BUILD_BLOB_NAME="winldd-win64.zip"
elif [[ "$BUILD_FLAVOR" == "ffmpeg-mac" ]]; then
  BROWSER_NAME="ffmpeg"
  EXTRA_BUILD_ARGS="--mac"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.14"
  BUILD_BLOB_NAME="ffmpeg-mac.zip"
elif [[ "$BUILD_FLAVOR" == "ffmpeg-linux" ]]; then
  BROWSER_NAME="ffmpeg"
  EXTRA_BUILD_ARGS="--linux"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="20.04"
  BUILD_BLOB_NAME="ffmpeg-linux.zip"
elif [[ "$BUILD_FLAVOR" == "ffmpeg-cross-compile-win32" ]]; then
  BROWSER_NAME="ffmpeg"
  EXTRA_BUILD_ARGS="--cross-compile-win32"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="20.04"
  BUILD_BLOB_NAME="ffmpeg-win32.zip"
elif [[ "$BUILD_FLAVOR" == "ffmpeg-cross-compile-win64" ]]; then
  BROWSER_NAME="ffmpeg"
  EXTRA_BUILD_ARGS="--cross-compile-win64"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="20.04"
  BUILD_BLOB_NAME="ffmpeg-win64.zip"
elif [[ "$BUILD_FLAVOR" == "chromium-linux-mirror-to-cdn" ]]; then
  BROWSER_NAME="chromium"
  EXTRA_BUILD_ARGS="--linux"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="chromium-linux.zip"
elif [[ "$BUILD_FLAVOR" == "chromium-mac-mirror-to-cdn" ]]; then
  BROWSER_NAME="chromium"
  EXTRA_BUILD_ARGS="--mac"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="chromium-mac.zip"
elif [[ "$BUILD_FLAVOR" == "chromium-win32-mirror-to-cdn" ]]; then
  BROWSER_NAME="chromium"
  EXTRA_BUILD_ARGS="--win32"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="chromium-win32.zip"
elif [[ "$BUILD_FLAVOR" == "chromium-win64-mirror-to-cdn" ]]; then
  BROWSER_NAME="chromium"
  EXTRA_BUILD_ARGS="--win64"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="chromium-win64.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-ubuntu-18.04" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="firefox-ubuntu-18.04.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-mac-10.14" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.14"
  BUILD_BLOB_NAME="firefox-mac-10.14.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-win32" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="MINGW"
  BUILD_BLOB_NAME="firefox-win32.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-win64" ]]; then
  BROWSER_NAME="firefox"
  EXTRA_BUILD_ARGS="--win64"
  EXPECTED_HOST_OS="MINGW"
  BUILD_BLOB_NAME="firefox-win64.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-ubuntu-18.04" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="18.04"
  BUILD_BLOB_NAME="webkit-ubuntu-18.04.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-ubuntu-20.04" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Ubuntu"
  EXPECTED_HOST_OS_VERSION="20.04"
  BUILD_BLOB_NAME="webkit-ubuntu-20.04.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-win64" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="MINGW"
  BUILD_BLOB_NAME="webkit-win64.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.14" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.14"
  BUILD_BLOB_NAME="webkit-mac-10.14.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.15" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.15"
  BUILD_BLOB_NAME="webkit-mac-10.15.zip"
else
  echo ERROR: unknown build flavor - "$BUILD_FLAVOR"
  exit 1
fi

if [[ "$CURRENT_HOST_OS" != $EXPECTED_HOST_OS* ]]; then
  echo "ERROR: cannot build $BUILD_FLAVOR"
  echo "  -- expected OS: $EXPECTED_HOST_OS"
  echo "  --  current OS: $CURRENT_HOST_OS"
  exit 1
fi

if [[ "$CURRENT_HOST_OS_VERSION" != "$EXPECTED_HOST_OS_VERSION" ]]; then
  echo "ERROR: cannot build $BUILD_FLAVOR"
  echo "  -- expected OS Version: $EXPECTED_HOST_OS_VERSION"
  echo "  --  current OS Version: $CURRENT_HOST_OS_VERSION"
  exit 1
fi

if [[ $(uname) == MINGW* ]]; then
  ZIP_PATH="$PWD/archive-$BROWSER_NAME.zip"
  LOG_PATH="$PWD/log-$BROWSER_NAME.zip"
else
  ZIP_PATH="/tmp/archive-$BROWSER_NAME.zip"
  LOG_PATH="/tmp/log-$BROWSER_NAME.zip"
fi

if [[ -f $ZIP_PATH ]]; then
  echo "Archive $ZIP_PATH already exists - remove and re-run the script."
  exit 1
fi
trap "rm -rf ${ZIP_PATH}; rm -rf ${LOG_PATH}; cd $(pwd -P);" INT TERM EXIT
cd "$(dirname "$0")"
BUILD_NUMBER=$(head -1 ./$BROWSER_NAME/BUILD_NUMBER)
BUILD_BLOB_PATH="${BROWSER_NAME}/${BUILD_NUMBER}/${BUILD_BLOB_NAME}"
LOG_BLOB_NAME="${BUILD_BLOB_NAME%.zip}.log.gz"
LOG_BLOB_PATH="${BROWSER_NAME}/${BUILD_NUMBER}/${LOG_BLOB_NAME}"

# pull from upstream and check if a new build has to be uploaded.
if ! [[ ($2 == '-f') || ($2 == '--force') ]]; then
  if ./upload.sh "${BUILD_BLOB_PATH}" --check; then
    echo "Build is already uploaded - no changes."
    exit 0
  elif ./upload.sh "${LOG_BLOB_PATH}" --check; then
    echo "This build has already been attempted - skip building."
    exit 0
  fi
  echo "Build is missing and has not been attempted - rebuilding"
else
  echo "Force-rebuilding the build."
fi

function generate_and_upload_browser_build {
  echo "-- preparing checkout"
  if ! ./prepare_checkout.sh $BROWSER_NAME; then
    return 20
  fi

  echo "-- cleaning"
  if ! ./$BROWSER_NAME/clean.sh; then
    return 21
  fi

  echo "-- building"
  if ! ./$BROWSER_NAME/build.sh "$EXTRA_BUILD_ARGS"; then
    return 22
  fi

  echo "-- archiving to $ZIP_PATH"
  if ! ./$BROWSER_NAME/archive.sh $ZIP_PATH; then
    return 23
  fi

  echo "-- uploading"
  if ! ./upload.sh $BUILD_BLOB_PATH $ZIP_PATH; then
    return 24
  fi
  return 0
}

source ./buildbots/send_telegram_message.sh
BUILD_ALIAS="$BUILD_FLAVOR r$BUILD_NUMBER"
send_telegram_message "$BUILD_ALIAS -- started"

if generate_and_upload_browser_build 2>&1 | ./sanitize_and_compress_log.js $LOG_PATH; then
  # Report successful build. Note: we don't know how to get zip size on MINGW.
  if [[ $(uname) == MINGW* ]]; then
    send_telegram_message "$BUILD_ALIAS -- uploaded"
  else
    UPLOAD_SIZE=$(du -h "$ZIP_PATH" | awk '{print $1}')
    send_telegram_message "$BUILD_ALIAS -- $UPLOAD_SIZE uploaded"
  fi
  # Check if we uploaded the last build.
  if ./tools/check_cdn.sh $BROWSER_NAME --has-all-builds; then
    LAST_COMMIT_MESSAGE=$(git log --format=%s -n 1 HEAD -- ./$BROWSER_NAME/BUILD_NUMBER)
    send_telegram_message "<b>$BROWSER_NAME r${BUILD_NUMBER} COMPLETE! ✅</b> $LAST_COMMIT_MESSAGE"
  fi
else
  RESULT_CODE="$?"
  if (( RESULT_CODE == 10 )); then
    FAILED_STEP="./download_gtk_and_wpe_and_zip_together.sh"
  elif (( RESULT_CODE == 11 )); then
    FAILED_STEP="./upload.sh"
  elif (( RESULT_CODE == 20 )); then
    FAILED_STEP="./prepare_checkout.sh"
  elif (( RESULT_CODE == 21 )); then
    FAILED_STEP="./clean.sh"
  elif (( RESULT_CODE == 22 )); then
    FAILED_STEP="./build.sh"
  elif (( RESULT_CODE == 23 )); then
    FAILED_STEP="./archive.sh"
  elif (( RESULT_CODE == 24 )); then
    FAILED_STEP="./upload.sh"
  else
    FAILED_STEP="<unknown step>"
  fi
  # Upload logs only in case of failure and report failure.
  ./upload.sh ${LOG_BLOB_PATH} ${LOG_PATH} || true
  send_telegram_message "$BUILD_ALIAS -- ${FAILED_STEP} failed! ❌ <a href='https://playwright.azureedge.net/builds/${LOG_BLOB_PATH}'>${LOG_BLOB_NAME}</a>"
fi

