#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

USAGE=$(cat<<EOF
  usage: $(basename $0) [--mirror|--mirror-linux|--mirror-win32|--mirror-win64|--mirror-mac|--compile-mac-arm64]

  Either compiles chromium or mirrors it from Chromium Continuous Builds CDN.
EOF
)

SCRIPT_PATH=$(pwd -P)
CRREV=$(head -1 ./BUILD_NUMBER)

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
  if ! command -v gclient >/dev/null; then
    echo "ERROR: chromium compilation requires depot_tools to be installed!"
    exit 1
  fi

  CHROMIUM_FOLDER_NAME=""
  CHROMIUM_FILES_TO_ARCHIVE=()

  if [[ $1 == "--compile-mac-arm64" ]]; then
    # As of Jan, 2021 Chromium mac compilation requires Xcode12.2
    if [[ ! -d /Applications/Xcode12.2.app ]]; then
      echo "ERROR: chromium mac arm64 compilation requires XCode 12.2 to be available"
      echo "in the Applications folder!"
      exit 1
    fi
    # As of Jan, 2021 Chromium mac compilation is only possible on Intel macbooks.
    # See https://chromium.googlesource.com/chromium/src.git/+/master/docs/mac_arm64.md
    if [[ $(uname -m) != "x86_64" ]]; then
      echo "ERROR: chromium mac arm64 compilation is (ironically) only supported on Intel Macbooks"
      exit 1
    fi
    CHROMIUM_FOLDER_NAME="chrome-mac"
    CHROMIUM_FILES_TO_ARCHIVE+=("Chromium.app")
  fi

  # Get chromium SHA from the build revision.
  # This will get us the last redirect URL from the crrev.com service.
  REVISION_URL=$(curl -ILs -o /dev/null -w %{url_effective} "https://crrev.com/${CRREV}")
  CRSHA="${REVISION_URL##*/}"

  # Update Chromium checkout. One might think that this step should go to `prepare_checkout.sh`
  # script, but the `prepare_checkout.sh` is in fact designed to prepare a fork checkout, whereas
  # we don't fork Chromium.
  cd "${CR_CHECKOUT_PATH}/src"
  git checkout master
  git pull origin master
  git checkout "${CRSHA}"
  gclient sync

  # Prepare build folder.
  mkdir -p "./out/Default"
  cat <<EOF>./out/Default/args.gn
is_debug = false
symbol_level = 0
EOF

  if [[ $1 == "--compile-mac-arm64" ]]; then
    echo 'target_cpu = "arm64"' >> ./out/Default/args.gn
  fi

  # Compile Chromium with correct Xcode version.
  DEVELOPER_DIR=/Applications/Xcode12.2.app/Contents/Developer gn gen out/Default
  DEVELOPER_DIR=/Applications/Xcode12.2.app/Contents/Developer autoninja -C out/Default chrome

  # Prepare resulting archive similarly to how we do it in mirror_chromium.
  cd "$SCRIPT_PATH"
  rm -rf output
  mkdir -p "output/${CHROMIUM_FOLDER_NAME}"
  for file in ${CHROMIUM_FILES_TO_ARCHIVE[@]}; do
    ditto "${CR_CHECKOUT_PATH}/src/out/Default/${file}" "output/${CHROMIUM_FOLDER_NAME}/${file}"
  done
  cd output
  zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
}

mirror_chromium() {
  cd "$SCRIPT_PATH"
  rm -rf output
  mkdir -p output
  cd output

  CHROMIUM_URL=""
  CHROMIUM_FOLDER_NAME=""
  CHROMIUM_FILES_TO_REMOVE=()

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

  if [[ "${PLATFORM}" == "--mirror-win32" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win/${CRREV}/chrome-win.zip"
    CHROMIUM_FOLDER_NAME="chrome-win"
    CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  elif [[ "${PLATFORM}" == "--mirror-win64" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/${CRREV}/chrome-win.zip"
    CHROMIUM_FOLDER_NAME="chrome-win"
    CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  elif [[ "${PLATFORM}" == "--mirror-mac" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Mac/${CRREV}/chrome-mac.zip"
    CHROMIUM_FOLDER_NAME="chrome-mac"
  elif [[ "${PLATFORM}" == "--mirror-linux" ]]; then
    CHROMIUM_URL="https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/${CRREV}/chrome-linux.zip"
    CHROMIUM_FOLDER_NAME="chrome-linux"
  else
    echo "ERROR: unknown platform to build: $1"
    exit 1
  fi

  echo "--> Pulling Chromium ${CRREV} for ${PLATFORM#--}"

  curl --output chromium-upstream.zip "${CHROMIUM_URL}"
  unzip chromium-upstream.zip
  for file in ${CHROMIUM_FILES_TO_REMOVE[@]}; do
    rm -f "${file}"
  done

  zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
}

main $1
