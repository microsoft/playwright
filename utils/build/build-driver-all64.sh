#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

PACKAGE_VERSION=$(node -p "require('../../package.json').version")

rm -rf ./output

echo "Building playwright-${PACKAGE_VERSION}-mac"
npx pkg --public --targets node12-macos-x64 --output=./output/mac/playwright ../..
cp ../../browsers.json ./output/mac
cp ../../third_party/ffmpeg/COPYING.GPLv3 ./output/mac/ffmpeg.COPYING.GPLv3
cp ../../third_party/ffmpeg/ffmpeg-mac ./output/mac
pushd ./output/mac
zip -r ../playwright-${PACKAGE_VERSION}-mac.zip .
popd

echo "Building playwright-${PACKAGE_VERSION}-win32_x64"
npx pkg --public --targets node12-win-x64 --output=./output/win32_x64/playwright.exe ../..
cp ../../browsers.json ./output/win32_x64
cp ../../third_party/ffmpeg/COPYING.GPLv3 ./output/win32_x64/ffmpeg.COPYING.GPLv3
cp ../../third_party/ffmpeg/ffmpeg-win64.exe ./output/win32_x64
cp ../../bin/PrintDeps.exe ./output/win32_x64
pushd ./output/win32_x64
zip -r ../playwright-${PACKAGE_VERSION}-win32_x64.zip .
popd

echo "Building playwright-${PACKAGE_VERSION}-linux"
npx pkg --public --targets node12-linux-x64 --output=./output/linux/playwright ../..
cp ../../browsers.json ./output/linux
cp ../../third_party/ffmpeg/COPYING.GPLv3 ./output/linux/ffmpeg.COPYING.GPLv3
cp ../../third_party/ffmpeg/ffmpeg-linux ./output/linux
pushd ./output/linux
zip -r ../playwright-${PACKAGE_VERSION}-linux.zip .
popd
