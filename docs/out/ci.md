---
id: ci
title: "Continuous Integration"
---

Playwright tests can be executed in CI environments. We have created sample configurations for common CI providers.

- [Introduction](#introduction)
- [CI configurations](#ci-configurations)
- [Caching browsers](#caching-browsers)
- [Debugging browser launches](#debugging-browser-launches)
- [Running headful](#running-headful)

## Introduction

3 steps to get your tests running on CI:
1. **Ensure CI agent can run browsers**: Use [our Docker image](./docker.md) in Linux agents. Windows and macOS agents do not require any additional dependencies.
1. **Install Playwright**: In most projects, this would be done with `npm ci` (or `npm install`). Playwright would install the relevant browsers automatically.
1. **Run your tests**: Use `npm test` or equivalent to execute your tests.

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

We have a [pre-built Docker image](./docker.md) which can either be used directly, or as a reference to update your existing Docker definitions.

Suggested configuration
1. By default, Docker runs a container with a `/dev/shm` shared memory space 64MB. This is [typically too small](https://github.com/c0b/chrome-in-docker/issues/1) for Chromium and will cause Chromium to crash when rendering large pages. To fix, run the container with `docker run --shm-size=1gb` to increase the size of `/dev/shm`. Since Chromium 65, this is no longer necessary. Instead, launch the browser with the `--disable-dev-shm-usage` flag:

   ```js
   const browser = await playwright.chromium.launch({
     args: ['--disable-dev-shm-usage']
   });
   ```

   This will write shared memory files into `/tmp` instead of `/dev/shm`. See [crbug.com/736452](https://bugs.chromium.org/p/chromium/issues/detail?id=736452) for more details.
1. Using `--ipc=host` is also recommended when using Chromium—without it Chromium can run out of memory and crash. Learn more about this option in [Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc).
1. Seeing other weird errors when launching Chromium? Try running your container with `docker run --cap-add=SYS_ADMIN` when developing locally.
1. [dumb-init](https://github.com/Yelp/dumb-init) is worth checking out if you're experiencing a lot of zombies Chromium processes sticking around. There's special treatment for processes with PID=1, which makes it hard to terminate Chromium properly in some cases (e.g. in Docker).

### Azure Pipelines

For Windows or macOS agents, no additional configuration required, just install Playwright and run your tests.

For Linux agents, you can use [our Docker container](./docker.md) with Azure Pipelines support for [running containerized jobs](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops). Alternatively, you can refer to the [Dockerfile](./docker.md) to see additional dependencies that need to be installed on a Ubuntu agent.

```yml
pool:
  vmImage: 'ubuntu-18.04'

container: mcr.microsoft.com/playwright:bionic

steps:
- script: npm install
- script: npm run test
```

### Travis CI

We run our tests on Travis CI over a Linux agent (Ubuntu 18.04).

Suggested configuration
1. [User namespace cloning](http://man7.org/linux/man-pages/man7/user_namespaces.7.html) should be enabled to support proper sandboxing
1. [xvfb](https://en.wikipedia.org/wiki/Xvfb) should be launched in order to run Chromium in non-headless mode (e.g. to test Chrome Extensions)
1. If your project does not have `package-lock.json`, Travis would be auto-caching `node_modules` directory. If you run `npm install` (instead of `npm ci`), it is possible that the browser binaries are not downloaded. Fix this with [these steps](#exception-node_modules-are-cached) outlined below.

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
    # gstreamer and plugins to support video playback in WebKit.
    - gstreamer1.0-gl
    - gstreamer1.0-plugins-base
    - gstreamer1.0-plugins-good
    - gstreamer1.0-plugins-bad
    # This is required to run chromium
    - libgbm1
    # this is needed for running headful tests
    - xvfb

# allow headful tests
before_install:
  # Enable user namespace cloning
  - "sysctl kernel.unprivileged_userns_clone=1"
  # Launch XVFB
  - "export DISPLAY=:99.0"
  - "sh -e /etc/init.d/xvfb start"
```

### CircleCI

We run our tests on CircleCI, with our [pre-built Docker image](./docker.md). Running Playwright smoothly on CircleCI requires the following steps:
1. Use the pre-built [Docker image](./docker.md) in your config like so:

   ```yaml
   docker:
     - image: mcr.microsoft.com/playwright:bionic
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

### Jenkins

Jenkins supports Docker agents for pipelines. Use the [Playwright Docker image](./docker.md) to run tests on Jenkins.

```groovy
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright:bionic' } }
   stages {
      stage('e2e-tests') {
         steps {
            sh 'npm install'
            sh 'npm run test'
         }
      }
   }
}
```

### Bitbucket Pipelines

Bitbucket Pipelines can use public [Docker images as build environments](https://confluence.atlassian.com/bitbucket/use-docker-images-as-build-environments-792298897.html). To run Playwright tests on Bitbucket, use our public Docker image ([see Dockerfile](./docker.md)).

```yml
image: mcr.microsoft.com/playwright:bionic
```

While the Docker image supports sandboxing for Chromium, it does not work in the Bitbucket Pipelines environment. To launch Chromium on Bitbucket Pipelines, use the `chromiumSandbox: false` launch argument.

```js
const { chromium } = require('playwright');
const browser = await chromium.launch({ chromiumSandbox: false });
```

### GitLab CI

To run Playwright tests on GitLab, use our public Docker image ([see Dockerfile](./docker.md)).

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:bionic
  script:
    - npm install # This should install playwright
    - npm run test
```

## Caching browsers

By default, Playwright downloads browser binaries when the Playwright NPM package is installed. The NPM packages have a `postinstall` hook that downloads the browser binaries. This behavior can be [customized with environment variables](./installation.md).

Caching browsers on CI is **strictly optional**: The `postinstall` hooks should execute and download the browser binaries on every run.

#### Exception: `node_modules` are cached

Most CI providers cache the [npm-cache](https://docs.npmjs.com/cli-commands/cache.html) directory (located at `$HOME/.npm`). If your CI pipelines caches the `node_modules` directory and you run `npm install` (instead of `npm ci`), the default configuration

**will not work**. This is because the `npm install` step will find the Playwright NPM package on disk and not execute the `postinstall` step.

> Travis CI automatically caches `node_modules` if your repo does not have a `package-lock.json` file.

This behavior can be fixed with one of the following approaches:
1. Move to caching `$HOME/.npm` or the npm-cache directory. (This is the default behavior in most CI providers.)
1. Set `PLAYWRIGHT_BROWSERS_PATH=0` as the environment variable before running `npm install`. This will download the browser binaries in the `node_modules` directory and cache them with the package code. See [installation docs](./installation.md).
1. Use `npm ci` (instead of `npm install`) which forces a clean install: by removing the existing `node_modules` directory. See [npm docs](https://docs.npmjs.com/cli/ci.html).
1. Cache the browser binaries, with the steps below.

#### Directories to cache

With the default behavior, Playwright downloads the browser binaries in the following directories:
- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

To cache the browser downloads between CI runs, cache this location in your CI configuration, against a hash of the Playwright version.

## Debugging browser launches

Playwright supports the `DEBUG` environment variable to output debug logs during execution. Setting it to `pw:browser*` is helpful while debugging `Error: Failed to launch browser` errors.

```
DEBUG=pw:browser* npm run test
```

## Running headful

By default, Playwright launches browsers in headless mode. This can be changed by passing a flag when the browser is launched.

```js
// Works across chromium, firefox and webkit
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
```

On Linux agents, headful execution requires [Xvfb](https://en.wikipedia.org/wiki/Xvfb) to be installed. Our [Docker image](./docker.md) and GitHub Action have Xvfb pre-installed. To run browsers in headful mode with Xvfb, add `xvfb-run` before the Node.js command.

```
xvfb-run node index.js
```


[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
