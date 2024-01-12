#!/usr/bin/env bash

function getWebkitCheckoutPath() {
  echo ${WK_CHECKOUT_PATH:-"$HOME/webkit"}
}

function runOSX() {
  # if script is run as-is
  WK_CHECKOUT_PATH=$(getWebkitCheckoutPath)
  if [[ -f "${SCRIPT_PATH}/EXPECTED_BUILDS" && -d "$WK_CHECKOUT_PATH/WebKitBuild/Release/Playwright.app" ]]; then
    DYLIB_PATH="$WK_CHECKOUT_PATH/WebKitBuild/Release"
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
  GIO_DIR="";
  LD_PATH="";
  BUNDLE_DIR="";
  DEPENDENCIES_FOLDER="WebKitBuild/DependenciesGTK";
  MINIBROWSER_FOLDER="minibrowser-gtk";
  BUILD_FOLDER="WebKitBuild/GTK";
  if [[ "$*" == *--headless* ]]; then
    DEPENDENCIES_FOLDER="WebKitBuild/DependenciesWPE";
    MINIBROWSER_FOLDER="minibrowser-wpe";
    BUILD_FOLDER="WebKitBuild/WPE";
  fi
  # Setting extra environment variables like LD_LIBRARY_PATH or WEBKIT_INJECTED_BUNDLE_PATH
  # is only needed when calling MiniBrowser from the build folder. The MiniBrowser from
  # the zip bundle wrapper already sets itself the needed env variables.
  WK_CHECKOUT_PATH=$(getWebkitCheckoutPath)
  if [[ -d $SCRIPT_PATH/$MINIBROWSER_FOLDER ]]; then
    MINIBROWSER="$SCRIPT_PATH/$MINIBROWSER_FOLDER/MiniBrowser"
  elif [[ -d $WK_CHECKOUT_PATH/$BUILD_FOLDER ]]; then
    LD_PATH="$WK_CHECKOUT_PATH/$DEPENDENCIES_FOLDER/Root/lib:$SCRIPT_PATH/checkout/$BUILD_FOLDER/Release/bin"
    GIO_DIR="$WK_CHECKOUT_PATH/$DEPENDENCIES_FOLDER/Root/lib/gio/modules"
    BUNDLE_DIR="$WK_CHECKOUT_PATH/$BUILD_FOLDER/Release/lib"
    MINIBROWSER="$WK_CHECKOUT_PATH/$BUILD_FOLDER/Release/bin/MiniBrowser"
  elif [[ -f $SCRIPT_PATH/MiniBrowser ]]; then
    MINIBROWSER="$SCRIPT_PATH/MiniBrowser"
  elif [[ -d $SCRIPT_PATH/$BUILD_FOLDER ]]; then
    LD_PATH="$SCRIPT_PATH/$DEPENDENCIES_FOLDER/Root/lib:$SCRIPT_PATH/$BUILD_FOLDER/Release/bin"
    GIO_DIR="$SCRIPT_PATH/$DEPENDENCIES_FOLDER/Root/lib/gio/modules"
    BUNDLE_DIR="$SCRIPT_PATH/$BUILD_FOLDER/Release/lib"
    MINIBROWSER="$SCRIPT_PATH/$BUILD_FOLDER/Release/bin/MiniBrowser"
  else
    echo "Cannot find a MiniBrowser.app in neither location" 1>&2
    exit 1
  fi

  if [[ -n "$GIO_DIR" ]]; then
    export GIO_EXTRA_MODULES="$GIO_DIR"
  fi

  if [[ -n "$LD_PATH" ]]; then
    export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:$LD_PATH"
  fi

  if [[ -n "$BUNDLE_DIR" ]]; then
    export WEBKIT_INJECTED_BUNDLE_PATH="$BUNDLE_DIR"
  fi

  WEBKIT_FORCE_COMPLEX_TEXT="1" "$MINIBROWSER" "$@"
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
