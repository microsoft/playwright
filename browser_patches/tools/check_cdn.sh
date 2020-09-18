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

FFOX_REVISION=$(head -1 ../firefox/BUILD_NUMBER)
FFOX_ARCHIVES=(
  "$HOST/firefox/%s/firefox-mac-10.14.zip"
  "$HOST/firefox/%s/firefox-ubuntu-18.04.zip"
  "$HOST/firefox/%s/firefox-win32.zip"
  "$HOST/firefox/%s/firefox-win64.zip"
)
FFOX_ALIASES=(
  "FF-MAC"
  "FF-UBUNTU-18.04"
  "FF-WIN32"
  "FF-WIN64"
)

WK_REVISION=$(head -1 ../webkit/BUILD_NUMBER)
WK_ARCHIVES=(
  "$HOST/webkit/%s/webkit-ubuntu-18.04.zip"
  "$HOST/webkit/%s/webkit-ubuntu-20.04.zip"
  "$HOST/webkit/%s/webkit-mac-10.14.zip"
  "$HOST/webkit/%s/webkit-mac-10.15.zip"
  "$HOST/webkit/%s/webkit-win64.zip"
)
WK_ALIASES=(
  "WK-UBUNTU-18.04"
  "WK-UBUNTU-20.04"
  "WK-MAC-10.14"
  "WK-MAC-10.15"
  "WK-WIN64"
)

CR_REVISION=$(head -1 ../chromium/BUILD_NUMBER)
CR_ARCHIVES=(
  "$HOST/chromium/%s/chromium-mac.zip"
  "$HOST/chromium/%s/chromium-linux.zip"
  "$HOST/chromium/%s/chromium-win32.zip"
  "$HOST/chromium/%s/chromium-win64.zip"
)
CR_ALIASES=(
  "CR-MAC"
  "CR-LINUX"
  "CR-WIN32"
  "CR-WIN64"
)

FFMPEG_REVISION=$(head -1 ../ffmpeg/BUILD_NUMBER)
FFMPEG_ARCHIVES=(
  "$HOST/ffmpeg/%s/ffmpeg-mac.zip"
  "$HOST/ffmpeg/%s/ffmpeg-linux.zip"
  "$HOST/ffmpeg/%s/ffmpeg-win32.zip"
  "$HOST/ffmpeg/%s/ffmpeg-win64.zip"
)
FFMPEG_ALIASES=(
  "FFMPEG-MAC"
  "FFMPEG-LINUX"
  "FFMPEG-WIN32"
  "FFMPEG-WIN64"
)

WINLDD_REVISION=$(head -1 ../winldd/BUILD_NUMBER)
WINLDD_ARCHIVES=(
  "$HOST/winldd/%s/winldd-win64.zip"
)
WINLDD_ALIASES=(
  "WINLDD-WIN64"
)

COLUMN="%-18s"
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
elif [[ ("$1" == "chromium") || ("$1" == "chromium/") ]]; then
  REVISION=$CR_REVISION
  ARCHIVES=("${CR_ARCHIVES[@]}")
  ALIASES=("${CR_ALIASES[@]}")
elif [[ ("$1" == "ffmpeg") || ("$1" == "ffmpeg/") ]]; then
  REVISION=$FFMPEG_REVISION
  ARCHIVES=("${FFMPEG_ARCHIVES[@]}")
  ALIASES=("${FFMPEG_ALIASES[@]}")
elif [[ ("$1" == "winldd") || ("$1" == "winldd/") ]]; then
  REVISION=$WINLDD_REVISION
  ARCHIVES=("${WINLDD_ARCHIVES[@]}")
  ALIASES=("${WINLDD_ALIASES[@]}")
else
  echo ERROR: unknown application - "$1"
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
