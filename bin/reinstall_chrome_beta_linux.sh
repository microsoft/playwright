#!/bin/bash
set -e
set -x

# 1. make sure to remove old beta if any.
if dpkg --get-selections | grep -q "^google-chrome-beta[[:space:]]*install$" >/dev/null; then
  sudo apt-get remove -y google-chrome-beta
fi

# 2. download chrome beta from dl.google.com and install it.
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
sudo apt-get install -y ./google-chrome-beta_current_amd64.deb
rm -rf ./google-chrome-beta_current_amd64.deb
cd -
google-chrome-beta --version
