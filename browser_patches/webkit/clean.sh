#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

if [[ -d ./WebKitBuild ]]; then
  rm -rf ./WebKitBuild/Release
fi
