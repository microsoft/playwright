#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
SCRIPT_PATH=$(pwd -P)

main() {
  if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
    echo "usage: $(basename $0) [output-absolute-path]"
    echo
    echo "Generate distributable .zip archive from ./output folder that was previously downloaded."
    echo
    exit 0
  fi

  ZIP_PATH=$1

  if [[ $ZIP_PATH != /* ]]; then
    echo "ERROR: path $ZIP_PATH is not absolute"
    exit 1
  fi
  if [[ $ZIP_PATH != *.zip ]]; then
    echo "ERROR: path $ZIP_PATH must have .zip extension"
    exit 1
  fi
  if [[ -f $ZIP_PATH ]]; then
    echo "ERROR: path $ZIP_PATH exists; can't do anything."
    exit 1
  fi
  if ! [[ -d $(dirname $ZIP_PATH) ]]; then
    echo "ERROR: folder for path $($ZIP_PATH) does not exist."
    exit 1
  fi

  BUILD_TYPE=$2
  if [[ "${BUILD_TYPE}" == "--compile"* ]]; then
    archive_compiled_chromium "${BUILD_TYPE}"
  elif [[ "${BUILD_TYPE}" == "--mirror"* ]]; then
    archive_mirrored_chromium "${BUILD_TYPE}"
  else
    echo "ERROR: unknown build type - ${BUILD_TYPE}"
    exit 1
  fi

  cd "${SCRIPT_PATH}"
  cp output/build.zip $ZIP_PATH
}

function archive_compiled_chromium() {
  CHROMIUM_FOLDER_NAME=""
  CHROMIUM_FILES_TO_ARCHIVE=()

  if [[ $1 == "--compile-mac"* ]]; then
    CHROMIUM_FOLDER_NAME="chrome-mac"
    CHROMIUM_FILES_TO_ARCHIVE=("Chromium.app")
  elif [[ $1 == "--compile-linux" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-linux"
    # Run python script and convert output to array.
    IFS=$'\n' CHROMIUM_FILES_TO_ARCHIVE=($(python "${SCRIPT_PATH}/compute_files_to_archive.py" 64bit "${CR_CHECKOUT_PATH}/src/chrome/tools/build/linux/FILES.cfg"))
    unset IFS
  elif [[ $1 == "--compile-win32" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-win"
    IFS=$'\n\r' CHROMIUM_FILES_TO_ARCHIVE=($(python "${SCRIPT_PATH}/compute_files_to_archive.py" 32bit "${CR_CHECKOUT_PATH}/src/chrome/tools/build/win/FILES.cfg"))
    unset IFS
  elif [[ $1 == "--compile-win64" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-win"
    IFS=$'\n\r' CHROMIUM_FILES_TO_ARCHIVE=($(python "${SCRIPT_PATH}/compute_files_to_archive.py" 64bit "${CR_CHECKOUT_PATH}/src/chrome/tools/build/win/FILES.cfg"))
    unset IFS
  else
    echo "ERROR: unknown command, use --help for details"
    exit 1
  fi

  # Prepare resulting archive.
  cd "$SCRIPT_PATH"
  rm -rf output
  mkdir -p "output/${CHROMIUM_FOLDER_NAME}"

  # On Mac, use 'ditto' to copy directories instead of 'cp'.
  COPY_COMMAND="cp -R"
  if [[ $(uname) == "Darwin" ]]; then
    COPY_COMMAND="ditto"
  fi

  for ((i = 0; i < ${#CHROMIUM_FILES_TO_ARCHIVE[@]}; i++)) do
    file="${CHROMIUM_FILES_TO_ARCHIVE[$i]}"
    mkdir -p "output/${CHROMIUM_FOLDER_NAME}/$(dirname "${file}")"
    $COPY_COMMAND "${CR_CHECKOUT_PATH}/src/out/Default/${file}" "output/${CHROMIUM_FOLDER_NAME}/${file}"
  done

  if [[ $1 == "--compile-win"* ]]; then
    $COPY_COMMAND "${CR_CHECKOUT_PATH}/src/out/Default/"*.manifest "output/${CHROMIUM_FOLDER_NAME}/"
  fi

  cd output
  zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
}

archive_mirrored_chromium() {
  cd "${SCRIPT_PATH}/output"

  CHROMIUM_FOLDER_NAME=""
  CHROMIUM_FILES_TO_REMOVE=()

  PLATFORM="$1"
  if [[ "${PLATFORM}" == "--mirror-win32" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-win"
    CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  elif [[ "${PLATFORM}" == "--mirror-win64" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-win"
    CHROMIUM_FILES_TO_REMOVE+=("chrome-win/interactive_ui_tests.exe")
  elif [[ "${PLATFORM}" == "--mirror-mac" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-mac"
  elif [[ "${PLATFORM}" == "--mirror-linux" ]]; then
    CHROMIUM_FOLDER_NAME="chrome-linux"
  else
    echo "ERROR: unknown platform to build: $PLATFORM"
    exit 1
  fi

  for file in ${CHROMIUM_FILES_TO_REMOVE[@]}; do
    rm -f "${file}"
  done

  zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"
}

main "$@"
