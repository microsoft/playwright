#!/bin/bash
set -e
set +x

# Install Node.js

apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

# Install apt-file
apt-get update && apt-get install -y apt-file && apt-file update

# Install tip-of-tree playwright-core and browsers
mkdir /root/tmp && cd /root/tmp && npm init -y && npm i /root/hostfolder/playwright-core.tar.gz && npx playwright install

cp /root/hostfolder/inside_docker/list_dependencies.js /root/tmp/list_dependencies.js

FILENAME="RUN_RESULT"
if [[ -n $1 ]]; then
  FILENAME=$1
fi
node list_dependencies.js | tee "/root/hostfolder/$FILENAME"
