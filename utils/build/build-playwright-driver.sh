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
  cd ./output/playwright-${SUFFIX}/package
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node "../../${NODE_DIR}/${NPM_PATH}" install --production

  # ----------- Minifying magic ----------
  # We mess up with lib files location, and therefore use _PW_PACKAGE_ROOT
  # environment variable to guide our code (see packageRoot() in src).

  # The goal here is to have "lib2/cli/cli.js" and "lib2/cli/traceViewer/web/*".
  npm install -D @vercel/ncc@0.26.2
  npx ncc build -C -o dist -e "*.json" -e "*.yml" lib/cli/cli.js
  mkdir -p ./lib2/cli/traceViewer
  mv ./lib/cli/traceViewer/web ./lib2/cli/traceViewer/web
  mv ./dist/index.js ./lib2/cli/cli.js

  # Remove files that ended up in a bundle.
  rm -rf ./lib
  rm -rf ./dist
  rm -rf ./node_modules
  rm package-lock.json

  # Now move lib2 to lib, and we are done.
  mv ./lib2 ./lib
  # ------- End of minifying magic -------

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
