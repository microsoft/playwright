#!/usr/bin/env bash

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
  exit 0
fi

if [[ ("${GITHUB_REPOSITORY}" != "microsoft/playwright") && ("${GITHUB_REPOSITORY}" != "microsoft/playwright-browsers") ]]; then
  echo "NOTE: skipping dashboard uploading from fork"
  exit 0
fi

if [[ "${GITHUB_REF}" != "refs/heads/main" && "${GITHUB_REF}" != 'refs/heads/release-'* ]]; then
  echo "NOTE: skipping dashboard uploading from Playwright branches"
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "ERROR: missing report name!"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

export BUILD_URL="https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
export COMMIT_SHA=$(git rev-parse HEAD)
export COMMIT_TITLE=$(git show -s --format=%s HEAD)
export COMMIT_AUTHOR_NAME=$(git show -s --format=%an HEAD)
export COMMIT_AUTHOR_EMAIL=$(git show -s --format=%ae HEAD)
export COMMIT_TIMESTAMP=$(git show -s --format=%ct HEAD)

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
    runURL: process.env.BUILD_URL,
    uuid: require('crypto').randomUUID(),
    osName: process.env.HOST_OS_NAME,
    arch: process.env.HOST_ARCH,
    osVersion: process.env.HOST_OS_VERSION,
    commitSHA: process.env.COMMIT_SHA,
    commitTimestamp: process.env.COMMIT_TIMESTAMP,
    commitTitle: process.env.COMMIT_TITLE,
    commitAuthorName: process.env.COMMIT_AUTHOR_NAME,
    commitAuthorEmail: process.env.COMMIT_AUTHOR_EMAIL,
    branchName: process.env.GITHUB_REF_NAME,
  };
  console.log(JSON.stringify(json));
EOF
)

REPORT_NAME=$(node -e "console.log(require('crypto').randomBytes(20).toString('hex'))")
node -e "${EMBED_METADATA_SCRIPT}" "$1" > "${REPORT_NAME}"

gzip "${REPORT_NAME}"

AZ_STORAGE_ACCOUNT="folioflakinessdashboard"

echo "Uploading ${REPORT_NAME}.gz"

az storage blob upload --auth-mode login --account-name "${AZ_STORAGE_ACCOUNT}" -c uploads -f "${REPORT_NAME}.gz" -n "${REPORT_NAME}.gz"

UTC_DATE=$(cat <<EOF | node
  const date = new Date();
  console.log(date.toISOString().substring(0, 10).replace(/-/g, ''));
EOF
)

az storage blob upload --auth-mode login --account-name "${AZ_STORAGE_ACCOUNT}" -c uploads-permanent -f "${REPORT_NAME}.gz" -n "${UTC_DATE}-${REPORT_NAME}.gz"
rm -rf "${REPORT_NAME}.gz"
