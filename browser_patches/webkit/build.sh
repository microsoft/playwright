#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
SCRIPT_FOLDER="$(pwd -P)"
source "${SCRIPT_FOLDER}/../utils.sh"

build_gtk() {
  if ! [[ -d ./WebKitBuild/GTK/DependenciesGTK ]]; then
    yes | WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitgtk-libs
  fi
  local CMAKE_ARGS=""
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS="--cmakeargs=\"-DCMAKE_EXPORT_COMPILE_COMMANDS=1\""
  fi
  WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK ./Tools/Scripts/build-webkit --gtk --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox --no-webxr MiniBrowser
}

build_wpe() {
  if ! [[ -d ./WebKitBuild/WPE/DependenciesWPE ]]; then
    yes | WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE DEBIAN_FRONTEND=noninteractive ./Tools/Scripts/update-webkitwpe-libs
  fi
  local CMAKE_ARGS=""
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS="--cmakeargs=\"-DCMAKE_EXPORT_COMPILE_COMMANDS=1\""
  fi
  WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE ./Tools/Scripts/build-webkit --wpe --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox --no-webxr --cmakeargs=-DENABLE_COG=OFF MiniBrowser
}

ensure_linux_deps() {
  yes | DEBIAN_FRONTEND=noninteractive ./Tools/gtk/install-dependencies
  yes | DEBIAN_FRONTEND=noninteractive ./Tools/wpe/install-dependencies
  yes | DEBIAN_FRONTEND=noninteractive WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE ./Tools/Scripts/update-webkitwpe-libs
  yes | DEBIAN_FRONTEND=noninteractive WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK ./Tools/Scripts/update-webkitgtk-libs
}

if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
  cd "${WK_CHECKOUT_PATH}"
  echo "WARNING: checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
else
  cd "checkout"
fi

if [[ "$(uname)" == "Darwin" ]]; then
  CURRENT_HOST_OS_VERSION=$(getMacVersion)
  if [[ "${CURRENT_HOST_OS_VERSION}" == "10.15" ]]; then
    selectXcodeVersionOrDie "11.7"
  elif [[ "${CURRENT_HOST_OS_VERSION}" == "11."* ]]; then
    selectXcodeVersionOrDie "12.2"
  else
    echo "ERROR: ${CURRENT_HOST_OS_VERSION} is not supported"
    exit 1
  fi
  ./Tools/Scripts/build-webkit --release --touch-events --orientation-events
elif [[ "$(uname)" == "Linux" ]]; then
  if [[ $# == 0 || (-z "$1") ]]; then
    echo
    echo BUILDING: GTK and WPE
    echo
    build_wpe
    build_gtk
  elif [[ "$1" == "--full" ]]; then
    echo
    echo BUILDING: GTK and WPE
    echo
    ensure_linux_deps
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
  /c/Windows/System32/cmd.exe "/c $(cygpath -w ${SCRIPT_FOLDER}/buildwin.bat)"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
