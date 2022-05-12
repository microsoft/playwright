---
id: ci
title: "Continuous Integration"
---

Playwright tests can be executed in CI environments. We have created sample
configurations for common CI providers.

<!-- TOC -->

## Introduction

3 steps to get your tests running on CI:

1. **Ensure CI agent can run browsers**: Use [our Docker image](./docker.md)
   in Linux agents or install your dependencies using the [CLI](./cli.md#install-system-dependencies).
1. **Install Playwright**:
   ```bash js
   # Install NPM packages
   npm ci
   # or
   npm install

   # Install Playwright browsers and dependencies
   npx playwright install --with-deps
   ```
   ```bash python
   pip install playwright
   playwright install --with-deps
   ```
   ```bash java
   mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install --with-deps"
   ```
   ```bash csharp
   pwsh bin\Debug\netX\playwright.ps1 install --with-deps
   ```

1. **Run your tests**:
   ```bash js
   npm test
   ```
   ```bash python
   pytest
   ```

## CI configurations

The [Command line tools](./cli.md#install-system-dependencies) can be used to install all operating system dependencies on GitHub Actions.

### GitHub Actions

```yml js
steps:
  - uses: actions/checkout@v2
  - uses: actions/setup-node@v2
    with:
      node-version: '14'
  - name: Install dependencies
    run: npm ci
  - name: Install Playwright
    run: npx playwright install --with-deps
  - name: Run your tests
    run: npm test
  - name: Upload test results
    if: always()
    uses: actions/upload-artifact@v2
    with:
      name: playwright-report
      path: playwright-report
```

```yml python
steps:
  - name: Set up Python
    uses: actions/setup-python@v2
    with:
      python-version: 3.8
  - name: Install dependencies
    run: |
      python -m pip install --upgrade pip
      pip install playwright
      pip install -e .
  - name: Ensure browsers are installed
    run: python -m playwright install --with-deps
  - name: Run your tests
    run: pytest
```

We run [our tests](https://github.com/microsoft/playwright/blob/main/.github/workflows/tests_secondary.yml) on GitHub Actions, across a matrix of 3 platforms (Windows, Linux, macOS) and 3 browsers (Chromium, Firefox, WebKit).

### GitHub Actions on deployment

This will start the tests after a [GitHub Deployment](https://developer.github.com/v3/repos/deployments/) went into the `success` state.
Services like Vercel use this pattern so you can run your end-to-end tests on their deployed environment.

```yml
name: Playwright Tests
on:
  deployment_status:
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '14.x'
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npm run test:e2e
      env:
        # This might depend on your test-runner/language binding
        PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

### Docker

We have a [pre-built Docker image](./docker.md) which can either be used directly, or as a reference to update your existing Docker definitions.

Suggested configuration
1. Using `--ipc=host` is also recommended when using Chromium—without it Chromium can run out of memory
   and crash. Learn more about this option in [Docker docs](https://docs.docker.com/engine/reference/run/#ipc-settings---ipc).
1. Seeing other weird errors when launching Chromium? Try running your container
   with `docker run --cap-add=SYS_ADMIN` when developing locally.
1. Using `--init` Docker flag or [dumb-init](https://github.com/Yelp/dumb-init) is recommended to avoid special
   treatment for processes with PID=1. This is a common reason for zombie processes.

### Azure Pipelines

For Windows or macOS agents, no additional configuration required, just install Playwright and run your tests.

For Linux agents, you can use [our Docker container](./docker.md) with Azure
Pipelines support [running containerized
jobs](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops).
Alternatively, you can use [Command line tools](./cli.md#install-system-dependencies) to install all necessary dependencies.

```yml
pool:
  vmImage: 'ubuntu-20.04'

container: mcr.microsoft.com/playwright:v1.23.0-focal

steps:
...
```

### CircleCI

Running Playwright on CircleCI requires the following steps:

1. Use the pre-built [Docker image](./docker.md) in your config like so:

   ```yml
   docker:
     - image: mcr.microsoft.com/playwright:v1.23.0-focal
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

Jenkins supports Docker agents for pipelines. Use the [Playwright Docker image](./docker.md)
to run tests on Jenkins.

```groovy
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright:v1.23.0-focal' } }
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
image: mcr.microsoft.com/playwright:v1.23.0-focal
```

### GitLab CI

To run Playwright tests on GitLab, use our public Docker image ([see Dockerfile](./docker.md)).

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.23.0-focal
  script:
  ...
```

## Caching browsers

By default, Playwright downloads browser binaries when the Playwright NPM package
is installed. The NPM packages have a `postinstall` hook that downloads the browser
binaries. This behavior can be [customized with environment variables](./browsers.md#managing-browser-binaries).

Caching browsers on CI is **strictly optional**: The `postinstall` hooks should
execute and download the browser binaries on every run.

#### Exception: `node_modules` are cached (Node-specific)

Most CI providers cache the [npm-cache](https://docs.npmjs.com/cli-commands/cache.html)
directory (located at `$HOME/.npm`). If your CI pipelines caches the `node_modules`
directory and you run `npm install` (instead of `npm ci`), the default configuration
**will not work**. This is because the `npm install` step will find the Playwright NPM
package on disk and not execute the `postinstall` step.

> Travis CI automatically caches `node_modules` if your repo does not have a
  `package-lock.json` file.

This behavior can be fixed with one of the following approaches:
1. Move to caching `$HOME/.npm` or the npm-cache directory. (This is the default
   behavior in most CI providers.)
1. Set `PLAYWRIGHT_BROWSERS_PATH=0` as the environment variable before running
   `npm install`. This will download the browser binaries in the `node_modules`
   directory and cache them with the package code. See [managing browser binaries](./browsers.md#managing-browser-binaries).
1. Use `npm ci` (instead of `npm install`) which forces a clean install: by
   removing the existing `node_modules` directory. See [npm docs](https://docs.npmjs.com/cli/ci.html).
1. Cache the browser binaries, with the steps below.

#### Directories to cache

With the default behavior, Playwright downloads the browser binaries in the following
directories:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

To cache the browser downloads between CI runs, cache this location in your CI
configuration, against a hash of the Playwright version.

## Debugging browser launches

Playwright supports the `DEBUG` environment variable to output debug logs during execution. Setting it to `pw:browser*` is helpful while debugging `Error: Failed to launch browser` errors.

```bash js
DEBUG=pw:browser* npm run test
```
```bash python
DEBUG=pw:browser* pytest
```

## Running headed

By default, Playwright launches browsers in headless mode. This can be changed by passing a flag when the browser is launched.

```js
// Works across chromium, firefox and webkit
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
```

```java
// Works across chromium, firefox and webkit
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch(new BrowserType.LaunchOptions().setHeadless(false));
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
         # Works across chromium, firefox and webkit
         browser = await p.chromium.launch(headless=False)

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
   # Works across chromium, firefox and webkit
   browser = p.chromium.launch(headless=False)
```

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
{
    Headless = false
});
```

On Linux agents, headed execution requires [Xvfb](https://en.wikipedia.org/wiki/Xvfb) to be installed. Our [Docker image](./docker.md) and GitHub Action have Xvfb pre-installed. To run browsers in headed mode with Xvfb, add `xvfb-run` before the Node.js command.

```bash js
xvfb-run node index.js
```
```bash python
xvfb-run python test.py
```
