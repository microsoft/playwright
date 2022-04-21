#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER=$(pwd -P)

bash "../chromium/build.sh" "$@"
