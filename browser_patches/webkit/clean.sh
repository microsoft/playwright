#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

if [[ -d ./WebKitBuild ]]; then
  rm -rf ./WebKitBuild/Release
fi
if [[ -d ./WebKitBuildGTK ]]; then
  rm -rf ./WebKitBuildGTK/Release
fi
if [[ -d ./WebKitBuildWPE ]]; then
  rm -rf ./WebKitBuildWPE/Release
fi
