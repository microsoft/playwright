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
  if [[ "$1" == "--wpe" ]]; then
    if ! [[ -d ./WebKitBuild/DependenciesWPE ]]; then
      yes | DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitwpe-libs
    fi
    ./Tools/Scripts/build-webkit --wpe --release --touch-events MiniBrowser
  else
    if ! [[ -d ./WebKitBuild/DependenciesGTK ]]; then
      yes | DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
    fi
    ./Tools/Scripts/build-webkit --gtk --release --touch-events MiniBrowser
  fi
elif [[ "$(uname)" == MINGW* ]]; then
  /c/Windows/System32/cmd.exe "/c buildwin.bat"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
