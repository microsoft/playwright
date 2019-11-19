#!/bin/bash

function runOSX() {
  # if script is run as-is
  if [ -d $SCRIPT_PATH/checkout/WebKitBuild/Release/MiniBrowser.app ]; then
    DYLIB_PATH="$SCRIPT_PATH/checkout/WebKitBuild/Release"
  elif [ -d $SCRIPT_PATH/MiniBrowser.app ]; then
    DYLIB_PATH="$SCRIPT_PATH"
  else
    echo "Cannot find a MiniBrowser.app in neither location" 1>&2
    exit 1
  fi
  MINIBROWSER="$DYLIB_PATH/MiniBrowser.app/Contents/MacOS/MiniBrowser"
  DYLD_FRAMEWORK_PATH=$DYLIB_PATH DYLD_LIBRARY_PATH=$DYLIB_PATH $MINIBROWSER "$@"
}

function runLinux() {
  # if script is run as-is
  if [ -d $SCRIPT_PATH/checkout/WebKitBuild ]; then
    LD_PATH="$SCRIPT_PATH/checkout/WebKitBuild/DependenciesGTK/Root/lib:$SCRIPT_PATH/checkout/WebKitBuild/Release/bin"
    MINIBROWSER="$SCRIPT_PATH/checkout/WebKitBuild/Release/bin/MiniBrowser"
  elif [ -f $SCRIPT_PATH/MiniBrowser ]; then
    LD_PATH="$SCRIPT_PATH"
    MINIBROWSER="$SCRIPT_PATH/MiniBrowser"
  else
    echo "Cannot find a MiniBrowser.app in neither location" 1>&2
    exit 1
  fi
  LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$LD_PATH $MINIBROWSER "$@"
}

SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"
if [ "$(uname)" == "Darwin" ]; then
  runOSX "$@"
elif [ "$(uname)" == "Linux" ]; then
  runLinux "$@"
else
  echo "ERROR: cannot run on this platform!" 1>&2
  exit 1;
fi
