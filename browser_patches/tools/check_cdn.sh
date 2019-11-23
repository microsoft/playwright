#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [revision-to-start]"
  echo
  echo "List CDN status for browser revisions"
  echo "Pass optional |revision-to-start| to limit revision search"
  exit 0
fi


HOST="https://playwrightaccount.blob.core.windows.net/builds"
ARCHIVES=(
  "$HOST/firefox/%s/firefox-mac.zip"
  "$HOST/firefox/%s/firefox-linux.zip"
  "$HOST/firefox/%s/firefox-win32.zip"
  "$HOST/firefox/%s/firefox-win64.zip"
  "$HOST/webkit/%s/minibrowser-linux.zip"
  "$HOST/webkit/%s/minibrowser-mac-10.14.zip"
  "$HOST/webkit/%s/minibrowser-mac-10.15.zip"
)

ALIASES=(
  "FF-MAC"
  "FF-LINUX"
  "FF-WIN32"
  "FF-WIN64"
  "WK-LINUX"
  "WK-MAC-10.14"
  "WK-MAC-10.15"
)
COLUMN="%-15s"

# COLORS
RED=$'\e[1;31m'
GRN=$'\e[1;32m'
YEL=$'\e[1;33m'
END=$'\e[0m'

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

FFOX_REVISION=$(cat ../firefox/BUILD_NUMBER)
WK_REVISION=$(cat ../webkit/BUILD_NUMBER)
REVISION=$FFOX_REVISION
if (( FFOX_REVISION < WK_REVISION )); then
  REVISION=$WK_REVISION
fi
# Read start revision if there's any.
if [[ $# == 1 ]]; then
  REVISION=$1
fi

printf "%7s" ""
for i in "${ALIASES[@]}"; do
  printf $COLUMN $i
done
printf "\n"
while (( REVISION > 0 )); do
  printf "%-7s" ${REVISION}
  for i in "${ARCHIVES[@]}"; do
    URL=$(printf $i $REVISION)
    if [[ $(curl -s -L -I $URL | head -1 | cut -f2 -d' ') == 200 ]]; then
      printf ${GRN}$COLUMN${END} "YES"
    else
      printf ${RED}$COLUMN${END} "NO"
    fi
  done;
  echo
  REVISION=$((REVISION - 1 ))
  if [[ $REVISION == "999" ]]; then
    REVISION=2
  fi
done;
