#!/bin/bash

function runOSX() {
  # if script is run as-is
  if [[ -d $SCRIPT_PATH/checkout/WebKitBuild/Release/Playwright.app ]]; then
    DYLIB_PATH="$SCRIPT_PATH/checkout/WebKitBuild/Release"
  elif [[ -d $SCRIPT_PATH/Playwright.app ]]; then
    DYLIB_PATH="$SCRIPT_PATH"
  elif [[ -d $SCRIPT_PATH/WebKitBuild/Release/Playwright.app ]]; then
    DYLIB_PATH="$SCRIPT_PATH/WebKitBuild/Release"
  else
    echo "Cannot find a Playwright.app in neither location" 1>&2
    exit 1
  fi
  PLAYWRIGHT="$DYLIB_PATH/Playwright.app/Contents/MacOS/Playwright"
  DYLD_FRAMEWORK_PATH="$DYLIB_PATH" DYLD_LIBRARY_PATH="$DYLIB_PATH" "$PLAYWRIGHT" "$@"
}

function runLinux() {
  # if script is run as-is
  DEPENDENCIES_FOLDER="DependenciesGTK";
  MINIBROWSER_FOLDER="minibrowser-gtk";
  BUILD_FOLDER="WebKitBuild/GTK";
  GIO_DIR="";
  if [[ "$*" == *--headless* ]]; then
    DEPENDENCIES_FOLDER="DependenciesWPE";
    MINIBROWSER_FOLDER="minibrowser-wpe";
    BUILD_FOLDER="WebKitBuild/WPE";
  fi
  if [[ -d $SCRIPT_PATH/$MINIBROWSER_FOLDER ]]; then
    LD_PATH="$SCRIPT_PATH/$MINIBROWSER_FOLDER"
    GIO_DIR="$SCRIPT_PATH/$MINIBROWSER_FOLDER/gio/modules"
    MINIBROWSER="$SCRIPT_PATH/$MINIBROWSER_FOLDER/MiniBrowser"
  elif [[ -d $SCRIPT_PATH/checkout/$BUILD_FOLDER ]]; then
    LD_PATH="$SCRIPT_PATH/checkout/$BUILD_FOLDER/$DEPENDENCIES_FOLDER/Root/lib:$SCRIPT_PATH/checkout/$BUILD_FOLDER/Release/bin"
    GIO_DIR="$SCRIPT_PATH/checkout/$BUILD_FOLDER/$DEPENDENCIES_FOLDER/Root/lib/gio/modules"
    MINIBROWSER="$SCRIPT_PATH/checkout/$BUILD_FOLDER/Release/bin/MiniBrowser"
  elif [[ -f $SCRIPT_PATH/MiniBrowser ]]; then
    LD_PATH="$SCRIPT_PATH"
    GIO_DIR="$SCRIPT_PATH/gio/modules"
    MINIBROWSER="$SCRIPT_PATH/MiniBrowser"
  elif [[ -d $SCRIPT_PATH/$BUILD_FOLDER ]]; then
    LD_PATH="$SCRIPT_PATH/$BUILD_FOLDER/$DEPENDENCIES_FOLDER/Root/lib:$SCRIPT_PATH/$BUILD_FOLDER/Release/bin"
    GIO_DIR="$SCRIPT_PATH/$BUILD_FOLDER/$DEPENDENCIES_FOLDER/Root/lib/gio/modules"
    MINIBROWSER="$SCRIPT_PATH/$BUILD_FOLDER/Release/bin/MiniBrowser"
  else
    echo "Cannot find a MiniBrowser.app in neither location" 1>&2
    exit 1
  fi
  GIO_MODULE_DIR="$GIO_DIR" LD_LIBRARY_PATH="$LD_LIBRARY_PATH:$LD_PATH" "$MINIBROWSER" "$@"
}

SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"
if [[ "$(uname)" == "Darwin" ]]; then
  runOSX "$@"
elif [[ "$(uname)" == "Linux" ]]; then
  runLinux "$@"
else
  echo "ERROR: cannot run on this platform!" 1>&2
  exit 1;
fi
