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
  echo "usage: $(basename $0) [--mac|--linux|--cross-compile-win32|--cross-compile-win64]"
  echo
  echo "Build ffmpeg for the given platform"
  echo
  exit 0
fi

if [[ -z "$1" ]]; then
  echo "ERROR: expected build target. Run with --help for more info"
  exit 1
fi

rm -rf ./output
mkdir -p output

dockerflags="";
# Use |-it| to run docker to support Ctrl-C if we run the script inside interactive terminal.
# Otherwise (e.g. cronjob) - do nothing.
if [[ -t 0 ]]; then
  dockerflags="-it"
fi

if [[ "$1" == "--mac" ]]; then
  bash ./build-mac.sh
  cd output && zip ffmpeg.zip ffmpeg-mac
elif [[ "$1" == "--linux" ]]; then
  if ! command -v docker >/dev/null; then
    echo "ERROR: docker is required for the script"
    exit 1
  fi
  time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/build-linux.sh /host/output/ffmpeg-linux
  cd output && zip ffmpeg.zip ffmpeg-linux
elif [[ "$1" == --cross-compile-win* ]]; then
  if ! command -v docker >/dev/null; then
    echo "ERROR: docker is required for the script"
    exit 1
  fi

  if [[ "$1" == "--cross-compile-win32" ]]; then
    time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/crosscompile-from-linux-to-win.sh --win32 /host/output/ffmpeg-win32.exe
    cd output && zip ffmpeg.zip ffmpeg-win32.exe
  elif [[ "$1" == "--cross-compile-win64" ]]; then
    time docker run --init --rm -v"${PWD}":/host ${dockerflags} ubuntu:18.04 bash /host/crosscompile-from-linux-to-win.sh --win64 /host/output/ffmpeg-win64.exe
    cd output && zip ffmpeg.zip ffmpeg-win64.exe
  else
    echo "ERROR: unsupported platform - $1"
    exit 1
  fi
else
  echo "ERROR: unsupported platform - $1"
  exit 1
fi

