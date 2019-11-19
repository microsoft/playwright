#!/bin/bash
set -e
set +x

cleanup() {
  cd $OLD_DIR
}

OLD_DIR=$(pwd -P)
cd "$(dirname "$0")"
trap cleanup EXIT

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $0 [firefox|webkit]"
  echo
  echo "Archive and upload a browser"
  echo
  echo "NOTE: \$AZ_ACCOUNT_KEY (azure account name) and \$AZ_ACCOUNT_NAME (azure account name)"
  echo "env variables are required to upload builds to CDN."
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try '$0 --help' for more information"
  exit 1
fi

if [[ (-z $AZ_ACCOUNT_KEY) || (-z $AZ_ACCOUNT_NAME) ]]; then
  echo "ERROR: Either \$AZ_ACCOUNT_KEY or \$AZ_ACCOUNT_NAME environment variable is missing."
  echo "       'Azure Account Name' and 'Azure Account Key' secrets that are required"
  echo "       to upload builds ot Azure CDN."
  exit 1
fi

ARCHIVE_SCRIPT=""
BROWSER_NAME=""
BUILD_NUMBER=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  # we always apply our patches atop of beta since it seems to get better
  # reliability guarantees.
  ARCHIVE_FOLDER="$PWD/firefox"
  BUILD_NUMBER=$(cat "$PWD/firefox/BUILD_NUMBER")
  ARCHIVE_SCRIPT="$PWD/firefox/archive.sh"
  BROWSER_NAME="firefox"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  ARCHIVE_FOLDER="$PWD/webkit"
  BUILD_NUMBER=$(cat "$PWD/webkit/BUILD_NUMBER")
  ARCHIVE_SCRIPT="$PWD/webkit/archive.sh"
  BROWSER_NAME="webkit"
else
  echo ERROR: unknown browser to export - "$1"
  exit 1
fi

if ! [[ -z $(ls $ARCHIVE_FOLDER | grep '.zip') ]]; then
  echo ERROR: .zip file already exists in $ARCHIVE_FOLDER!
  echo Remove manually all zip files and re-run the script.
  exit 1
fi

$ARCHIVE_SCRIPT
ZIP_NAME=$(ls $ARCHIVE_FOLDER | grep '.zip')
ZIP_PATH=$ARCHIVE_FOLDER/$ZIP_NAME
BLOB_NAME="$BROWSER_NAME/$BUILD_NUMBER/$ZIP_NAME"
az storage blob upload -c builds --account-key $AZ_ACCOUNT_KEY --account-name $AZ_ACCOUNT_NAME -f $ZIP_PATH -n "$BLOB_NAME"
echo "Uploaded $(du -h "$ZIP_PATH" | awk '{print $1}') as $BLOB_NAME"
rm $ZIP_PATH
