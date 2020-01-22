#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

if [[ -d ./WebKitBuild ]]; then
  rm -rf ./WebKitBuild/Release
fi
if [[ -d ./WebKitBuild/GTK ]]; then
  rm -rf ./WebKitBuild/GTK/Release
fi
if [[ -d ./WebKitBuild/WPE ]]; then
  rm -rf ./WebKitBuild/WPE/Release
fi
