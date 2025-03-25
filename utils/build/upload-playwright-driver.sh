#!/usr/bin/env bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

AZ_STORAGE_ACCOUNT="playwright2"
PACKAGE_VERSION=$(node -p "require('../../package.json').version")

platforms=("mac" "mac-arm64" "linux" "linux-arm64" "win32_x64" "win32_arm64")

for platform in "${platforms[@]}"; do
    az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-${platform}.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-${platform}.zip"
done
