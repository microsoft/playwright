# Continuous Integration

Playwright tests can be executed to run on your CI environments. To simplify this, we have created sample configurations for common CI providers that can be used to bootstrap your setup.

<!-- GEN:toc -->
- [CI configurations](#ci-configurations)
  * [GitHub Actions](#github-actions)
  * [Docker](#docker)
    - [Tips](#tips)
  * [Azure Pipelines](#azure-pipelines)
  * [Travis CI](#travis-ci)
    - [Tips](#tips-1)
  * [CircleCI](#circleci)
  * [AppVeyor](#appveyor)
- [Debugging browser launches](#debugging-browser-launches)
- [Caching browsers](#caching-browsers)
<!-- GEN:stop -->

Broadly, configuration on CI involves **ensuring system dependencies** are in place, **installing Playwright and browsers** (typically with `npm install`), and **running tests** (typically with `npm test`). Windows and macOS build agents do not require any additional system dependencies. Linux build agents can require additional dependencies, depending on the Linux distribution.

## CI configurations

### GitHub Actions

The [Playwright GitHub Action](https://github.com/microsoft/playwright-github-action) can be used to run Playwright tests on GitHub Actions.

```yml
steps:
  - uses: microsoft/playwright-github-action@v1
  - name: Run your tests
    run: npm test
```

We run [our tests](/.github/workflows/tests.yml) on GitHub Actions, across a matrix of 3 platforms (Windows, Linux, macOS) and 3 browsers (Chromium, Firefox, WebKit).

### Docker

We have a [pre-built Docker image](docker/README.md) which can either be used directly, or as a reference to update your existing Docker definitions.

#### Tips
1. By default, Docker runs a container with a `/dev/shm` shared memory space 64MB.
   This is [typically too small](https://github.com/c0b/chrome-in-docker/issues/1) for Chromium
   and will cause Chromium to crash when rendering large pages. To fix, run the container with
   `docker run --shm-size=1gb` to increase the size of `/dev/shm`. Since Chromium 65, this is no
   longer necessary. Instead, launch the browser with the `--disable-dev-shm-usage` flag:

   ```js
   const browser = await playwright.chromium.launch({
     args: ['--disable-dev-shm-usage']
   });
   ```

   This will write shared memory files into `/tmp` instead of `/dev/shm`. See
   [crbug.com/736452](https://bugs.chromium.org/p/chromium/issues/detail?id=736452) for more details.
1. Using `--ipc=host` is also recommended when using Chromium—without it Chromium can run out of memory
   and crash. Learn more about this option in [Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc).
1. Seeing other weird errors when launching Chromium? Try running your container
   with `docker run --cap-add=SYS_ADMIN` when developing locally. Since the Dockerfile
   adds a `pwuser` user as a non-privileged user, it may not have all the necessary privileges.
1. [dumb-init](https://github.com/Yelp/dumb-init) is worth checking out if you're
   experiencing a lot of zombies Chromium processes sticking around. There's special
   treatment for processes with PID=1, which makes it hard to terminate Chromium
   properly in some cases (e.g. in Docker).

### Azure Pipelines

For Windows or macOS agents, no additional configuration required, just install Playwright and run your tests.

For Linux agents, refer to [our Docker setup](docker/README.md) to see additional dependencies that need to be installed.

### Travis CI

We run our tests on Travis CI over a Linux agent (Ubuntu 18.04). Use our [Travis configuration](/.travis.yml) to see list of additional dependencies to be installed.

#### Tips
- [User namespace cloning](http://man7.org/linux/man-pages/man7/user_namespaces.7.html) should be enabled to support proper sandboxing
- [xvfb](https://en.wikipedia.org/wiki/Xvfb) should be launched in order to run Chromium in non-headless mode (e.g. to test Chrome Extensions)

To sum up, your `.travis.yml` might look like this:

```yml
language: node_js
dist: bionic
addons:
  apt:
    packages:
    # These are required to run webkit
    - libwoff1
    - libopus0
    - libwebp6
    - libwebpdemux2
    - libenchant1c2a
    - libgudev-1.0-0
    - libsecret-1-0
    - libhyphen0
    - libgdk-pixbuf2.0-0
    - libegl1
    - libgles2
    - libevent-2.1-6
    - libnotify4
    - libxslt1.1
    - libvpx5
    # This is required to run chromium
    - libgbm1

# allow headful tests
before_install:
  # Enable user namespace cloning
  - "sysctl kernel.unprivileged_userns_clone=1"
  # Launch XVFB
  - "export DISPLAY=:99.0"
  - "sh -e /etc/init.d/xvfb start"
```

### CircleCI

We run our tests on CircleCI, with our [pre-built Docker image](docker/README.md). Use our [CircleCI configuration](/.circleci/config.yml) to create your own. Running Playwright smoothly on CircleCI requires the following steps:

1. Use the pre-built [Docker image](docker/README.md) in your config like so:

   ```yaml
   docker:
     - image: aslushnikov/playwright:bionic
       environment:
         NODE_ENV: development # Needed if playwright is in `devDependencies`
   ```

1. If you’re using Playwright through Jest, then you may encounter an error spawning child processes:

   ```
   [00:00.0]  jest args: --e2e --spec --max-workers=36
   Error: spawn ENOMEM
      at ChildProcess.spawn (internal/child_process.js:394:11)
   ```

   This is likely caused by Jest autodetecting the number of processes on the entire machine (`36`) rather than the number allowed to your container (`2`). To fix this, set `jest --maxWorkers=2` in your test command.

### AppVeyor

We run our tests on Windows agents in AppVeyor. Use our [AppVeyor configuration](/.appveyor.yml) to create your own.

## Debugging browser launches

Playwright supports the `DEBUG` environment variable to output debug logs during execution. Setting it to `pw:browser*` is helpful while debugging `Error: Failed to launch browser` errors.

```
DEBUG=pw:browser* npm run test
```

## Caching browsers

By default, Playwright installs browser binaries in the following directories. This behavior can be [customized with environment variables](installation.md).

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

These locations are not covered by typical CI configurations, which cache the project `node_modules` or the [npm-cache directory](https://docs.npmjs.com/cli-commands/cache.html). To cache the browser binaries between CI runs, cache this location in your CI configuration, against a hash of the Playwright version.
