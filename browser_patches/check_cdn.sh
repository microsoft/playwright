#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit|chromium|ffmpeg] [--full-history] [--has-all-builds]"
  echo
  echo "List CDN status for browser"
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox', 'webkit', 'chromium' or 'ffmpeg'"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

HOST="https://playwright2.blob.core.windows.net/builds"

BROWSER_NAME="$1"
if [[ (! -f "./${BROWSER_NAME}/BUILD_NUMBER") || (! -f "./${BROWSER_NAME}/EXPECTED_BUILDS") ]]; then
  echo ERROR: unknown application - "$1"
  exit 1
fi

REVISION=$(head -1 "./${BROWSER_NAME}/BUILD_NUMBER")
BUILD_NAMES="./${BROWSER_NAME}/EXPECTED_BUILDS"

for i in $(cat "${BUILD_NAMES}"); do
  URL="${HOST}/${BROWSER_NAME}/${REVISION}/$i"
  if ! [[ $(curl -s -L -I $URL | head -1 | cut -f2 -d' ') == 200 ]]; then
    echo "${BROWSER_NAME} r${REVISION} is missing build: $i"
    exit 1
  fi
done;

echo "All expected builds are uploaded."
