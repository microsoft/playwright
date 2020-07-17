# Running Playwright in Docker

[Dockerfile.bionic](Dockerfile.bionic) is a playwright-ready image of playwright.
This image includes all the dependencies needed to run browsers in a Docker
container.

<!-- GEN:toc -->
- [Usage](#usage)
  * [Pull the image](#pull-the-image)
  * [Run the image](#run-the-image)
  * [Using on CI](#using-on-ci)
- [Development](#development)
  * [Build the image](#build-the-image)
  * [Push](#push)
- [Base images](#base-images)
  * [Alpine](#alpine)
<!-- GEN:stop -->

## Usage

[![docker hub](https://img.shields.io/badge/docker-mcr.microsoft.com%2Fplaywright-blue)](https://hub.docker.com/_/microsoft-playwright)

This image is published on [Docker Hub](https://hub.docker.com/_/microsoft-playwright).

### Pull the image

```
$ docker pull mcr.microsoft.com/playwright:bionic
```

### Run the image

```
$ docker container run -it --rm --ipc=host mcr.microsoft.com/playwright:bionic /bin/bash
```

Note that:
* Using `--ipc=host` is also recommended when using Chrome ([Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)). Chrome can run out of memory without this flag.

### Using on CI

See our [Continuous Integration guides](../ci.md) for sample configs.

## Development

### Build the image

```
$ docker build -t mcr.microsoft.com/playwright:bionic -f Dockerfile.bionic .
```

### Push

Playwright on Docker Hub is published via the [Microsoft Container Registry](https://github.com/microsoft/containerregistry).

```
$ docker push playwright.azurecr.io/public/playwright:bionic
```

## Base images

`playwright:bionic` is based on Ubuntu 18.04 LTS (Bionic Beaver).

### Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/GNU_C_Library) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.
