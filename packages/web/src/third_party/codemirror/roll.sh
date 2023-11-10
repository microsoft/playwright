#!/usr/bin/env bash
PLAYWRIGHT_DIR=$(pwd)

rm -rf ~/tmp/roll_cm
rm ./packages/web/src/third_party/codemirror/lib/*
mkdir ~/tmp/roll_cm
cp ./packages/web/src/third_party/codemirror/shadow.diff ~/tmp/roll_cm
cd ~/tmp/roll_cm
git clone https://github.com/codemirror/codemirror5.git
cd codemirror5
git checkout 5.65.15
git apply ../shadow.diff
npm install
npm run build

cd "$PLAYWRIGHT_DIR"
cp ~/tmp/roll_cm/codemirror5/lib/codemirror.js ./packages/web/src/third_party/codemirror/lib/codemirror.js
cp ~/tmp/roll_cm/codemirror5/lib/codemirror.css ./packages/web/src/third_party/codemirror/lib/codemirror.css
cp ~/tmp/roll_cm/codemirror5/mode/css/css.js ./packages/web/src/third_party/codemirror/lib/
cp ~/tmp/roll_cm/codemirror5/mode/htmlmixed/htmlmixed.js ./packages/web/src/third_party/codemirror/lib/
cp ~/tmp/roll_cm/codemirror5/mode/javascript/javascript.js ./packages/web/src/third_party/codemirror/lib/
cp ~/tmp/roll_cm/codemirror5/mode/python/python.js ./packages/web/src/third_party/codemirror/lib/
cp ~/tmp/roll_cm/codemirror5/mode/clike/clike.js ./packages/web/src/third_party/codemirror/lib/
