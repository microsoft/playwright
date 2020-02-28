# Running Playwright in Docker

`Dockerfile.bionic` is a playwright-ready image of playwright.
This image includes all the dependencies needed to run browsers in a Docker
container.

Building image:

```
$ sudo docker build -t microsoft/playwright:bionic -f Dockerfile.bionic .
```

Running image:

```
$ sudo docker container run -it --rm --security-opt seccomp=chrome.json microsoft/playwright /bin/bash
```

> **NOTE**: The seccomp profile is coming from Jessie Frazelle. It's needed
> to run Chrome without sandbox.

