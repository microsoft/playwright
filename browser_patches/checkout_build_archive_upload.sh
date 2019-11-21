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
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  BROWSER_NAME="firefox"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  BROWSER_NAME="webkit"
else
  echo ERROR: unknown browser - "$1"
  exit 1
fi

ZIP_PATH="/tmp/archive-$BROWSER_NAME.zip"
if [[ -f $ZIP_PATH ]]; then
  echo "Archive $ZIP_PATH already exists - remove and re-run the script."
  exit 1
fi
# - make sure the lockfile is removed when we exit and then claim it
trap "rm -rf ${ZIP_PATH}; cd $(pwd -P); exit" INT TERM EXIT
cd "$(dirname "$0")"

# pull from upstream and check if a new build has to be uploaded.
if ! [[ ($2 == '-f') || ($2 == '--force') ]]; then
  if ./upload.sh $BROWSER_NAME --check; then
    echo "Build is already uploaded - no changes."
    exit 0
  else
    echo "Build is missing - rebuilding"
  fi
else
  echo "Force-rebuilding the build."
fi

echo "-- preparing checkout"
# the "do_checkout" script asks if you want to reset existing branch.
# sure we do!
yes | ./do_checkout.sh $BROWSER_NAME
echo "-- building"
./$BROWSER_NAME/build.sh
echo "-- archiving to $ZIP_PATH"
./$BROWSER_NAME/archive.sh $ZIP_PATH
echo "-- uploading"
./upload.sh $BROWSER_NAME $ZIP_PATH
