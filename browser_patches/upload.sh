#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit] [--check] [zip-path]"
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
BROWSER_NAME=""
BUILD_NUMBER=""
BLOB_NAME=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  # we always apply our patches atop of beta since it seems to get better
  # reliability guarantees.
  BUILD_NUMBER=$(cat "$PWD/firefox/BUILD_NUMBER")
  BROWSER_NAME="firefox"
  if [[ "$(uname)" == "Darwin" ]]; then
    BLOB_NAME="firefox-mac.zip"
  elif [[ "$(uname)" == "Linux" ]]; then
    BLOB_NAME="firefox-linux.zip"
  elif [[ "$(uname)" == MINGW* ]]; then
    BLOB_NAME="firefox-win32.zip"
  else
    echo "ERROR: unzupported platform - $(uname)"
    exit 1
  fi
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  BUILD_NUMBER=$(cat "$PWD/webkit/BUILD_NUMBER")
  BROWSER_NAME="webkit"
  if [[ "$(uname)" == "Darwin" ]]; then
    MAC_MAJOR_MINOR_VERSION=$(sw_vers -productVersion | grep -o '^\d\+.\d\+')
    BLOB_NAME="minibrowser-mac-$MAC_MAJOR_MINOR_VERSION.zip"
  elif [[ "$(uname)" == "Linux" ]]; then
    BLOB_NAME="minibrowser-linux.zip"
  else
    echo "ERROR: unzupported platform - $(uname)"
    exit 1
  fi
else
  echo ERROR: unknown browser to export - "$1"
  exit 1
fi

BLOB_PATH="$BROWSER_NAME/$BUILD_NUMBER/$BLOB_NAME"
if [[ $2 == '--check' ]]; then
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
ZIP_PATH=$2
if ! [[ -f $ZIP_PATH ]]; then
  echo "ERROR: $ZIP_PATH does not exist"
  exit 1
fi
if ! [[ $ZIP_PATH == *.zip ]]; then
  echo "ERROR: $ZIP_PATH is not a zip archive (must have a .zip extension)"
  exit 1
fi
if [[ $(uname) == MINGW* ]]; then
	WIN_PATH=$({ cd $(dirname $ZIP_PATH) && pwd -W; } | sed 's|/|\\|g')
	WIN_PATH="${WIN_PATH}\\$(basename $ZIP_PATH)"
	echo $WIN_PATH
	az storage blob upload -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $WIN_PATH -n $BLOB_PATH
else
	az storage blob upload -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $ZIP_PATH -n "$BLOB_PATH"
fi

echo "UPLOAD SUCCESSFUL!"
echo "--  SRC: $ZIP_PATH"
echo "-- SIZE: $(du -h "$ZIP_PATH" | awk '{print $1}')"
echo "--  DST: $BLOB_PATH"

