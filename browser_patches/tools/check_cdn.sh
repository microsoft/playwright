#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit] [--full-history] [--has-all-builds]"
  echo
  echo "List CDN status for browser"
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

HOST="https://playwright2.blob.core.windows.net/builds"

FFOX_REVISION=$(cat ../firefox/BUILD_NUMBER)
FFOX_ARCHIVES=(
  "$HOST/firefox/%s/firefox-mac.zip"
  "$HOST/firefox/%s/firefox-linux.zip"
  "$HOST/firefox/%s/firefox-win32.zip"
  "$HOST/firefox/%s/firefox-win64.zip"
)
FFOX_ALIASES=(
  "FF-MAC"
  "FF-LINUX"
  "FF-WIN32"
  "FF-WIN64"
)

WK_REVISION=$(cat ../webkit/BUILD_NUMBER)
WK_ARCHIVES=(
  "$HOST/webkit/%s/minibrowser-gtk.zip"
  "$HOST/webkit/%s/minibrowser-wpe.zip"
  "$HOST/webkit/%s/minibrowser-gtk-wpe.zip"
  "$HOST/webkit/%s/minibrowser-mac-10.14.zip"
  "$HOST/webkit/%s/minibrowser-mac-10.15.zip"
  "$HOST/webkit/%s/minibrowser-win64.zip"
)
WK_ALIASES=(
  "WK-GTK"
  "WK-WPE"
  "WK-GTK+WPE"
  "WK-MAC-10.14"
  "WK-MAC-10.15"
  "WK-WIN64"
)

COLUMN="%-15s"
# COLORS
RED=$'\e[1;31m'
GRN=$'\e[1;32m'
YEL=$'\e[1;33m'
END=$'\e[0m'

REVISION=""
ARCHIVES=""
ALIASES=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  REVISION=$FFOX_REVISION
  ARCHIVES=("${FFOX_ARCHIVES[@]}")
  ALIASES=("${FFOX_ALIASES[@]}")
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  REVISION=$WK_REVISION
  ARCHIVES=("${WK_ARCHIVES[@]}")
  ALIASES=("${WK_ALIASES[@]}")
else
  echo ERROR: unknown browser - "$1"
  exit 1
fi

if [[ $* == *--has-all-builds ]]; then
  for i in "${ARCHIVES[@]}"; do
    URL=$(printf $i $REVISION)
    if ! [[ $(curl -s -L -I $URL | head -1 | cut -f2 -d' ') == 200 ]]; then
      exit 1
    fi
  done;
  exit 0
fi

STOP_REVISION=$((REVISION - 3))
if [[ $* == *--full-history*  ]]; then
  STOP_REVISION=0
fi

printf "%7s" ""
for i in "${ALIASES[@]}"; do
  printf $COLUMN $i
done
printf "\n"
while (( REVISION > $STOP_REVISION )); do
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
