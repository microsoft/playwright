# Running Playwright in Docker

[Dockerfile.bionic](Dockerfile.bionic) is a playwright-ready image of playwright.
This image includes all the dependencies needed to run browsers in a Docker
container.

Building image:

```
$ sudo docker build -t microsoft/playwright:bionic -f Dockerfile.bionic .
```

Running image:

```
$ sudo docker container run -it --rm --ipc=host --security-opt seccomp=chrome.json microsoft/playwright:bionic /bin/bash
```

> **NOTE**: The seccomp profile is coming from Jessie Frazelle. It's needed
> to run Chrome without sandbox.  
> Using `--ipc=host` is also recommended when using Chrome. Without it Chrome can run out of memory and crash.  
> [See the docker documentation for this option here.](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc)

## Playwright on Alpine

Browser builds for Firefox and WebKit are built for the [glibc](https://en.wikipedia.org/wiki/GNU_C_Library) library. Alpine Linux and other distributions that are based on the [musl](https://en.wikipedia.org/wiki/Musl) standard library are not supported.
