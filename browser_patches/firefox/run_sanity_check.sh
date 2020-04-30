#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ "$(uname)" == "Darwin" ]]; then
  node ./sanity.js
elif [[ "$(uname)" == "Linux" ]]; then
  xvfb-run --auto-servernum node ./sanity.js
elif [[ "$(uname)" == MINGW* ]]; then
  node ./sanity.js
else
  echo "ERROR: cannot check sanity on this platform!" 1>&2
  exit 1;
fi
