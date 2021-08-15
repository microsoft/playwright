#!/bin/bash
set -e
set -x

is_user_root () { [ "${EUID:-$(id -u)}" -eq 0 ]; }
if is_user_root; then
  maybesudo=""
else
  maybesudo="sudo"
fi

# 1. make sure to remove old beta if any.
if dpkg --get-selections | grep -q "^google-chrome-beta[[:space:]]*install$" >/dev/null; then
  $maybesudo apt-get remove -y google-chrome-beta
fi

if ! command -v wget >/dev/null; then
  $maybesudo apt-get install -y wget
fi

# 2. download chrome beta from dl.google.com and install it.
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-beta_current_amd64.deb
$maybesudo apt-get install -y ./google-chrome-beta_current_amd64.deb
rm -rf ./google-chrome-beta_current_amd64.deb
cd -
google-chrome-beta --version
