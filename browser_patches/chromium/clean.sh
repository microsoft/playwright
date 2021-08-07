#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

rm -rf output
if [[ ! -z "${CR_CHECKOUT_PATH}" ]]; then
  rm -rf "${CR_CHECKOUT_PATH}/src/out"
fi

