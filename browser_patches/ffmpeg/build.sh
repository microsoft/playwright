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
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ ("$1" == "-h") || ("$1" == "--help") ]]; then
  echo "usage: $(basename $0) [--mac|--linux|--cross-compile-win64]"
  echo
  echo "Build ffmpeg for the given platform"
  echo
  exit 0
fi

if [[ -z "$1" ]]; then
  echo "ERROR: expected build target. Run with --help for more info"
  exit 1
fi

LICENSE_FILE="COPYING.LGPLv2.1"

rm -rf ./output
mkdir -p output
cp ffmpeg-license/"${LICENSE_FILE}" output

dockerflags="";
# Use |-it| to run docker to support Ctrl-C if we run the script inside interactive terminal.
# Otherwise (e.g. cronjob) - do nothing.
if [[ -t 0 ]]; then
  dockerflags="-it"
fi

function ensure_docker_or_die() {
  if ! command -v docker >/dev/null; then
    echo "ERROR: docker is required for the script"
    exit 1
  fi
}

if [[ "$1" == "--mac" ]]; then
  bash ./build-mac.sh
  cd output && zip ffmpeg.zip ffmpeg-mac "${LICENSE_FILE}"
elif [[ "$1" == "--linux" ]]; then
  ensure_docker_or_die

  time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/build-linux.sh /host/output/ffmpeg-linux
  cd output && zip ffmpeg.zip ffmpeg-linux "${LICENSE_FILE}"
elif [[ "$1" == --cross-compile-win64 ]]; then
  ensure_docker_or_die

  time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/crosscompile-from-linux.sh --win64 /host/output/ffmpeg-win64.exe
  cd output && zip ffmpeg.zip ffmpeg-win64.exe "${LICENSE_FILE}"
elif [[ "$1" == "--cross-compile-linux-arm64" ]]; then
  ensure_docker_or_die

  time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/crosscompile-from-linux.sh --linux-arm64 /host/output/ffmpeg-linux
  cd output && zip ffmpeg.zip ffmpeg-linux "${LICENSE_FILE}"
else
  echo "ERROR: unsupported platform - $1"
  exit 1
fi

