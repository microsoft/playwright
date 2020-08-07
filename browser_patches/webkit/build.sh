#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

build_gtk() {
  if ! [[ -d ./WebKitBuild/GTK/DependenciesGTK ]]; then
    yes | WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
  fi
  local CMAKE_ARGS=""
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS="--cmakeargs=\"-DCMAKE_EXPORT_COMPILE_COMMANDS=1\""
  fi
  WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK ./Tools/Scripts/build-webkit --gtk --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox MiniBrowser
}

build_wpe() {
  if ! [[ -d ./WebKitBuild/WPE/DependenciesWPE ]]; then
    yes | WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitwpe-libs
  fi
  local CMAKE_ARGS=""
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS="--cmakeargs=\"-DCMAKE_EXPORT_COMPILE_COMMANDS=1\""
  fi
  WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE ./Tools/Scripts/build-webkit --wpe --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox MiniBrowser
}

if [[ "$(uname)" == "Darwin" ]]; then
  cd "checkout"
  ./Tools/Scripts/build-webkit --release --touch-events --orientation-events
elif [[ "$(uname)" == "Linux" ]]; then
  cd "checkout"
  if [[ $# == 0 || (-z "$1") ]]; then
    echo
    echo BUILDING: GTK and WPE
    echo
    build_wpe
    build_gtk
  elif [[ "$1" == "--gtk" ]]; then
    echo
    echo BUILDING: GTK
    echo
    build_gtk
  elif [[ "$1" == "--wpe" ]]; then
    echo
    echo BUILDING: WPE
    echo
    build_wpe
  fi
elif [[ "$(uname)" == MINGW* ]]; then
  /c/Windows/System32/cmd.exe "/c buildwin.bat"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
