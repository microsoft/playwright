#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

if [[ "$(uname)" == "Darwin" ]]; then
  ./Tools/Scripts/build-webkit --release
elif [[ "$(uname)" == "Linux" ]]; then
  # Check that WebKitBuild exists and is not empty.
  if ! [[ (-d ./WebKitBuild) && (-n $(ls -1 ./WebKitBuild/)) ]]; then
    yes | DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
  fi
  ./Tools/Scripts/build-webkit --gtk --release MiniBrowser
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
