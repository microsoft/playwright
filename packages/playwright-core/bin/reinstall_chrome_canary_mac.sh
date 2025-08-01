#!/usr/bin/env bash
set -e
set -x

rm -rf "/Applications/Google Chrome Canary.app"
cd /tmp
curl --retry 3 -o ./googlechromecanary.dmg -k https://dl.google.com/chrome/mac/universal/canary/googlechromecanary.dmg
hdiutil attach -nobrowse -quiet -noautofsck -noautoopen -mountpoint /Volumes/googlechromecanary.dmg ./googlechromecanary.dmg
cp -pR "/Volumes/googlechromecanary.dmg/Google Chrome Canary.app" /Applications
hdiutil detach /Volumes/googlechromecanary.dmg
rm -rf /tmp/googlechromecanary.dmg

/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary --version
