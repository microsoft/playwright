#!/bin/bash
set -e
set -x

cd /tmp
curl -o ./msedge_dev.pkg -k "$1"
# Note: there's no way to uninstall previously installed MSEdge.
# However, running PKG again seems to update installation.
sudo installer -pkg /tmp/msedge_dev.pkg -target /
rm -rf /tmp/msedge_dev.pkg
/Applications/Microsoft\ Edge\ Dev.app/Contents/MacOS/Microsoft\ Edge\ Dev --version
