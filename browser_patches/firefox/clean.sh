#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"
cd "checkout"

OBJ_FOLDER=$(ls -1 | grep obj- || true)
if [[ -d $OBJ_FOLDER ]]; then
  rm -rf $OBJ_FOLDER
fi

