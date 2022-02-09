#!/bin/bash
set -e
set -x

rm -rf "/Applications/Google Chrome Beta.app"
cd /tmp
curl -o ./googlechromebeta.dmg -k https://dl.google.com/chrome/mac/universal/beta/googlechromebeta.dmg
hdiutil attach -nobrowse -quiet -noautofsck -noautoopen -mountpoint /Volumes/googlechromebeta.dmg ./googlechromebeta.dmg
cp -rf "/Volumes/googlechromebeta.dmg/Google Chrome Beta.app" /Applications
hdiutil detach /Volumes/googlechromebeta.dmg
rm -rf /tmp/googlechromebeta.dmg

/Applications/Google\ Chrome\ Beta.app/Contents/MacOS/Google\ Chrome\ Beta --version
