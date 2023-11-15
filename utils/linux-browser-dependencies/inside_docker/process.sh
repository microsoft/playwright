#!/usr/bin/env bash
set -e
set +x

export DEBIAN_FRONTEND=noninteractive
export TZ=America/Los_Angeles

# Install Node.js
apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -sL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" >> /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs

# Install apt-file
apt-get update && apt-get install -y --no-install-recommends apt-file && apt-file update

# Install tip-of-tree playwright-core and browsers
mkdir /root/tmp && cd /root/tmp && npm init -y && npm i /root/hostfolder/playwright-core.tar.gz && npx playwright-core install

cp /root/hostfolder/inside_docker/list_dependencies.js /root/tmp/list_dependencies.js

FILENAME="RUN_RESULT"
if [[ -n $1 ]]; then
  FILENAME=$1
fi
node list_dependencies.js | tee "/root/hostfolder/$FILENAME"
