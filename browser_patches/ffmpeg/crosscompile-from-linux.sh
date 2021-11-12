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
TOOLCHAIN_PREFIX_64="/usr/bin/x86_64-w64-mingw32-"
TOOLCHAIN_PREFIX_ARM64="/usr/bin/aarch64-linux-gnu-"

arch=""
toolchain_prefix=""
binary=""

if [[ "$(uname)" != "Linux" ]]; then
  echo "ERROR: this script is designed to be run on Linux. Can't run on $(uname)"
  exit 1
fi

if [[ "$1" == "--win64" ]]; then
  arch="win64";
  toolchain_prefix="${TOOLCHAIN_PREFIX_64}"
  binary="ffmpeg.exe"
elif [[ "$1" == "--linux-arm64" ]]; then
  arch="linux-arm64";
  toolchain_prefix="${TOOLCHAIN_PREFIX_ARM64}"
  binary="ffmpeg"
elif [[ -z "$1" ]]; then
  die "ERROR: expect --win64 or --linux-arm64 as the first argument"
else
  die "ERROR: unknown arch '$1' - expected --win64 or --linux-arm64"
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
  # - https://chromium.googlesource.com/webm/libvpx/+/main/README
  local target=""
  if [[ $arch == "win64" ]]; then
    target="x86_64-win64-gcc";
  elif [[ $arch == "linux-arm64" ]]; then
    target="arm64-linux-gcc";
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
  local ffmpeg_target_os=""
  if [[ $arch == "win64" ]]; then
    ffmpeg_arch="x86_64";
    ffmpeg_target_os="mingw32"
  elif [[ $arch == "linux-arm64" ]]; then
    ffmpeg_arch="arm64";
    ffmpeg_target_os="linux"
  else
    die "ERROR: unsupported arch to compile ffmpeg - $arch"
  fi
  ./configure --arch="${ffmpeg_arch}" \
            --target-os="${ffmpeg_target_os}" \
            --cross-prefix="${toolchain_prefix}" \
            --disable-doc \
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
apt-get install -y git make yasm pkg-config
if [[ "${arch}" == "linux-arm64" ]]; then
  apt-get install -y gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
else
  apt-get install -y mingw-w64
fi

build_zlib
build_libvpx
build_ffmpeg

# put resulting executable where we were asked to
cp "${HOME}/ffmpeg/bin/${binary}" "${output_path}"
${toolchain_prefix}strip "${output_path}"
