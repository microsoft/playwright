#!/bin/bash

set -e
set -x

is_user_root () { [ "${EUID:-$(id -u)}" -eq 0 ]; }
if is_user_root; then
  maybesudo=""
else
  maybesudo="sudo"
fi

if dpkg --get-selections | grep -q "^microsoft-edge-dev[[:space:]]*install$" >/dev/null; then
  $maybesudo apt-get remove -y microsoft-edge-dev
fi

if ! command -v curl >/dev/null; then
  $maybesudo apt-get install -y curl
fi

curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
$maybesudo install -o root -g root -m 644 /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/
$maybesudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge-dev.list'
rm /tmp/microsoft.gpg
$maybesudo apt-get update && $maybesudo apt-get install -y microsoft-edge-dev

microsoft-edge-dev --version
