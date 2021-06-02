#!/bin/bash
set -e
set -x

trap "cd $(pwd -P)" EXIT
SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"

cd "$(dirname "$0")"
PACKAGE_VERSION=$(node -p "require('../../package.json').version")
rm -rf ./output
mkdir -p ./output

echo "Building playwright package"
../../packages/build_package.js playwright ./output/playwright.tgz

echo "Building api.json and protocol.yml"
node ../../utils/doclint/generateApiJson.js > ./output/api.json
cp ../../src/protocol/protocol.yml ./output/

function build {
  NODE_DIR=$1
  SUFFIX=$2
  ARCHIVE=$3
  RUN_DRIVER=$4
  NODE_URL=https://nodejs.org/dist/v12.20.1/${NODE_DIR}.${ARCHIVE}

  echo "Building playwright-${PACKAGE_VERSION}-${SUFFIX}"

  cd ${SCRIPT_PATH}

  mkdir -p ./output/playwright-${SUFFIX}
  tar -xzf ./output/playwright.tgz -C ./output/playwright-${SUFFIX}/

  curl ${NODE_URL} -o ./output/${NODE_DIR}.${ARCHIVE}
  NPM_PATH=""
  if [[ "${ARCHIVE}" == "zip" ]]; then
    cd ./output
    unzip -q ./${NODE_DIR}.zip
    cd ..
    cp ./output/${NODE_DIR}/node.exe ./output/playwright-${SUFFIX}/
    NPM_PATH="node_modules/npm/bin/npm-cli.js"
  elif [[ "${ARCHIVE}" == "tar.gz" ]]; then
    tar -xzf ./output/${NODE_DIR}.tar.gz -C ./output/
    cp ./output/${NODE_DIR}/bin/node ./output/playwright-${SUFFIX}/
    NPM_PATH="lib/node_modules/npm/bin/npm-cli.js"
  else
    echo "Unsupported ARCHIVE ${ARCHIVE}"
    exit 1
  fi

  cp ./output/${NODE_DIR}/LICENSE ./output/playwright-${SUFFIX}/
  cp ./output/api.json ./output/playwright-${SUFFIX}/package/
  cp ./output/protocol.yml ./output/playwright-${SUFFIX}/package/
  cd ./output/playwright-${SUFFIX}/package
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node "../../${NODE_DIR}/${NPM_PATH}" install --production
  rm package-lock.json

  cd ..
  if [[ "${RUN_DRIVER}" == *".cmd" ]]; then
    cp ../../${RUN_DRIVER} ./playwright.cmd
    chmod +x ./playwright.cmd
  elif [[ "${RUN_DRIVER}" == *".sh" ]]; then
    cp ../../${RUN_DRIVER} ./playwright.sh
    chmod +x ./playwright.sh
  else
    echo "Unsupported RUN_DRIVER ${RUN_DRIVER}"
    exit 1
  fi
  zip -q -r ../playwright-${PACKAGE_VERSION}-${SUFFIX}.zip .
}

build "node-v12.20.1-darwin-x64" "mac" "tar.gz" "run-driver-posix.sh"
build "node-v12.20.1-linux-x64" "linux" "tar.gz" "run-driver-posix.sh"
build "node-v12.20.1-win-x64" "win32_x64" "zip" "run-driver-win.cmd"
build "node-v12.20.1-win-x86" "win32" "zip" "run-driver-win.cmd"
