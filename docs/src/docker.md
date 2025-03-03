---
id: docker
title: "Docker"
---

## Introduction

[Dockerfile.noble] can be used to run Playwright scripts in Docker environment. This image includes the [Playwright browsers](./browsers.md#install-browsers) and [browser system dependencies](./browsers.md#install-system-dependencies). The Playwright package/dependency is not included in the image and should be installed separately.

## Usage

This Docker image is published to [Microsoft Artifact Registry].

:::info
This Docker image is intended to be used for testing and development purposes only. It is not recommended to use this Docker image to visit untrusted websites.
:::

### Pull the image

```bash js
docker pull mcr.microsoft.com/playwright:v%%VERSION%%-noble
```

```bash python
docker pull mcr.microsoft.com/playwright/python:v%%VERSION%%-noble
```

```bash csharp
docker pull mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-noble
```

```bash java
docker pull mcr.microsoft.com/playwright/java:v%%VERSION%%-noble
```

### Run the image

By default, the Docker image will use the `root` user to run the browsers. This will disable the Chromium sandbox which is not available with root. If you run trusted code (e.g. End-to-end tests) and want to avoid the hassle of managing separate user then the root user may be fine. For web scraping or crawling, we recommend to create a separate user inside the Docker container and use the seccomp profile.

#### End-to-end tests

On trusted websites, you can avoid creating a separate user and use root for it since you trust the code which will run on the browsers.

```bash js
docker run -it --rm --ipc=host mcr.microsoft.com/playwright:v%%VERSION%%-noble /bin/bash
```

```bash python
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/python:v%%VERSION%%-noble /bin/bash
```

```bash csharp
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-noble /bin/bash
```

```bash java
docker run -it --rm --ipc=host mcr.microsoft.com/playwright/java:v%%VERSION%%-noble /bin/bash
```

#### Crawling and scraping

On untrusted websites, it's recommended to use a separate user for launching the browsers in combination with the seccomp profile. Inside the container or if you are using the Docker image as a base image you have to use `adduser` for it.

```bash js
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright:v%%VERSION%%-noble /bin/bash
```

```bash python
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/python:v%%VERSION%%-noble /bin/bash
```

```bash csharp
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-noble /bin/bash
```

```bash java
docker run -it --rm --ipc=host --user pwuser --security-opt seccomp=seccomp_profile.json mcr.microsoft.com/playwright/java:v%%VERSION%%-noble /bin/bash
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

### Recommended Docker Configuration

When running Playwright in Docker, the following configuration is recommended:

1. **Using [`--init`](https://docs.docker.com/reference/cli/docker/container/run/#init)** Docker flag is recommended to avoid special treatment for processes with PID=1. This is a common reason for zombie processes.

1. **Using `--ipc=host`** is recommended when using Chromium. Without it, Chromium can run out of memory and crash. Learn more about this option in [Docker docs](https://docs.docker.com/reference/cli/docker/container/run/#ipc).

1. **If seeing weird errors when launching Chromium**, try running your container with `docker run --cap-add=SYS_ADMIN` when developing locally.

### Using on CI

See our [Continuous Integration guides](./ci.md) for sample configs.

### Remote Connection

You can run Playwright Server in Docker while keeping your tests running on the host system or another machine. This is useful for running tests on unsupported Linux distributions or remote execution scenarios.

#### Running the Playwright Server

Start the Playwright Server in Docker:

```bash
docker run -p 3000:3000 --rm --init -it --workdir /home/pwuser --user pwuser mcr.microsoft.com/playwright:v%%VERSION%%-noble /bin/sh -c "npx -y playwright@%%VERSION%% run-server --port 3000 --host 0.0.0.0"
```

#### Connecting to the Server
* langs: js

There are two ways to connect to the remote Playwright server:

1. Using environment variable with `@playwright/test`:

```bash
PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3000/ npx playwright test
```

2. Using the [`method: BrowserType.connect`] API for other applications:

```js
const browser = await playwright['chromium'].connect('ws://127.0.0.1:3000/');
```

#### Connecting to the Server
* langs: python, csharp, java

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect("ws://127.0.0.1:3000/")
```

```python async
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.connect("ws://127.0.0.1:3000/")
```

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.ConnectAsync("ws://127.0.0.1:3000/");
```

```java
package org.example;

import com.microsoft.playwright.*;
import java.nio.file.Paths;

public class App {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().connect("ws://127.0.0.1:3000/");
    }
  }
}
```

#### Network Configuration

If you need to access local servers from within the Docker container:

```bash
docker run --add-host=hostmachine:host-gateway -p 3000:3000 --rm --init -it --workdir /home/pwuser --user pwuser mcr.microsoft.com/playwright:v%%VERSION%%-noble /bin/sh -c "npx -y playwright@%%VERSION%% run-server --port 3000 --host 0.0.0.0"
```

This makes `hostmachine` point to the host's localhost. Your tests should use `hostmachine` instead of `localhost` when accessing local servers.

:::note
When running tests remotely, ensure the Playwright version in your tests matches the version running in the Docker container.
:::

## Image tags

See [all available image tags].

We currently publish images with the following tags:
- `:v%%VERSION%%` - Playwright v%%VERSION%% release docker image based on Ubuntu 24.04 LTS (Noble Numbat).
- `:v%%VERSION%%-noble` - Playwright v%%VERSION%% release docker image based on Ubuntu 24.04 LTS (Noble Numbat).
- `:v%%VERSION%%-jammy` - Playwright v%%VERSION%% release docker image based on Ubuntu 22.04 LTS (Jammy Jellyfish).

:::note
It is recommended to always pin your Docker image to a specific version if possible. If the Playwright version in your Docker image does not match the version in your project/tests, Playwright will be unable to locate browser executables.
:::

### Base images

We currently publish images based on the following [Ubuntu](https://hub.docker.com/_/ubuntu) versions:
- **Ubuntu 24.04 LTS** (Noble Numbat), image tags include `noble`
- **Ubuntu 22.04 LTS** (Jammy Jellyfish), image tags include `jammy`

#### Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/Glibc) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.

## Using a different .NET version
* langs: csharp

You can use the [.NET install script](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script) in order to install different SDK versions:

```bash
curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --install-dir /usr/share/dotnet --channel 9.0
```

## Build your own image
* langs: js

To run Playwright inside Docker, you need to have Node.js, [Playwright browsers](./browsers.md#install-browsers) and [browser system dependencies](./browsers.md#install-system-dependencies) installed. See the following Dockerfile:

```Dockerfile
FROM node:20-bookworm

RUN npx -y playwright@%%VERSION%% install --with-deps
```

## Build your own image
* langs: python

To run Playwright inside Docker, you need to have Python, [Playwright browsers](./browsers.md#install-browsers) and [browser system dependencies](./browsers.md#install-system-dependencies) installed. See the following Dockerfile:

```Dockerfile
FROM python:3.12-bookworm

RUN pip install playwright==@%%VERSION%% && \
    playwright install --with-deps
```
