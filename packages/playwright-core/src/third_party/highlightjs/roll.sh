#!/bin/bash
set -e
set +x

# Pick a stable release revision from here:
# https://github.com/highlightjs/highlight.js/releases
RELEASE_REVISION="af20048d5c601d6e30016d8171317bfdf8a6c242"
LANGUAGES="javascript python csharp java"
STYLES="tomorrow.css"

trap "cd $(pwd -P)" EXIT
SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"

cd "$(dirname "$0")"
rm -rf ./output
mkdir -p ./output

cd ./output
git clone git@github.com:highlightjs/highlight.js.git
cd ./highlight.js
git checkout ${RELEASE_REVISION}
npm install
node tools/build.js -t node ${LANGUAGES}

cd ../..
rm -rf ./highlightjs
mkdir -p ./highlightjs
cp -R output/highlight.js/build/lib/* highlightjs/
cp output/highlight.js/build/LICENSE highlightjs/
cp output/highlight.js/build/types/index.d.ts highlightjs/
cp output/highlight.js/build/styles/${STYLES} highlightjs/
echo $'\n'"export = hljs;"$'\n' >> highlightjs/index.d.ts
rm -rf ./output
