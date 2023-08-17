FROM gitpod/workspace-full-vnc

RUN npm install \
 && npm run build \
 && apt-get update \
 && apt-get install -y software-properties-common \
 && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add - \
 && add-apt-repository \"deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" \
 && apt-get install -y docker-ce-cli

USER root
