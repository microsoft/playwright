# Running Playwright in Docker

## General

We provide official Docker images which include all the need dependencies for the recent **Ubuntu** and **Debian** versions to run browsers in a Docker container.

### Building image

```bash
docker build -t mcr.microsoft.com/playwright:focal -f Dockerfile.focal .
```

### Running image

```bash
docker container run -it --rm --ipc=host --security-opt seccomp=chrome.json mcr.microsoft.com/playwright:focal /bin/bash
```

> **NOTE**: The seccomp profile is coming from Jessie Frazelle. It's needed
> to run Chrome without sandbox.
> Using `--ipc=host` is also recommended when using Chrome. Without it Chrome can run out of memory and crash.
> [See the docker documentation for this option here.](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)

## Playwright on Ubuntu

### Ubuntu 20 - Focal

[Dockerfile.focal](Dockerfile.focal) is based on [Ubuntu 20](https://hub.docker.com/_/ubuntu).

### Ubuntu 18 - Bionic

[Dockerfile.bionic](Dockerfile.bionic) is based on [Ubuntu 18](https://hub.docker.com/_/ubuntu).

## Playwright on Debian

### Debian 10 - Buster

[Dockerfile.buster](Dockerfile.buster) is based on a [slim version](https://hub.docker.com/_/node/) of Debian buster.

## Playwright on Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/GNU_C_Library) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.
