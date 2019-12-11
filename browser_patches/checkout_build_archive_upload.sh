#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit] [-f|--force]"
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
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

BROWSER_NAME=""
FFOX_WIN64=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  BROWSER_NAME="firefox"
  if [[ ("$2" == "--win64") || ("$3" == "--win64") ]]; then
    FFOX_WIN64="--win64"
  fi
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  BROWSER_NAME="webkit"
else
  echo ERROR: unknown browser - "$1"
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
  if ./upload.sh $BROWSER_NAME --check $FFOX_WIN64; then
    echo "Build is already uploaded - no changes."
    exit 0
  else
    echo "Build is missing - rebuilding"
  fi
else
  echo "Force-rebuilding the build."
fi

cd ./$BROWSER_NAME/checkout
if ! [[ $(git rev-parse --abbrev-ref HEAD) == "playwright-build" ]]; then
  echo "ERROR: Default branch is not playwright-build!"
  exit 1
fi
cd -

source ./buildbots/send_telegram_message.sh
BUILD_ALIAS=$(./upload.sh $BROWSER_NAME --show-alias $FFOX_WIN64)
send_telegram_message "$BUILD_ALIAS: started ..."

echo "-- preparing checkout"
if ! ./prepare_checkout.sh $BROWSER_NAME; then
  send_telegram_message "$BUILD_ALIAS: ./prepare_checkout.sh failed! ❌"
  exit 1
fi

echo "-- cleaning"
if ! ./$BROWSER_NAME/clean.sh; then
  send_telegram_message "$BUILD_ALIAS: ./clean.sh failed! ❌"
  exit 1
fi

echo "-- building"
if ! ./$BROWSER_NAME/build.sh $FFOX_WIN64; then
  send_telegram_message "$BUILD_ALIAS: ./build.sh failed! ❌"
  exit 1
fi

echo "-- archiving to $ZIP_PATH"
if ! ./$BROWSER_NAME/archive.sh $ZIP_PATH; then
  send_telegram_message "$BUILD_ALIAS: ./archive.sh failed! ❌"
  exit 1
fi

echo "-- uploading"
if ! ./upload.sh $BROWSER_NAME $ZIP_PATH $FFOX_WIN64; then
  send_telegram_message "$BUILD_ALIAS: ./upload.sh failed! ❌"
  exit 1
fi
send_telegram_message "$BUILD_ALIAS: uploaded ✅"
