#!/bin/bash

# Copyright (c) Microsoft Corporation.
#
# Licensed under the Apache License, Version 2.0 (the 'License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

function die() { echo "$@"; exit 1; }

if [[ "$(uname)" != "Darwin" ]]; then
  die "ERROR: this script is designed to be run on OSX. Can't run on $(uname)"
fi

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
SCRIPT_FOLDER="$(pwd -P)"
source "${SCRIPT_FOLDER}/../utils.sh"

CURRENT_HOST_OS_VERSION=$(getMacVersion)
# As of Oct 2021, we build FFMPEG for Mac with Xcode 13 to align toolchains.
if [[ "${CURRENT_HOST_OS_VERSION}" == "11."* ]]; then
  selectXcodeVersionOrDie "13"
else
  echo "ERROR: ${CURRENT_HOST_OS_VERSION} is not supported"
  exit 1
fi

source ./CONFIG.sh

BUILDDIR="${PWD}/build"
PREFIX="${BUILDDIR}/osx_prefix"
OUTPUT_PATH="${PWD}/output/ffmpeg-mac"

function build_zlib {
  cd "${BUILDDIR}"
  git clone https://github.com/madler/zlib
  cd zlib
  git checkout "${ZLIB_VERSION}"
  ./configure --prefix="${PREFIX}" ${ZLIB_CONFIG}
  make && make install
}

function build_libvpx {
  cd "${BUILDDIR}"
  git clone https://chromium.googlesource.com/webm/libvpx
  cd libvpx
  git checkout "${LIBVPX_VERSION}"
  # Compile libvpx according to the docs:
  # - https://chromium.googlesource.com/webm/libvpx/+/main/README
  ./configure --prefix="${PREFIX}" ${LIBVPX_CONFIG}
  make && make install
}

function build_ffmpeg {
  cd "${BUILDDIR}"
  git clone git://source.ffmpeg.org/ffmpeg.git
  cd ffmpeg
  git checkout "${FFMPEG_VERSION}"
  export PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig"
  # Prohibit pkg-config from using system installed libs.
  export PKG_CONFIG_LIBDIR=

  ./configure --pkg-config=pkg-config \
              --pkg-config-flags="--static" \
              --extra-cflags="-I/${PREFIX}/include" \
              --extra-ldflags="-L/${PREFIX}/lib" \
              --prefix="${PREFIX}" \
              --bindir="${PWD}/bin" \
              ${FFMPEG_CONFIG}
  make && make install
}

REQUIERED_BUILD_TOOLS=("git" "make" "yasm" "pkg-config")
missing_build_tools=()

for dependency in ${REQUIERED_BUILD_TOOLS[@]}; do
  if ! command -v "${dependency}" >/dev/null; then
    missing_build_tools+=("${dependency}")
  fi
done

if [[ ${#missing_build_tools[@]} != 0 ]]; then
  die "ERROR: missing dependencies! Please run:    brew install ${missing_build_tools[@]}"
fi

# Cleanup
set -x
rm -rf "${BUILDDIR}"
mkdir -p "${BUILDDIR}"

build_zlib
build_libvpx
build_ffmpeg

# put resulting executable where we were asked to
mkdir -p $(dirname "${OUTPUT_PATH}")
cp "${BUILDDIR}/ffmpeg/bin/ffmpeg" "${OUTPUT_PATH}"
strip "${OUTPUT_PATH}"
