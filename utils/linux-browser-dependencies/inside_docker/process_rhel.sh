#!/usr/bin/env bash
set -e
set +x

# Install Node.js 20 via dnf module stream (playwright requires Node >= 18)
dnf module enable -y nodejs:20
dnf install -y nodejs

# Install playwright-core
mkdir /root/tmp && cd /root/tmp && npm init -y && npm i /root/hostfolder/playwright-core.tar.gz && npx playwright-core install chromium

cp /root/hostfolder/inside_docker/list_dependencies_rhel.js /root/tmp/list_dependencies_rhel.js

FILENAME="RUN_RESULT"
if [[ -n $1 ]]; then
  FILENAME=$1
fi
node list_dependencies_rhel.js | tee "/root/hostfolder/$FILENAME"
