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

set -ex

function die() { echo "$@"; exit 1; }


PREFIX="${HOME}/prefix"


if [[ "$(uname)" != "Linux" ]]; then
  echo "ERROR: this script is designed to be run on Linux. Can't run on $(uname)"
  exit 1
fi

output_path="$1"
if [[ -z "${output_path}" ]]; then
  die "ERROR: output path is not specified"
elif [[ "${output_path}" != /* ]]; then
  die "ERROR: output path ${output_path} is not absolute"
elif ! [[ -d $(dirname "${output_path}") ]]; then
  die "ERROR: folder for output path ${output_path} does not exist."
fi

function build_zlib {
  cd "${HOME}"
  git clone https://github.com/madler/zlib
  cd zlib
  git checkout "${ZLIB_VERSION}"
  ./configure --prefix="${PREFIX}" ${ZLIB_CONFIG}
  make && make install
}

function build_libvpx {
  cd "${HOME}"
  git clone https://chromium.googlesource.com/webm/libvpx
  cd libvpx
  git checkout "${LIBVPX_VERSION}"
  # Cross-compiling libvpx according to the docs:
  # - https://chromium.googlesource.com/webm/libvpx/+/main/README
  ./configure --prefix="${PREFIX}" ${LIBVPX_CONFIG}
  make && make install
}

function build_ffmpeg {
  cd "${HOME}"
  git clone git://source.ffmpeg.org/ffmpeg.git
  cd ffmpeg
  git checkout "${FFMPEG_VERSION}"
  export PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig"
  # Prohibit pkg-config from using linux system installed libs.
  export PKG_CONFIG_LIBDIR=

  ./configure --pkg-config=pkg-config \
              --pkg-config-flags="--static" \
              --extra-cflags="-I/${PREFIX}/include" \
              --extra-ldflags="-L/${PREFIX}/lib -static" \
              --prefix="${PREFIX}" \
              --bindir="${PWD}/bin" \
              ${FFMPEG_CONFIG}
  make && make install
}

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

source ./CONFIG.sh

apt-get update
apt-get install -y git make yasm pkg-config

build_zlib
build_libvpx
build_ffmpeg

# put resulting executable where we were asked to
cp "${HOME}/ffmpeg/bin/ffmpeg" "${output_path}"
strip "${output_path}"

