#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox-linux|firefox-win32|firefox-win64|webkit-gtk|webkit-wpe|webkit-gtk-wpe|webkit-win64|webkit-mac-10.14|webkit-mac-10.15] [-f|--force]"
  echo
  echo "Prepares checkout under browser folder, applies patches, builds, archives, and uploades if build is missing."
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
fi

BROWSER_NAME=""
EXTRA_BUILD_ARGS=""
EXTRA_ARCHIVE_ARGS=""
BUILD_FLAVOR="$1"
EXPECTED_HOST_OS=""
EXPECTED_HOST_OS_VERSION=""
if [[ "$BUILD_FLAVOR" == "firefox-linux" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="Linux"
elif [[ "$BUILD_FLAVOR" == "firefox-mac" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.14"
elif [[ "$BUILD_FLAVOR" == "firefox-win32" ]]; then
  BROWSER_NAME="firefox"
  EXPECTED_HOST_OS="MINGW"
elif [[ "$BUILD_FLAVOR" == "firefox-win64" ]]; then
  BROWSER_NAME="firefox"
  EXTRA_BUILD_ARGS="--win64"
  EXPECTED_HOST_OS="MINGW"
elif [[ "$BUILD_FLAVOR" == "webkit-gtk" ]]; then
  BROWSER_NAME="webkit"
  EXTRA_BUILD_ARGS="--gtk"
  EXTRA_ARCHIVE_ARGS="--gtk"
  EXPECTED_HOST_OS="Linux"
elif [[ "$BUILD_FLAVOR" == "webkit-wpe" ]]; then
  BROWSER_NAME="webkit"
  EXTRA_BUILD_ARGS="--wpe"
  EXTRA_ARCHIVE_ARGS="--wpe"
  EXPECTED_HOST_OS="Linux"
elif [[ "$BUILD_FLAVOR" == "webkit-gtk-wpe" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Linux"
elif [[ "$BUILD_FLAVOR" == "webkit-win64" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="MINGW"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.14" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.14"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.15" ]]; then
  BROWSER_NAME="webkit"
  EXPECTED_HOST_OS="Darwin"
  EXPECTED_HOST_OS_VERSION="10.15"
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
else
  ZIP_PATH="/tmp/archive-$BROWSER_NAME.zip"
fi

if [[ -f $ZIP_PATH ]]; then
  echo "Archive $ZIP_PATH already exists - remove and re-run the script."
  exit 1
fi
trap "rm -rf ${ZIP_PATH}; cd $(pwd -P);" INT TERM EXIT
cd "$(dirname "$0")"
BUILD_NUMBER=$(cat ./$BROWSER_NAME/BUILD_NUMBER)

# pull from upstream and check if a new build has to be uploaded.
if ! [[ ($2 == '-f') || ($2 == '--force') ]]; then
  if ./upload.sh $BUILD_FLAVOR --check; then
    echo "Build is already uploaded - no changes."
    exit 0
  else
    echo "Build is missing - rebuilding"
  fi
else
  echo "Force-rebuilding the build."
fi

source ./buildbots/send_telegram_message.sh
BUILD_ALIAS="$BUILD_FLAVOR r$BUILD_NUMBER"

send_telegram_message "$BUILD_ALIAS -- started"

if [[ "$BUILD_FLAVOR" == "webkit-gtk-wpe" ]]; then
  echo "-- combining binaries together"
  if ! ./webkit/download_gtk_and_wpe_and_zip_together.sh $ZIP_PATH; then
    send_telegram_message "$BUILD_ALIAS -- ./download_gtk_and_wpe_and_zip_together.sh failed! ❌"
    exit 1
  fi
else
  echo "-- preparing checkout"
  if ! ./prepare_checkout.sh $BROWSER_NAME; then
    send_telegram_message "$BUILD_ALIAS -- ./prepare_checkout.sh failed! ❌"
    exit 1
  fi

  echo "-- cleaning"
  if ! ./$BROWSER_NAME/clean.sh; then
    send_telegram_message "$BUILD_ALIAS -- ./clean.sh failed! ❌"
    exit 1
  fi

  echo "-- building"
  if ! ./$BROWSER_NAME/build.sh "$EXTRA_BUILD_ARGS"; then
    send_telegram_message "$BUILD_ALIAS -- ./build.sh failed! ❌"
    exit 1
  fi

  echo "-- archiving to $ZIP_PATH"
  if ! ./$BROWSER_NAME/archive.sh $ZIP_PATH "$EXTRA_ARCHIVE_ARGS"; then
    send_telegram_message "$BUILD_ALIAS -- ./archive.sh failed! ❌"
    exit 1
  fi
fi

echo "-- uploading"
if ! ./upload.sh $BUILD_FLAVOR $ZIP_PATH; then
  send_telegram_message "$BUILD_ALIAS -- ./upload.sh failed! ❌"
  exit 1
fi
UPLOAD_SIZE=$(du -h "$ZIP_PATH" | awk '{print $1}')
send_telegram_message "$BUILD_ALIAS -- $UPLOAD_SIZE uploaded"

if ./tools/check_cdn.sh $BROWSER_NAME --has-all-builds; then
  LAST_COMMIT_MESSAGE=$(git log --format=%s -n 1 HEAD -- ./$BROWSER_NAME/BUILD_NUMBER)
  send_telegram_message "<b>$BROWSER_NAME r${BUILD_NUMBER} COMPLETE! ✅</b> $LAST_COMMIT_MESSAGE"
fi



