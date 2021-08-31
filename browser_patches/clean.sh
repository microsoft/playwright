#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"


if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: clean.sh [firefox|webkit|firefox-beta]"
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './clean.sh --help' for more information"
  exit 1
fi

if [[ ("$1" == "firefox") || ("$1" == "firefox/") || ("$1" == "ff") ]]; then
  bash ./firefox/clean.sh "$@"
elif [[ ("$1" == "firefox-beta") || ("$1" == "ff-beta") ]]; then
  bash ./firefox-beta/clean.sh "$@"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") || ("$1" == "wk") ]]; then
  bash ./webkit/clean.sh "$@"
elif [[ ("$1" == "chromium") || ("$1" == "chromium/") || ("$1" == "cr") ]]; then
  bash ./chromium/clean.sh "$@"
elif [[ ("$1" == "winldd") ]]; then
  bash ./winldd/clean.sh "$@"
elif [[ ("$1" == "ffmpeg") ]]; then
  bash ./ffmpeg/clean.sh "$@"
else
  echo ERROR: unknown browser to build - "$1"
  exit 1
fi

