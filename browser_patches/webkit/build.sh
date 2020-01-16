#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ "$(uname)" == "Darwin" ]]; then
  cd "checkout"
  ./Tools/Scripts/build-webkit --release --touch-events
elif [[ "$(uname)" == "Linux" ]]; then
  cd "checkout"
  # Check that WebKitBuild exists and is not empty.
  if ! [[ (-d ./WebKitBuild) && (-n $(ls -1 ./WebKitBuild/)) ]]; then
    yes | DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
  fi
  ./Tools/Scripts/build-webkit --gtk --release --touch-events MiniBrowser
elif [[ "$(uname)" == MINGW* ]]; then
  /c/Windows/System32/cmd.exe "/c buildwin.bat"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
