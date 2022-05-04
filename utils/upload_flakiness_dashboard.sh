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

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) <report.json>"
  echo
  echo "Upload report to the flakiness dashboard."
  echo
  echo "NOTE: the following env variables are required:"
  echo "  FLAKINESS_CONNECTION_STRING     connection for the azure blob storage to upload report"
  exit 0
fi

if [[ ("${GITHUB_REPOSITORY}" != "microsoft/playwright") && ("${GITHUB_REPOSITORY}" != "microsoft/playwright-internal") ]]; then
  echo "NOTE: skipping dashboard uploading from fork"
  exit 0
fi

if [[ "${GITHUB_REF}" != "refs/heads/main" && "${GITHUB_REF}" != 'refs/heads/release-'* ]]; then
  echo "NOTE: skipping dashboard uploading from Playwright branches"
  exit 0
fi

if [[ -z "${FLAKINESS_CONNECTION_STRING}" ]]; then
  echo "ERROR: \$FLAKINESS_CONNECTION_STRING environment variable is missing."
  echo "       'Azure Account Name' and 'Azure Account Key' secrets are required"
  echo "       to upload flakiness results to Azure blob storage."
  exit 1
fi

if [[ $# == 0 ]]; then
  echo "ERROR: missing report name!"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

export HOST_OS_NAME="$(uname)"
export HOST_ARCH="$(uname -m)"
export HOST_OS_VERSION=""
if [[ "$HOST_OS_NAME" == "Darwin" ]]; then
  HOST_OS_VERSION=$(sw_vers -productVersion | grep -o '^\d\+.\d\+')
elif [[ "$HOST_OS_NAME" == "Linux" ]]; then
  HOST_OS_NAME="$(bash -c 'source /etc/os-release && echo $NAME')"
  HOST_OS_VERSION="$(bash -c 'source /etc/os-release && echo $VERSION_ID')"
fi

EMBED_METADATA_SCRIPT=$(cat <<EOF
  const json = require('./' + process.argv[1]);
  json.metadata = {
    osName: process.env.HOST_OS_NAME,
    arch: process.env.HOST_ARCH,
    osVersion: process.env.HOST_OS_VERSION,
  };
  console.log(JSON.stringify(json));
EOF
)

REPORT_NAME=$(node -e "console.log(require('crypto').randomBytes(20).toString('hex'))")
node -e "${EMBED_METADATA_SCRIPT}" "$1" > "${REPORT_NAME}"

gzip "${REPORT_NAME}"

az storage blob upload --connection-string "${FLAKINESS_CONNECTION_STRING}" -c uploads -f "${REPORT_NAME}.gz" -n "${REPORT_NAME}.gz"
rm -rf "${REPORT_NAME}.gz"

