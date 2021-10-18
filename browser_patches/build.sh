#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"


if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: build.sh [firefox|webkit|firefox-beta]"
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './build.sh --help' for more information"
  exit 1
fi

CMD="$1"
shift
if [[ ("$CMD" == "firefox") || ("$CMD" == "firefox/") || ("$CMD" == "ff") ]]; then
  bash ./firefox/build.sh "$@"
elif [[ ("$CMD" == "firefox-beta") || ("$CMD" == "ff-beta") ]]; then
  bash ./firefox-beta/build.sh "$@"
elif [[ ("$CMD" == "webkit") || ("$CMD" == "webkit/") || ("$CMD" == "wk") ]]; then
  bash ./webkit/build.sh "$@"
elif [[ ("$CMD" == "chromium") || ("$CMD" == "chromium/") || ("$CMD" == "cr") ]]; then
  bash ./chromium/build.sh "$@"
elif [[ ("$CMD" == "winldd") ]]; then
  bash ./winldd/build.sh "$@"
elif [[ ("$CMD" == "ffmpeg") ]]; then
  bash ./ffmpeg/build.sh "$@"
else
  echo ERROR: unknown browser to build - "$CMD"
  exit 1
fi

