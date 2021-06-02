#!/bin/bash
set -e
set -x

# 1. make sure to remove old beta if any.
if sudo dpkg -S google-chrome &>/dev/null; then
  sudo apt-get remove -y google-chrome
fi

# 2. download chrome beta from dl.google.com and install it.
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
rm -rf ./google-chrome-stable_current_amd64.deb
cd -
