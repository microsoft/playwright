#!/bin/bash
set -e
set +x

HOST="https://playwrightaccount.blob.core.windows.net/builds"
ARCHIVES=(
  "$HOST/firefox/%s/firefox-mac.zip"
  "$HOST/firefox/%s/firefox-linux.zip"
  "$HOST/firefox/%s/firefox-win.zip"
  "$HOST/webkit/%s/minibrowser-linux.zip"
  "$HOST/webkit/%s/minibrowser-mac10.14.zip"
  "$HOST/webkit/%s/minibrowser-mac10.15.zip"
)

ALIASES=(
  "FF-MAC"
  "FF-LINUX"
  "FF-WIN"
  "WK-MAC-10.14"
  "WK-MAC-10.15"
  "WK-LINUX"
)
COLUMN="%-15s"

# COLORS
RED=$'\e[1;31m'
GRN=$'\e[1;32m'
YEL=$'\e[1;33m'
END=$'\e[0m'

# Read start revision if there's any.
REVISION=$(git rev-parse HEAD)
if [[ $# == 1 ]]; then
  if ! git rev-parse $1; then
    echo "ERROR: there is no $REVISION in this repo - pull from upstream?"
    exit 1
  fi
  REVISION=$(git rev-parse $1)
fi

printf "%12s" ""
for i in "${ALIASES[@]}"; do
  printf $COLUMN $i
done
printf "\n"
while true; do
  printf "%-12s" ${REVISION:0:10}
  for i in "${ARCHIVES[@]}"; do
    URL=$(printf $i $REVISION)
    if [[ $(curl -s -L -I $URL | head -1 | cut -f2 -d' ') == 200 ]]; then
      printf ${GRN}$COLUMN${END} "YES"
    else
      printf ${RED}$COLUMN${END} "NO"
    fi
  done;
  echo
  REVISION=$(git rev-parse $REVISION^)
done;
