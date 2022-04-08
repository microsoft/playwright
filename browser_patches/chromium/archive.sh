#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_PATH=$(pwd -P)

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename "$0") [output-absolute-path]"
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
if ! [[ -d $(dirname "$ZIP_PATH") ]]; then
  echo "ERROR: folder for path $($ZIP_PATH) does not exist."
  exit 1
fi

if [[ -z "${CR_CHECKOUT_PATH}" ]]; then
  CR_CHECKOUT_PATH="$HOME/chromium"
fi
if [[ ! -d "${CR_CHECKOUT_PATH}/src" ]]; then
  echo "ERROR: CR_CHECKOUT_PATH does not have src/ subfolder; is this a chromium checkout?"
  exit 1
fi

CHROMIUM_FOLDER_NAME=""
CHROMIUM_FILES_TO_ARCHIVE=()

if [[ $(uname) == "Darwin" ]]; then
  CHROMIUM_FOLDER_NAME="chrome-mac"
  IFS=$'\n' CHROMIUM_FILES_TO_ARCHIVE=($(node "${SCRIPT_PATH}/compute_files_to_archive.js" "${CR_CHECKOUT_PATH}/src/infra/archive_config/mac-archive-rel.json"))
  unset IFS
elif [[ $(uname) == "Linux" ]]; then
  CHROMIUM_FOLDER_NAME="chrome-linux"
  IFS=$'\n' CHROMIUM_FILES_TO_ARCHIVE=($(node "${SCRIPT_PATH}/compute_files_to_archive.js" "${CR_CHECKOUT_PATH}/src/infra/archive_config/linux-archive-rel.json"))
  unset IFS
elif [[ $(uname) == "MINGW"* || "$(uname)" == MSYS* ]]; then
  CHROMIUM_FOLDER_NAME="chrome-win"
  IFS=$'\n\r' CHROMIUM_FILES_TO_ARCHIVE=($(node "${SCRIPT_PATH}/compute_files_to_archive.js" "${CR_CHECKOUT_PATH}/src/infra/archive_config/win-archive-rel.json"))
  unset IFS
else
  echo "ERROR: unsupported platform - $(uname)"
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

if [[ $(uname) == "MINGW"* || "$(uname)" == MSYS* ]]; then
  $COPY_COMMAND "${CR_CHECKOUT_PATH}/src/out/Default/"*.manifest "output/${CHROMIUM_FOLDER_NAME}/"
  mkdir -p "output/${CHROMIUM_FOLDER_NAME}/locales"
  $COPY_COMMAND "${CR_CHECKOUT_PATH}/src/out/Default/locales/"*.pak "output/${CHROMIUM_FOLDER_NAME}/locales/"
fi

cd output
zip --symlinks -r build.zip "${CHROMIUM_FOLDER_NAME}"

cd "${SCRIPT_PATH}"
cp output/build.zip "$ZIP_PATH"
