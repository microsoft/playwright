#!/bin/bash
set -e
set +x

RUST_VERSION="1.49.0"
CBINDGEN_VERSION="0.19.0"
# Certain minimal SDK Version is required by firefox
MACOS_SDK_VERSION="10.12"
# XCode version can be determined from https://en.wikipedia.org/wiki/Xcode
XCODE_VERSION_WITH_REQUIRED_SDK_VERSION="8.3.3"

trap "cd $(pwd -P)" EXIT

cd "$(dirname $0)"
SCRIPT_FOLDER="$(pwd -P)"

if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
  cd "${FF_CHECKOUT_PATH}"
  echo "WARNING: checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
else
  cd "../firefox/checkout"
fi

rm -rf .mozconfig

if [[ "$(uname)" == "Darwin" ]]; then
  if [[ $(uname -m) == "arm64" ]]; then
    # Building on Apple Silicon requires XCode12.2 and does not require any extra SDKs.
    if ! [[ -d "/Applications/Xcode12.2.app" ]]; then
      echo "As of Jan 2021, building Firefox on Apple Silicon requires XCode 12.2"
      echo "Make sure there's an /Applications/Xcode12.2.app"
      echo "Download XCode from https://developer.apple.com/download/more/"
      echo ""
      exit 1
    fi
    export DEVELOPER_DIR=/Applications/Xcode12.2.app/Contents/Developer
  else
    # Firefox currently does not build on 10.15 out of the box - it requires SDK for 10.12.
    # Make sure the SDK is out there.
    if ! [[ -d $HOME/SDK-archive/MacOSX${MACOS_SDK_VERSION}.sdk ]]; then
      echo "As of Dec 2020, Firefox does not build on Mac without ${MACOS_SDK_VERSION} SDK."
      echo "Download XCode ${XCODE_VERSION_WITH_REQUIRED_SDK_VERSION} from https://developer.apple.com/download/more/ and"
      echo "extract SDK to $HOME/SDK-archive/MacOSX${MACOS_SDK_VERSION}.sdk"
      echo ""
      echo "More info: https://firefox-source-docs.mozilla.org/setup/macos_build.html"
      exit 1
    else
      echo "-- configuting .mozconfig with ${MACOS_SDK_VERSION} SDK path"
      echo "ac_add_options --with-macos-sdk=$HOME/SDK-archive/MacOSX${MACOS_SDK_VERSION}.sdk/" >> .mozconfig
    fi
  fi
  echo "-- building on Mac"
elif [[ "$(uname)" == "Linux" ]]; then
  echo "-- building on Linux"
  echo "ac_add_options --disable-av1" >> .mozconfig
elif [[ "$(uname)" == MINGW* ]]; then
  echo "ac_add_options --disable-update-agent" >> .mozconfig
  echo "ac_add_options --disable-default-browser-agent" >> .mozconfig

  DLL_FILE=""
  if [[ $1 == "--win64" ]]; then
    echo "-- building win64 build on MINGW"
    echo "ac_add_options --target=x86_64-pc-mingw32" >> .mozconfig
    echo "ac_add_options --host=x86_64-pc-mingw32" >> .mozconfig
    DLL_FILE=$("C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -find '**\Redist\MSVC\*\x64\**\vcruntime140.dll')
  else
    echo "-- building win32 build on MINGW"
    DLL_FILE=$("C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -find '**\Redist\MSVC\*\x86\**\vcruntime140.dll')
  fi
  WIN32_REDIST_DIR=$(dirname "$DLL_FILE")
  if ! [[ -d $WIN32_REDIST_DIR ]]; then
    echo "ERROR: cannot find MS VS C++ redistributable $WIN32_REDIST_DIR"
    exit 1;
  fi
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi

OBJ_FOLDER="obj-build-playwright"
echo "mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/${OBJ_FOLDER}" >> .mozconfig
echo "ac_add_options --disable-crashreporter" >> .mozconfig

if [[ $1 == "--full" || $2 == "--full" ]]; then
  if [[ "$(uname)" == "Darwin" || "$(uname)" == "Linux" ]]; then
    SHELL=/bin/sh ./mach --no-interactive bootstrap --application-choice=browser
  fi
  if [[ ! -z "${WIN32_REDIST_DIR}" ]]; then
    # Having this option in .mozconfig kills incremental compilation.
    echo "export WIN32_REDIST_DIR=\"$WIN32_REDIST_DIR\"" >> .mozconfig
  fi
fi

if ! [[ -f "$HOME/.mozbuild/_virtualenvs/mach/bin/python" ]]; then
  ./mach create-mach-environment
fi

if [[ $1 == "--juggler" ]]; then
  ./mach build faster
else
  # TODO: rustup is not in the PATH on Windows
  if command -v rustup >/dev/null; then
    # We manage Rust version ourselves.
    echo "-- Using rust v${RUST_VERSION}"
    rustup install "${RUST_VERSION}"
    rustup default "${RUST_VERSION}"
  fi

  # TODO: cargo is not in the PATH on Windows
  if command -v cargo >/dev/null; then
    echo "-- Using cbindgen v${CBINDGEN_VERSION}"
    cargo install cbindgen --version "${CBINDGEN_VERSION}"
  fi
  ./mach build
fi

if [[ "$(uname)" == "Darwin" ]]; then
  node "${SCRIPT_FOLDER}"/install-preferences.js $PWD/${OBJ_FOLDER}/dist
else
  node "${SCRIPT_FOLDER}"/install-preferences.js $PWD/${OBJ_FOLDER}/dist/bin
fi

