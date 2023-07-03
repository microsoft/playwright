#!/usr/bin/env bash
set -e
set -x

cd /tmp
curl -o ./msedge_stable.pkg -k "$1"
# Note: there's no way to uninstall previously installed MSEdge.
# However, running PKG again seems to update installation.
sudo installer -pkg /tmp/msedge_stable.pkg -target /
rm -rf /tmp/msedge_stable.pkg
/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --version
