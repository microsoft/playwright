#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

BUILD_BRANCH="playwright-build"

if ! [[ $(git rev-parse --abbrev-ref HEAD) == "$BUILD_BRANCH" ]]; then
  echo "ERROR: Cannot build any branch other than $BUILD_BRANCH"
  exit 1;
else
  echo "-- checking git branch is $BUILD_BRANCH - OK"
fi

if [[ "$(uname)" == "Darwin" ]]; then
  ./Tools/Scripts/build-webkit --release
elif [[ "$(uname)" == "Linux" ]]; then
  if ! [[ -d ./WebKitBuild ]]; then
    yes | DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
  fi
  ./Tools/Scripts/build-webkit --gtk --release MiniBrowser
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
