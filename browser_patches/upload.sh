#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox-linux|firefox-win32|firefox-win64|webkit-gtk|webkit-wpe|webkit-gtk-wpe|webkit-win64|webkit-mac-10.14|webkit-mac-10.15] [--check] [zip-path]"
  echo
  echo "Upload .zip as a browser build."
  echo
  echo "--check      pass |--check| as a second parameter instead of a zip-path to check for"
  echo "             the build existing in the CDN"
  echo
  echo "NOTE: \$AZ_ACCOUNT_KEY (azure account name) and \$AZ_ACCOUNT_NAME (azure account name)"
  echo "env variables are required to upload builds to CDN."
  exit 0
fi

if [[ (-z $AZ_ACCOUNT_KEY) || (-z $AZ_ACCOUNT_NAME) ]]; then
  echo "ERROR: Either \$AZ_ACCOUNT_KEY or \$AZ_ACCOUNT_NAME environment variable is missing."
  echo "       'Azure Account Name' and 'Azure Account Key' secrets that are required"
  echo "       to upload builds ot Azure CDN."
  exit 1
fi

if [[ $# < 1 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try '$(basename $0) --help' for more information"
  exit 1
fi

BUILD_FLAVOR="$1"
BROWSER_NAME=""
BLOB_NAME=""
if [[ "$BUILD_FLAVOR" == "firefox-linux" ]]; then
  BROWSER_NAME="firefox"
  BLOB_NAME="firefox-linux.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-mac" ]]; then
  BROWSER_NAME="firefox"
  BLOB_NAME="firefox-mac.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-win32" ]]; then
  BROWSER_NAME="firefox"
  BLOB_NAME="firefox-win32.zip"
elif [[ "$BUILD_FLAVOR" == "firefox-win64" ]]; then
  BROWSER_NAME="firefox"
  BLOB_NAME="firefox-win64.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-gtk" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-gtk.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-wpe" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-wpe.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-gtk-wpe" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-gtk-wpe.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-win64" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-win64.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.14" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-mac-10.14.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-mac-10.15" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-mac-10.15.zip"
else
  echo ERROR: unknown build flavor - "$BUILD_FLAVOR"
  exit 1
fi

BUILD_NUMBER=$(cat ./$BROWSER_NAME/BUILD_NUMBER)
BLOB_PATH="$BROWSER_NAME/$BUILD_NUMBER/$BLOB_NAME"

if [[ ("$2" == '--check') || ("$3" == '--check') ]]; then
  EXISTS=$(az storage blob exists -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -n "$BLOB_PATH" --query "exists")
  if [[ $EXISTS == "true" ]]; then
    exit 0
  else
    exit 1
  fi
fi

if [[ $# < 2 ]]; then
  echo "missing path to zip archive to upload"
  echo "try '$(basename $0) --help' for more information"
  exit 1
fi

ZIP_PATH="$2"

if ! [[ -f $ZIP_PATH ]]; then
  echo "ERROR: $ZIP_PATH does not exist"
  exit 1
fi
if ! [[ $ZIP_PATH == *.zip ]]; then
  echo "ERROR: $ZIP_PATH is not a zip archive (must have a .zip extension)"
  exit 1
fi
if [[ $(uname) == MINGW* ]]; then
  # Convert POSIX path to MSYS
  WIN_PATH=$({ cd $(dirname $ZIP_PATH) && pwd -W; } | sed 's|/|\\|g')
  WIN_PATH="${WIN_PATH}\\$(basename $ZIP_PATH)"
  az storage blob upload -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $WIN_PATH -n $BLOB_PATH
else
  az storage blob upload -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $ZIP_PATH -n "$BLOB_PATH"
fi

echo "UPLOAD SUCCESSFUL!"
echo "--  SRC: $ZIP_PATH"
echo "-- SIZE: $(du -h "$ZIP_PATH" | awk '{print $1}')"
echo "--  DST: $BLOB_PATH"

