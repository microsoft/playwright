#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

USAGE=$(cat<<EOF
  usage: $(basename $0) [--mirror|--mirror-linux|--mirror-win32|--mirror-win64|--mirror-mac|--compile-mac-arm64|--compile-linux|--compile-win32|--compile-win64|--compile-mac]

  Either compiles chromium or mirrors it from Chromium Continuous Builds CDN.
EOF
)

SCRIPT_PATH=$(pwd -P)

main() {
  if [[ $1 == "--help" || $1 == "-h" ]]; then
    echo "$USAGE"
    exit 0
  elif [[ $1 == "--mirror"* ]]; then
    mirror_chromium $1
  elif [[ $1 == "--compile"* ]]; then
    compile_chromium $1
  else
    echo "ERROR: unknown first argument. Use --help for details."
    exit 1
  fi
}


compile_chromium() {
  if [[ -z "${CR_CHECKOUT_PATH}" ]]; then
    echo "ERROR: chromium compilation requires CR_CHECKOUT_PATH to be set to reuse checkout."
    exit 1
  fi

  if [[ -z "${CR_CHECKOUT_PATH}/src" ]]; then
    echo "ERROR: CR_CHECKOUT_PATH does not have src/ subfolder; is this a chromium checkout?"
    exit 1
  fi

  source "${SCRIPT_PATH}/ensure_depot_tools.sh"

  if [[ $1 == "--compile-mac"* ]]; then
    # As of Jan, 2021 Chromium mac compilation requires Xcode12.2
    if [[ ! -d /Applications/Xcode12.2.app ]]; then
      echo "ERROR: chromium mac compilation requires /Applications/Xcode12.2.app"
      echo "Download one from https://developer.apple.com/download/more/"
      exit 1
    fi
    export DEVELOPER_DIR=/Applications/Xcode12.2.app/Contents/Developer
    # As of Jan, 2021 Chromium mac compilation is only possible on Intel macbooks.
    # See https://chromium.googlesource.com/chromium/src.git/+/master/docs/mac_arm64.md
    if [[ $1 == "--compile-mac-arm64" && $(uname -m) != "x86_64" ]]; then
      echo "ERROR: chromium mac arm64 compilation is (ironically) only supported on Intel Macbooks"
      exit 1
    fi
  fi

  cd "${CR_CHECKOUT_PATH}/src"

  # Prepare build folder.
  mkdir -p "./out/Default"
  echo "is_debug = false" > ./out/Default/args.gn
  if [[ $2 == "--symbols" ]]; then
    echo "symbol_level = 1" >> ./out/Default/args.gn
  else
    echo "symbol_level = 0" >> ./out/Default/args.gn
  fi

  if [[ $1 == "--compile-mac-arm64" ]]; then
    echo 'target_cpu = "arm64"' >> ./out/Default/args.gn
  elif [[ $1 == "--compile-win32" ]]; then
    echo 'target_cpu = "x86"' >> ./out/Default/args.gn
  fi

  if [[ ! -z "$USE_GOMA" ]]; then
    PLAYWRIGHT_GOMA_PATH="${SCRIPT_PATH}/electron-build-tools/third_party/goma"
    if [[ $1 == "--compile-win"* ]]; then
      PLAYWRIGHT_GOMA_PATH=$(cygpath -w "${PLAYWRIGHT_GOMA_PATH}")
    fi
    echo 'use_goma = true' >> ./out/Default/args.gn
    echo "goma_dir = \"${PLAYWRIGHT_GOMA_PATH}\"" >> ./out/Default/args.gn
  fi

  if [[ $1 == "--compile-win"* ]]; then
    if [[ -z "$USE_GOMA" ]]; then
      /c/Windows/System32/cmd.exe "/c $(cygpath -w ${SCRIPT_PATH}/buildwin.bat)"
    else
      /c/Windows/System32/cmd.exe "/c $(cygpath -w ${SCRIPT_PATH}/buildwingoma.bat)"
    fi
  else
    gn gen out/Default
    if [[ $1 == "--compile-linux" ]]; then
      TARGETS="chrome chrome_sandbox clear_key_cdm"
    else
      TARGETS="chrome"
    fi
    if [[ -z "$USE_GOMA" ]]; then
      autoninja -C out/Default $TARGETS
    else
      ninja -j 200 -C out/Default $TARGETS
    fi
  fi
}

mirror_chromium() {
  cd "$SCRIPT_PATH"
  rm -rf output
  mkdir -p output
  cd output

  CHROMIUM_URL=""

  PLATFORM="$1"
  if [[ "${PLATFORM}" == "--mirror" ]]; then
    CURRENT_HOST_OS="$(uname)"
    if [[ "${CURRENT_HOST_OS}" == "Darwin" ]]; then
      PLATFORM="--mirror-mac"
    elif [[ "${CURRENT_HOST_OS}" == "Linux" ]]; then
      PLATFORM="--mirror-linux"
    elif [[ "${CURRENT_HOST_OS}" == MINGW* ]]; then
      PLATFORM="--mirror-win64"
    else
      echo "ERROR: unsupported host platform - ${CURRENT_HOST_OS}"
      exit 1
    fi
  fi

  CRREV=$(head -1 "${SCRIPT_PATH}/BUILD_NUMBER")
  if [[ "${PLATFORM}" == "--mirror-win32" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win/${CRREV}/chrome-win.zip"
  elif [[ "${PLATFORM}" == "--mirror-win64" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${CRREV}/chrome-win.zip"
  elif [[ "${PLATFORM}" == "--mirror-mac" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Mac/${CRREV}/chrome-mac.zip"
  elif [[ "${PLATFORM}" == "--mirror-linux" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${CRREV}/chrome-linux.zip"
  else
    echo "ERROR: unknown platform to build: $1"
    exit 1
  fi

  echo "--> Pulling Chromium ${CRREV} for ${PLATFORM#--}"

  curl --output chromium-upstream.zip "${CHROMIUM_URL}"
  unzip chromium-upstream.zip
}

main $1
