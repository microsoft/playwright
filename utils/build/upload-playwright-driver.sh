#!/usr/bin/env bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

AZ_STORAGE_ACCOUNT="playwright2"
PACKAGE_VERSION=$(node -p "require('../../package.json').version")

az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-mac.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-mac.zip"
az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-mac-arm64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-mac-arm64.zip"
az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-linux.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-linux.zip"
az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-linux-arm64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-linux-arm64.zip"
az storage blob upload -c builds --auth-mode login --account-name ${AZ_STORAGE_ACCOUNT} -f ./output/playwright-${PACKAGE_VERSION}-win32_x64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-win32_x64.zip"
