FROM --platform=linux/amd64 ubuntu:22.04

# Reexport --build-arg as environment variables
ARG ARG_BUILD_FLAVOR
ARG ARG_BROWSER_NAME
ENV BUILD_FLAVOR="${ARG_BUILD_FLAVOR}"
ENV BROWSER_NAME="${ARG_BROWSER_NAME}"

# These are needed to auto-install tzdata. See https://serverfault.com/questions/949991/how-to-install-tzdata-on-a-ubuntu-docker-image
ARG DEBIAN_FRONTEND=noninteractive
ARG TZ=America/Los_Angeles

RUN apt-get update && apt-get install -y curl \
                                         build-essential \
                                         git-core \
                                         zip unzip \
                                         tzdata \
                                         sudo
# Install Python3 with distutils
RUN apt-get install -y python3 python3-dev python3-pip python3-distutils

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Install node16
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && apt-get install -y nodejs

# Create the pwuser and make it passwordless sudoer.
RUN adduser --disabled-password --gecos "" pwuser && \
    echo "ALL            ALL = (ALL) NOPASSWD: ALL" >> /etc/sudoers

# mitigate git clone issues on CI
# See https://stdworkflow.com/877/error-rpc-failed-curl-56-gnutls-recv-error-54-error-in-the-pull-function
RUN git config --system user.email "devops@playwright.dev" && \
    git config --system user.name "Playwright DevOps" && \
    git config --system http.postBuffer 524288000 && \
    git config --system http.lowSpeedLimit 0 && \
    git config --system http.lowSpeedTime 999999

# Show welcome message to pwuser
COPY --chown=pwuser ./pwuser_bashrc /home/pwuser/.bashrc

USER pwuser

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="${PATH}:/home/pwuser/.cargo/bin"

RUN mkdir -p /home/pwuser/.mozbuild
RUN cd /home/pwuser && git clone --depth=1 https://github.com/microsoft/playwright

WORKDIR /home/pwuser/playwright


