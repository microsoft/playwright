#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

PACKAGE_VERSION=$(node -p "require('../../package.json').version")
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f ./output/playwright-${PACKAGE_VERSION}-mac.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-mac.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f ./output/playwright-${PACKAGE_VERSION}-mac-arm64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-mac-arm64.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f ./output/playwright-${PACKAGE_VERSION}-linux.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-linux.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f ./output/playwright-${PACKAGE_VERSION}-linux-arm64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-linux-arm64.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f ./output/playwright-${PACKAGE_VERSION}-win32_x64.zip -n "${AZ_UPLOAD_FOLDER}/playwright-${PACKAGE_VERSION}-win32_x64.zip"
