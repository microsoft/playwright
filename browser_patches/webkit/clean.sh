#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
  cd "${WK_CHECKOUT_PATH}"
  echo "WARNING: checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
else
  cd "checkout"
fi

if [[ "$(uname)" == "Darwin" ]]; then
  rm -rf ./WebKitBuild
else
  if [[ -d ./WebKitBuild ]]; then
    rm -rf ./WebKitBuild/Release
  fi
  if [[ -d ./WebKitBuild/GTK ]]; then
    rm -rf ./WebKitBuild/GTK/Release
  fi
  if [[ -d ./WebKitBuild/WPE ]]; then
    rm -rf ./WebKitBuild/WPE/Release
  fi
fi