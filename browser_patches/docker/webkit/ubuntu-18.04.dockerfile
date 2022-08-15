FROM --platform=linux/amd64 ubuntu:18.04

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

# Ubuntu 18.04 specific: update CMake. Default CMake on Ubuntu 18.04 is 3.10, whereas WebKit requires 3.12+.
RUN apt purge --auto-remove cmake && \
    apt-get install -y wget software-properties-common && \
    wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | sudo tee /etc/apt/trusted.gpg.d/kitware.gpg >/dev/null && \
    apt-add-repository "deb https://apt.kitware.com/ubuntu/ bionic main" && \
    apt-get update && apt-get install -y cmake

# Ubuntu 18.04 specific: default to gcc-9.
RUN add-apt-repository ppa:ubuntu-toolchain-r/test && \
    apt-get update && \
    apt-get install -y gcc-9 g++-9
ENV CC=/usr/bin/gcc-9
ENV CXX=/usr/bin/g++-9

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

# Show welcome message
COPY ./pwuser_bashrc /home/pwuser/.bashrc

USER pwuser
RUN cd /home/pwuser && git clone --depth=1 https://github.com/microsoft/playwright

WORKDIR /home/pwuser/playwright

