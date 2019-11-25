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
# - make sure the lockfile is removed when we exit and then claim it
trap "rm -rf ${ZIP_PATH}; cd $(pwd -P); exit" INT TERM EXIT
cd "$(dirname "$0")"

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

echo "-- preparing checkout"
./prepare_checkout.sh $BROWSER_NAME

echo "-- cleaning"
./$BROWSER_NAME/clean.sh

echo "-- building"
if [[ $BROWSER_NAME == "firefox" ]]; then
  ./$BROWSER_NAME/build.sh $FFOX_WIN64
else
  ./$BROWSER_NAME/build.sh
fi

echo "-- archiving to $ZIP_PATH"
./$BROWSER_NAME/archive.sh $ZIP_PATH

echo "-- uploading"
./upload.sh $BROWSER_NAME $ZIP_PATH
