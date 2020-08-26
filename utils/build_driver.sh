#/bin/bash

set -e

echo "Generating API"
node utils/doclint/dumpTypes.js > packages/playwright-driver/api.json
echo "Generated API successfully"

echo "Building RPC drivers"
node_modules/.bin/pkg --public --targets node12-linux-x64,node12-macos-x64,node12-win-x64 --out-path=drivers -c packages/playwright-driver/package.json packages/playwright-driver/main.js
echo "Built RPC drivers successfully"
