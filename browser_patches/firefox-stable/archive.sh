#!/bin/bash
set -e
set +x

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename $0) [output-absolute-path]"
  echo
  echo "Generate distributable .zip archive from ./checkout folder that was previously built."
  echo
  exit 0
fi

ZIP_PATH=$1
if [[ $ZIP_PATH != /* ]]; then
  echo "ERROR: path $ZIP_PATH is not absolute"
  exit 1
fi
if [[ $ZIP_PATH != *.zip ]]; then
  echo "ERROR: path $ZIP_PATH must have .zip extension"
  exit 1
fi
if [[ -f $ZIP_PATH ]]; then
  echo "ERROR: path $ZIP_PATH exists; can't do anything."
  exit 1
fi
if ! [[ -d $(dirname $ZIP_PATH) ]]; then
  echo "ERROR: folder for path $($ZIP_PATH) does not exist."
  exit 1
fi

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
SCRIPT_FOLDER="$(pwd -P)"

if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
  cd "${FF_CHECKOUT_PATH}"
  echo "WARNING: checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
else
  cd "../firefox/checkout"
fi

OBJ_FOLDER="obj-build-playwright"

./mach package
node "${SCRIPT_FOLDER}"/install-preferences.js $PWD/$OBJ_FOLDER/dist/firefox

if ! [[ -d $OBJ_FOLDER/dist/firefox ]]; then
  echo "ERROR: cannot find $OBJ_FOLDER/dist/firefox folder in the checkout/. Did you build?"
  exit 1;
fi

# Copy the libstdc++ version we linked against.
# TODO(aslushnikov): this won't be needed with official builds.
if [[ "$(uname)" == "Linux" ]]; then
  cp /usr/lib/x86_64-linux-gnu/libstdc++.so.6 $OBJ_FOLDER/dist/firefox/libstdc++.so.6
fi

# tar resulting directory and cleanup TMP.
cd $OBJ_FOLDER/dist
zip -r $ZIP_PATH firefox
