#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [webkit-gtk|webkit-wpe] [zip-path]"
  echo
  echo "Download .zip of a browser build."
  echo
  echo "NOTE: \$AZ_ACCOUNT_KEY (azure account name) and \$AZ_ACCOUNT_NAME (azure account name)"
  echo "env variables are required to download builds from CDN."
  exit 0
fi

if [[ (-z $AZ_ACCOUNT_KEY) || (-z $AZ_ACCOUNT_NAME) ]]; then
  echo "ERROR: Either \$AZ_ACCOUNT_KEY or \$AZ_ACCOUNT_NAME environment variable is missing."
  echo "       'Azure Account Name' and 'Azure Account Key' secrets that are required"
  echo "       to download builds from Azure CDN."
  exit 1
fi

if [[ $# < 1 ]]; then
  echo "missing build flavor"
  echo "try '$(basename $0) --help' for more information"
  exit 1
fi

BUILD_FLAVOR="$1"
BROWSER_NAME=""
BLOB_NAME=""
if [[ "$BUILD_FLAVOR" == "webkit-gtk" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-gtk.zip"
elif [[ "$BUILD_FLAVOR" == "webkit-wpe" ]]; then
  BROWSER_NAME="webkit"
  BLOB_NAME="minibrowser-wpe.zip"
else
  echo ERROR: unsupported build flavor - "$BUILD_FLAVOR"
  exit 1
fi

BUILD_NUMBER=$(cat ./$BROWSER_NAME/BUILD_NUMBER)
BLOB_PATH="$BROWSER_NAME/$BUILD_NUMBER/$BLOB_NAME"

if [[ $# < 2 ]]; then
  echo "missing path to zip archive to download to"
  echo "try '$(basename $0) --help' for more information"
  exit 1
fi

ZIP_PATH="$2"

if [[ -f $ZIP_PATH ]]; then
  echo "ERROR: $ZIP_PATH exists"
  exit 1
fi
if ! [[ $ZIP_PATH == *.zip ]]; then
  echo "ERROR: $ZIP_PATH is not a zip archive (must have a .zip extension)"
  exit 1
fi
az storage blob download -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $ZIP_PATH -n "$BLOB_PATH"

echo "DOWNLOAD SUCCESSFUL!"
echo "--  SRC: $ZIP_PATH"
echo "-- SIZE: $(du -h "$ZIP_PATH" | awk '{print $1}')"
echo "--  DST: $BLOB_PATH"

