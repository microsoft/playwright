#!/bin/bash

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $0"
  echo
  echo "Generate distributable .zip archive from ./checkout folder that was previously built."
  echo
  exit 0
fi

set -e
set -x

createZIPForLinuxOrMac() {
  local zipname=$1
  local OBJ_FOLDER=$(ls -1 | grep obj-)
  if [[ $OBJ_FOLDER == "" ]]; then
    echo "ERROR: cannot find obj-* folder in the checkout/. Did you build?"
    exit 1;
  fi
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
  zip -r ../../../$zipname firefox
  cd -
}

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd checkout

if [[ "$(uname)" == "Darwin" ]]; then
  createZIPForLinuxOrMac "firefox-mac.zip"
elif [[ "$(uname)" == "Linux" ]]; then
  createZIPForLinuxOrMac "firefox-linux.zip"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
