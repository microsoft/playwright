#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER="$(pwd -P)"
source "${SCRIPT_FOLDER}/../utils.sh"

# On Linux, Universal build uses Flatpak rather then JHBuild
# and packs into a universal binary that can run on any linux
# distribution.
IS_UNIVERSAL_BUILD=""

build_gtk() {
  if [[ -z "${IS_UNIVERSAL_BUILD}" && ! -d "./WebKitBuild/GTK/DependenciesGTK" ]]; then
    yes | WEBKIT_JHBUILD=1 \
          WEBKIT_JHBUILD_MODULESET=minimal \
          WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK \
          DEBIAN_FRONTEND=noninteractive \
          ./Tools/Scripts/update-webkitgtk-libs
  fi
  local CMAKE_ARGS=(
    --cmakeargs=-DENABLE_INTROSPECTION=OFF
    --cmakeargs=-DUSE_GSTREAMER_WEBRTC=FALSE
  )
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS+=("--cmakeargs=-DCMAKE_EXPORT_COMPILE_COMMANDS=1")
  fi
  if [[ -n "${IS_UNIVERSAL_BUILD}" ]]; then
    ./Tools/Scripts/build-webkit --gtk --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox "${CMAKE_ARGS[@]}" MiniBrowser
  else
    WEBKIT_JHBUILD=1 \
    WEBKIT_JHBUILD_MODULESET=minimal \
    WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK \
    ./Tools/Scripts/build-webkit --gtk --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox "${CMAKE_ARGS[@]}" MiniBrowser
  fi
}

build_wpe() {
  if [[ -z "${IS_UNIVERSAL_BUILD}" && ! -d "./WebKitBuild/WPE/DependenciesWPE" ]]; then
    yes | WEBKIT_JHBUILD=1 \
          WEBKIT_JHBUILD_MODULESET=minimal \
          WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE \
          DEBIAN_FRONTEND=noninteractive \
          ./Tools/Scripts/update-webkitwpe-libs
  fi
  local CMAKE_ARGS=(
    --cmakeargs=-DENABLE_COG=OFF
    --cmakeargs=-DENABLE_INTROSPECTION=OFF
    --cmakeargs=-DENABLE_WEBXR=OFF
    --cmakeargs=-DUSE_GSTREAMER_WEBRTC=FALSE
  )
  if [[ -n "${EXPORT_COMPILE_COMMANDS}" ]]; then
    CMAKE_ARGS+=("--cmakeargs=-DCMAKE_EXPORT_COMPILE_COMMANDS=1")
  fi

  if [[ -n "${IS_UNIVERSAL_BUILD}" ]]; then
    ./Tools/Scripts/build-webkit --wpe --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox "${CMAKE_ARGS[@]}" MiniBrowser
  else
    WEBKIT_JHBUILD=1 \
    WEBKIT_JHBUILD_MODULESET=minimal \
    WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE \
    ./Tools/Scripts/build-webkit --wpe --release "${CMAKE_ARGS}" --touch-events --orientation-events --no-bubblewrap-sandbox "${CMAKE_ARGS[@]}" MiniBrowser
  fi
}

ensure_linux_deps() {
  SUDO="" ; [ $UID -ne 0 ] && SUDO="sudo"

  # These two packages are needed to de-duplicate files on the GTK+WPE bundle and reduce its size.
  DEBIAN_FRONTEND=noninteractive ${SUDO} apt-get install -y symlinks rdfind

  if [[ -n "${IS_UNIVERSAL_BUILD}" ]]; then
    DEBIAN_FRONTEND=noninteractive ${SUDO} apt-get install -y flatpak
  fi

  yes | DEBIAN_FRONTEND=noninteractive ./Tools/gtk/install-dependencies
  yes | DEBIAN_FRONTEND=noninteractive ./Tools/wpe/install-dependencies
  if [[ -z "${IS_UNIVERSAL_BUILD}" ]]; then
    # In non-universal build install JHBuild deps.
    yes | DEBIAN_FRONTEND=noninteractive WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/WPE ./Tools/Scripts/update-webkitwpe-libs
    yes | DEBIAN_FRONTEND=noninteractive WEBKIT_JHBUILD=1 WEBKIT_JHBUILD_MODULESET=minimal WEBKIT_OUTPUTDIR=$(pwd)/WebKitBuild/GTK ./Tools/Scripts/update-webkitgtk-libs
  else
    yes | ./Tools/Scripts/update-webkitwpe-libs
    yes | ./Tools/Scripts/update-webkitgtk-libs
  fi
}

if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
  cd "${WK_CHECKOUT_PATH}"
  echo "WARNING: checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
else
  cd "$HOME/webkit"
fi

if is_mac; then
  selectXcodeVersionOrDie $(node "$SCRIPT_FOLDER/../get_xcode_version.js" webkit)
  ./Tools/Scripts/build-webkit --release --touch-events --orientation-events
elif is_linux; then
  args=("$@")
  IS_FULL=""
  BUILD_GTK=""
  BUILD_WPE=""
  for ((i="${#args[@]}"-1; i >= 0; --i)); do
      case ${args[i]} in
          --full) IS_FULL="1"; unset args[i]; ;;
          --gtk) BUILD_GTK="1"; unset args[i]; ;;
          --wpe) BUILD_WPE="1"; unset args[i]; ;;
          --universal) IS_UNIVERSAL_BUILD="1"; unset args[i]; ;;
      esac
  done

  # if neither gtk nor wpe is requested then build both.
  if [[ -z "${BUILD_GTK}" && -z "${BUILD_WPE}" ]]; then
    BUILD_GTK="1"
    BUILD_WPE="1"
  fi

  echo "== BUILD CONFIGURATION =="
  if [[ -n "${IS_UNIVERSAL_BUILD}" ]]; then
    echo "- universal build: YES"
  else
    echo "- universal build: NO"
  fi
  if [[ -n "${IS_FULL}" ]]; then
    echo "- install dependencies: YES"
  else
    echo "- install dependencies: NO"
  fi
  if [[ -n "${BUILD_GTK}" ]]; then
    echo "- build GTK: YES"
  else
    echo "- build GTK: NO"
  fi
  if [[ -n "${BUILD_WPE}" ]]; then
    echo "- build WPE: YES"
  else
    echo "- build WPE: NO"
  fi

  if [[ -n "${IS_FULL}" ]]; then
    ensure_linux_deps
  fi

  if [[ -n "${BUILD_WPE}" ]]; then
    build_wpe
  fi

  if [[ -n "${BUILD_GTK}" ]]; then
    build_gtk
  fi
elif is_win; then
  /c/Windows/System32/cmd.exe "/c $(cygpath -w "${SCRIPT_FOLDER}"/buildwin.bat)"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi
