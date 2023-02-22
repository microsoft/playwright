---
id: docker
title: "Docker"
---

[Dockerfile.focal] can be used to run Playwright scripts in Docker environment. These image includes all the dependencies needed to run browsers in a Docker container, and also include the browsers themselves.

<!-- TOC -->

## Usage

This Docker image is published to [Microsoft Artifact Registry].

:::info
This Docker image is intended to be used for testing and development purposes only. It is not recommended to use this Docker image to visit untrusted websites.
:::

### Pull the image

```bash js
docker pull mcr.microsoft.com/playwright:v1.32.0-focal
```

```bash python
docker pull mcr.microsoft.com/playwright/python:v1.32.0-focal
```

```bash csharp
docker pull mcr.microsoft.com/playwright/dotnet:v1.32.0-focal
```

```bash java
docker pull mcr.microsoft.com/playwright/java:v1.32.0-focal
```

### Run the image

By default, the Docker image will use the `root` user to run the browsers. This will disable the Chromium sandbox which is not available with root. If you run trusted code (e.g. End-to-end tests) and want to avoid the hassle of managing separate user then the root user may be fine. For web scraping or crawling, we recommend to create a separate user inside the Docker container and use the seccomp profile.

#### End-to-end tests

On trusted websites, you can avoid creating a separate user and use root for it since you trust the code which will run on the browsers.

```bash js
docker run -it --rm --ipc=host mcr.microsoft.com/playwright:v1.32.0-focal /bin/bash
```

```bash python
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/python:v1.32.0-focal /bin/bash
```

```bash csharp
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/dotnet:v1.32.0-focal /bin/bash
```

```bash java
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/java:v1.32.0-focal /bin/bash
```

#### Crawling and scraping

On untrusted websites, it's recommended to use a separate user for launching the browsers in combination with the seccomp profile. Inside the container or if you are using the Docker image as a base image you have to use `adduser` for it.

```bash js
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright:v1.32.0-focal /bin/bash
```

```bash python
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/python:v1.32.0-focal /bin/bash
```

```bash csharp
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/dotnet:v1.32.0-focal /bin/bash
```

```bash java
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/java:v1.32.0-focal /bin/bash
```

[`seccomp_profile.json`](https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json) is needed to run Chromium with sandbox. This is a [default Docker seccomp profile](https://github.com/docker/engine/blob/d0d99b04cf6e00ed3fc27e81fc3d94e7eda70af3/profiles/seccomp/default.json) with extra user namespace cloning permissions:

```json
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
```

:::note
Using `--ipc=host` is recommended when using Chrome ([Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)). Chrome can run out of memory without this flag.
:::


### Using on CI

See our [Continuous Integration guides](./ci.md) for sample configs.

## Image tags

See [all available image tags].

Docker images are published automatically by GitHub Actions. We currently publish images with the
following tags (`v1.20.0` in this case is an example:):
- `:next` - tip-of-tree image version based on Ubuntu 20.04 LTS (Focal Fossa).
- `:next-focal` - tip-of-tree image version based on Ubuntu 20.04 LTS (Focal Fossa).
- `:v1.20.0` - Playwright v1.20.0 release docker image based on Ubuntu 20.04 LTS (Focal Fossa).
- `:v1.20.0-focal` - Playwright v1.20.0 release docker image based on Ubuntu 20.04 LTS (Focal Fossa).
- `:sha-XXXXXXX` - docker image for every commit that changed
  docker files or browsers, marked with a [short sha](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection#Short-SHA-1) (first 7 digits of the SHA commit).

:::note
It is recommended to always pin your Docker image to a specific version if possible. If the Playwright version in your Docker image does not match the version in your project/tests, Playwright will be unable to locate browser executables.
:::

### Base images

We currently publish images based on the following [Ubuntu](https://hub.docker.com/_/ubuntu) versions:
- **Ubuntu 22.04 LTS** (Jammy Jellyfish), image tags include `jammy` (not published for Java and .NET)
- **Ubuntu 20.04 LTS** (Focal Fossa), image tags include `focal`

#### Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/Glibc) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.

## Development
* langs: js

### Build the image

Use [`//utils/docker/build.sh`](https://github.com/microsoft/playwright/blob/main/utils/docker/build.sh) to build the image.

```
./utils/docker/build.sh focal playwright:localbuild-focal
```

The image will be tagged as `playwright:localbuild-focal` and could be run as:

```
docker run --rm -it playwright:localbuild /bin/bash
```

