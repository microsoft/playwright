# Running Playwright in Docker

We provide official Docker images which include all the need dependencies for the recent **Ubuntu** and **Debian** versions to run browsers in a Docker container.

<!-- GEN:toc -->
- [Usage](#usage)
  * [Pull the image](#pull-the-image)
  * [Run the image](#run-the-image)
  * [Using on CI](#using-on-ci)
- [Development](#development)
  * [Build the image](#build-the-image)
  * [Push the image](#push-the-image)
- [Available images](#available-images)
  * [Ubuntu](#ubuntu)
    - [Ubuntu 20 - Focal](#ubuntu-20---focal)
    - [Ubuntu 18 - Bionic](#ubuntu-18---bionic)
  * [Debian](#debian)
    - [Debian 10 - Buster](#debian-10---buster)
  * [Alpine](#alpine)
<!-- GEN:stop -->

## Usage

[![docker hub](https://img.shields.io/badge/docker-mcr.microsoft.com%2Fplaywright-blue)](https://hub.docker.com/_/microsoft-playwright)

This image is published on [Docker Hub](https://hub.docker.com/_/microsoft-playwright).

### Pull the image

```
docker pull mcr.microsoft.com/playwright:bionic
```

### Run the image

```
docker container run -it --rm --ipc=host --security-opt seccomp=chrome.json mcr.microsoft.com/playwright:bionic /bin/bash
```

Note that:

* The seccomp profile is required to run Chrome without sandbox. Thanks to [Jessie Frazelle](https://github.com/jessfraz/dotfiles/blob/master/etc/docker/seccomp/chrome.json).
* Using `--ipc=host` is also recommended when using Chrome ([Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)). Chrome can run out of memory without this flag.

### Using on CI

See our [Continuous Integration guides](../ci.md) for sample configs.

## Development

### Build the image

```
docker build -t mcr.microsoft.com/playwright:bionic -f Dockerfile.bionic .
```

### Push the image

Playwright on Docker Hub relies on

```
docker push playwright.azurecr.io/public/playwright:bionic
```

## Available images

### Ubuntu

#### Ubuntu 20 - Focal

[Dockerfile.focal](Dockerfile.focal) is based on [Ubuntu 20](https://hub.docker.com/_/ubuntu).

#### Ubuntu 18 - Bionic

[Dockerfile.bionic](Dockerfile.bionic) is based on [Ubuntu 18.04](https://hub.docker.com/_/ubuntu) LTS (Bionic Beaver).

### Debian

#### Debian 10 - Buster

[Dockerfile.buster](Dockerfile.buster) is based on a [slim version](https://hub.docker.com/_/node/) of Debian buster.

### Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/GNU_C_Library) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.
