#!/bin/bash
set -e
set +x

function cleanup() {
  cd $OLD_DIR
}

OLD_DIR=$(pwd -P)
cd "$(dirname "$0")"
trap cleanup EXIT

cd checkout

if ! [[ $(git rev-parse --abbrev-ref HEAD) == "pwdev" ]]; then
  echo "ERROR: Cannot build any branch other than PWDEV"
  exit 1;
else
  echo "-- checking git branch is PWDEV - OK"
fi

if [[ "$(uname)" == "Darwin" ]]; then
  ./Tools/Scripts/build-webkit --release
elif [[ "$(uname)" == "Linux" ]]; then
  ./Tools/Scripts/build-webkit --gtk --release MiniBrowser
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
