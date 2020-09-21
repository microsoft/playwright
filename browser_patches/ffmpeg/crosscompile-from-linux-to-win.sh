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
TOOLCHAIN_PREFIX_32="/usr/bin/i686-w64-mingw32-"
TOOLCHAIN_PREFIX_64="/usr/bin/x86_64-w64-mingw32-"

arch=""
toolchain_prefix=""

if [[ "$(uname)" != "Linux" ]]; then
  echo "ERROR: this script is designed to be run on Linux. Can't run on $(uname)"
  exit 1
fi

if [[ "$1" == "--win32" ]]; then
  arch="win32";
  toolchain_prefix="${TOOLCHAIN_PREFIX_32}"
elif [[ "$1" == "--win64" ]]; then
  arch="win64";
  toolchain_prefix="${TOOLCHAIN_PREFIX_64}"
elif [[ -z "$1" ]]; then
  die "ERROR: expect --win32 or --win64 as the first argument"
else
  die "ERROR: unknown arch '$1' - expected --win32 or --win64"
fi

output_path="$2"
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
  make \
    CC="${toolchain_prefix}gcc" \
    CXX="${toolchain_prefix}g++" \
    AR="${toolchain_prefix}ar" \
    PREFIX="$PREFIX" \
    RANLIB="${toolchain_prefix}ranlib" \
    LD="${toolchain_prefix}ld" \
    STRIP="${toolchain_prefix}strip"
  make install
}

function build_libvpx {
  cd "${HOME}"
  git clone https://chromium.googlesource.com/webm/libvpx
  cd libvpx
  git checkout "${LIBVPX_VERSION}"
  # Cross-compiling libvpx according to the docs:
  # - https://chromium.googlesource.com/webm/libvpx/+/master/README
  local target=""
  if [[ $arch == "win32" ]]; then
    target="x86-win32-gcc";
  elif [[ $arch == "win64" ]]; then
    target="x86_64-win64-gcc";
  else
    die "ERROR: unsupported arch to compile libvpx - $arch"
  fi
  CROSS="${toolchain_prefix}" ./configure --prefix="${PREFIX}" --target="${target}" ${LIBVPX_CONFIG}
  CROSS="${toolchain_prefix}" make && make install
}

function build_ffmpeg {
  cd "${HOME}"
  git clone git://source.ffmpeg.org/ffmpeg.git
  cd ffmpeg
  git checkout "${FFMPEG_VERSION}"
  export PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig"
  # Prohibit pkg-config from using linux system installed libs.
  export PKG_CONFIG_LIBDIR=

  local ffmpeg_arch=""
  if [[ $arch == "win32" ]]; then
    ffmpeg_arch="x86";
  elif [[ $arch == "win64" ]]; then
    ffmpeg_arch="x86_64";
  else
    die "ERROR: unsupported arch to compile ffmpeg - $arch"
  fi
  ./configure --arch="${ffmpeg_arch}" \
            --target-os=mingw32 \
            --cross-prefix="${toolchain_prefix}" \
            --pkg-config=pkg-config \
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
apt-get install -y mingw-w64 git make yasm pkg-config

build_zlib
build_libvpx
build_ffmpeg

# put resulting executable where we were asked to
cp "${HOME}/ffmpeg/bin/ffmpeg.exe" "${output_path}"
${toolchain_prefix}strip "${output_path}"
