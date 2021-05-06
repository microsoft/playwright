#!/bin/bash
set -e
set -x

# 1. make sure to remove old beta if any.
if sudo dpkg -S google-chrome-beta &>/dev/null; then
  sudo apt-get remove -y google-chrome-beta
fi

# 2. download chrome beta from dl.google.com and install it.
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
sudo apt-get install -y ./google-chrome-beta_current_amd64.deb
rm -rf ./google-chrome-beta_current_amd64.deb
cd -
