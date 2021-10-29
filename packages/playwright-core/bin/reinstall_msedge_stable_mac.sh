#!/bin/bash
set -e
set -x

# Note: there's no way to uninstall previously installed MSEdge.
# However, running PKG again seems to update installation.
sudo installer -pkg "$1" -target /
/Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge --version
