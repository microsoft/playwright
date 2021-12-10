#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
  cd "${FF_CHECKOUT_PATH}"
  echo "WARNING: checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
else
  cd "$HOME/firefox"
fi

OBJ_FOLDER="obj-build-playwright"
if [[ -d $OBJ_FOLDER ]]; then
  rm -rf $OBJ_FOLDER
fi

if [[ -f "mach" ]]; then
  ./mach clobber || true
fi
