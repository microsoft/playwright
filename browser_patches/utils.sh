#!/bin/bash

function getMacVersion() {
  sw_vers -productVersion | grep -o '^\d\+.\d\+'
}

function selectXcodeVersionOrDie() {
  XCODE_VERSION="$1"
  if [[ -z "${XCODE_VERSION}" ]]; then
    echo "selectXcodeOrDie expects xcode vesion to be given!"
    exit 1
  fi
  XCODE_DIRECTORY="/Applications/Xcode${XCODE_VERSION}.app"
  if ! [[ -d "${XCODE_DIRECTORY}" ]]; then
    echo "ERROR: Xcode ${XCODE_VERSION} is required to compile!"
    echo
    echo "Either:"
    echo
    echo "- download required Xcode version from the developer.apple.com/downloads"
    echo "  once downloaded, make sure to run the following:"
    echo
    echo "     $ cd ${XCODE_DIRECTORY}/Contents/Resources/Packages"
    echo "     $ sudo installer -pkg XcodeSystemResources.pkg -target /"
    echo
    echo "- if you have some Xcode installation and want to try building with it:"
    echo
    echo "     $ ln -s /Applications/Xcode.app ${XCODE_DIRECTORY}"
    exit 1
  fi
  # This line sets XCode for all nested bash processes.
  export DEVELOPER_DIR="${XCODE_DIRECTORY}/Contents/Developer"
  echo "-- using ${XCODE_DIRECTORY}"
}

# see https://docs.microsoft.com/en-us/visualstudio/install/tools-for-managing-visual-studio-instances?view=vs-2019
function printMSVCRedistDir() {
  local dll_file=$("C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -find '**\Redist\MSVC\*\x64\**\vcruntime140.dll')
  local redist_dir=$(dirname "$dll_file")
  if ! [[ -d $redist_dir ]]; then
    echo "ERROR: cannot find MS VS C++ redistributable $redist_dir"
    exit 1;
  fi
  echo "$redist_dir"
}
