# Running Playwright in Docker

[Dockerfile.bionic](Dockerfile.bionic) can be used to run Playwright scripts in Docker environments. This image includes all the dependencies needed to run browsers in a Docker container, including browsers.

<!-- GEN:toc -->
- [Usage](#usage)
  * [Pull the image](#pull-the-image)
  * [Run the image](#run-the-image)
    - [End-to-end tests](#end-to-end-tests)
    - [Crawling and scraping](#crawling-and-scraping)
  * [Using on CI](#using-on-ci)
- [Image tags](#image-tags)
- [Development](#development)
  * [Build the image](#build-the-image)
  * [Push](#push)
- [Base images](#base-images)
  * [Ubuntu 20](#ubuntu-20)
  * [Ubuntu 18](#ubuntu-18)
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

By default, the Docker image will use the `root` user to run the browsers. This will disable the Chromium sandbox which is not available with root. If you run trusted code (e.g. End-to-end tests) and want to avoid the hassle of managing separate user then the root user may be fine. For web scraping or crawling, we recommend to create a separate user inside the Docker container and use the seccomp profile.

#### End-to-end tests

On trusted websites, you can avoid creating a separate user and use root for it since you trust the code which will run on the browsers.

```
docker run -it --rm --ipc=host mcr.microsoft.com/playwright:bionic /bin/bash
```

#### Crawling and scraping

On untrusted websites, it's recommended to use a separate user for launching the browsers in combination with the seccomp profile. Inside the container or if you are using the Docker image as a base image you have to use `adduser` for it.

```
$ docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright:bionic /bin/bash
```

[`seccomp_profile.json`](seccomp_profile.json) is needed to run Chromium with sandbox. This is
a [default Docker seccomp profile](https://github.com/docker/engine/blob/d0d99b04cf6e00ed3fc27e81fc3d94e7eda70af3/profiles/seccomp/default.json) with extra user namespace cloning permissions:

```json
[
  {
    "comment": "Allow create user namespaces",
    "names": [
      "clone",
      "setns",
      "unshare"
    ],
    "action": "SCMP_ACT_ALLOW",
    "args": [],
    "includes": {},
    "excludes": {}
  }
]
```

> **NOTE**: Using `--ipc=host` is recommended when using Chrome ([Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)). Chrome can run out of memory without this flag.


### Using on CI

See our [Continuous Integration guides](../ci.md) for sample configs.

## Image tags

See [all available image tags](https://mcr.microsoft.com/v2/playwright/tags/list).

## Development

### Build the image

Use [`//docs/docker/build.sh`](build.sh) to build the image.

```
$ ./docs/docker/build.sh bionic playwright:localbuild-bionic
```

The image will be tagged as `playwright:localbuild-bionic` and could be run as:

```
$ docker run --rm -it playwright:localbuild /bin/bash
```

### Push

Docker images are published automatically by GitHub Actions. We currently publish the following
images:
- `mcr.microsoft.com/playwright:next` - tip-of-tree image version.
- `mcr.microsoft.com/playwright:bionic` - last Playwright release docker image.
- `mcr.microsoft.com/playwright:sha-XXXXXXX` - docker image for every commit that changed
  docker files or browsers, marked with a [short sha](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection#Short-SHA-1) (first 7 digits of the SHA commit).

Status of push to MCR can be [verified here](https://mcrflow-status-ui.azurewebsites.net/) (internal link).

## Base images

### Ubuntu 20

`mcr.microsoft.com/playwright:focal` is based on Ubuntu 20.04 LTS (Focal Fossa).

### Ubuntu 18

`mcr.microsoft.com/playwright:bionic` is based on Ubuntu 18.04 LTS (Bionic Beaver).

### Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/GNU_C_Library) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.
