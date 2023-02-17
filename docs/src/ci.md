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
   mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"
   ```
   ```bash csharp
   pwsh bin/Debug/netX/playwright.ps1 install --with-deps
   ```

1. **Run your tests**:
   ```bash js
   npx playwright test
   ```
   ```bash python
   pytest
   ```
   ```bash java
   mvn test
   ```
   ```bash csharp
   dotnet test
   ```

## CI configurations

The [Command line tools](./cli.md#install-system-dependencies) can be used to install all operating system dependencies on GitHub Actions.

### GitHub Actions

```yml js
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v3
    with:
      node-version: '18'
  - name: Install dependencies
    run: npm ci
  - name: Install Playwright
    run: npx playwright install --with-deps
  - name: Run your tests
    run: npx playwright test
  - name: Upload test results
    if: always()
    uses: actions/upload-artifact@v3
    with:
      name: playwright-report
      path: playwright-report
```

```yml python
steps:
  - uses: actions/checkout@v3
  - name: Set up Python
    uses: actions/setup-python@v4
    with:
      python-version: '3.11'
  - name: Install dependencies
    run: |
      python -m pip install --upgrade pip
      pip install -r local-requirements.txt
      pip install -e .
  - name: Ensure browsers are installed
    run: python -m playwright install --with-deps
  - name: Run your tests
    run: pytest
```

```yml java
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-java@v3
    with:
      distribution: 'temurin'
      java-version: '17'
  - name: Build & Install
    run: mvn -B install -D skipTests --no-transfer-progress
  - name: Install Playwright
    run: mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"
  - name: Run tests
    run: mvn test
```

```yml csharp
steps:
  - uses: actions/checkout@v3
  - name: Setup dotnet
    uses: actions/setup-dotnet@v3
    with:
      dotnet-version: 6.0.x
  - run: dotnet build
  - name: Ensure browsers are installed
    run: pwsh bin\Debug\net6.0\playwright.ps1 install --with-deps
  - name: Run your tests
    run: dotnet test
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
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18.x'
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
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

### GitHub Actions (via containers)

GitHub Actions support [running jobs in a container](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container) by using the [`jobs.<job_id>.container`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idcontainer) option.

```yml js
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.32.0-focal
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run your tests
        run: npx playwright test
```

```yml python
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.32.0-focal
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r local-requirements.txt
          pip install -e .
      - name: Ensure browsers are installed
        run: python -m playwright install --with-deps
      - name: Run your tests
        run: pytest
```

```yml java
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.32.0-focal
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Build & Install
        run: mvn -B install -D skipTests --no-transfer-progress
      - name: Install Playwright
        run: mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"
      - name: Run tests
        run: mvn test
```

```yml csharp
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.32.0-focal
    steps:
      - uses: actions/checkout@v3
      - name: Setup dotnet
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: 6.0.x
      - run: dotnet build
      - name: Ensure browsers are installed
        run: pwsh bin\Debug\net6.0\playwright.ps1 install --with-deps
      - name: Run your tests
        run: dotnet test
```

#### Sharding
* langs: js

GitHub Actions supports [sharding tests between multiple jobs](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) using the [`jobs.<job_id>.strategy.matrix`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) option. The `matrix` option will run a separate job for every possible combination of the provided options. In the example below, we have 2 `project` values, 10 `shardIndex` values and 1 `shardTotal` value, resulting in a total of 20 jobs to be run.

```yml js
jobs:
  playwright:
    name: 'Playwright Tests - ${{ matrix.project }} - Shard ${{ matrix.shardIndex }} of ${{ matrix.shardTotal }}'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.32.0-focal
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, webkit]
        shardIndex: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        shardTotal: [10]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run your tests
        run: npx playwright test --project=${{ matrix.project }} --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
```

> Note: The `${{ <expression> }}` is the [expression](https://docs.github.com/en/actions/learn-github-actions/expressions) syntax that allows accessing the current [context](https://docs.github.com/en/actions/learn-github-actions/contexts). In this example, we are using the [`matrix`](https://docs.github.com/en/actions/learn-github-actions/contexts#matrix-context) context to set the job variants.

### Azure Pipelines

For Windows or macOS agents, no additional configuration required, just install Playwright and run your tests.

For Linux agents, you can use [our Docker container](./docker.md) with Azure
Pipelines support [running containerized
jobs](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops).
Alternatively, you can use [Command line tools](./cli.md#install-system-dependencies) to install all necessary dependencies.

For running the Playwright tests use this pipeline task:
```yml
jobs:
    - deployment: Run_E2E_Tests
      pool:
        vmImage: ubuntu-20.04
      container: mcr.microsoft.com/playwright:v1.32.0-focal
      environment: testing
      strategy:
        runOnce:
          deploy:
            steps:
            - checkout: self
            - task: Bash@3
              displayName: 'Run Playwright tests'
              inputs:
                workingDirectory: 'my-e2e-tests'
                targetType: 'inline'
                failOnStderr: true
                env:
                  CI: true
                script: |
                  npm ci
                  npx playwright test
```
This will make the pipeline run fail if any of the playwright tests fails.
If you also want to integrate the test results with Azure DevOps, use the task `PublishTestResults` task like so:
```yml
jobs:
    - deployment: Run_E2E_Tests
      pool:
        vmImage: ubuntu-20.04
      container: mcr.microsoft.com/playwright:v1.32.0-focal
      environment: testing
      strategy:
        runOnce:
          deploy:
            steps:
            - checkout: self
            - task: Bash@3
              displayName: 'Run Playwright tests'
              inputs:
                workingDirectory: 'my-e2e-tests'
                targetType: 'inline'
                failOnStderr: true
                env:
                  CI: true
                script: |
                  npm ci
                  npx playwright test
            - task: PublishTestResults@2
              displayName: 'Publish test results'
              inputs:
                searchFolder: 'my-e2e-tests/test-results'
                testResultsFormat: 'JUnit'
                testResultsFiles: 'e2e-junit-results.xml' 
                mergeTestResults: true
                failTaskOnFailedTests: true
                testRunTitle: 'My End-To-End Tests'
              condition: succeededOrFailed()

```
Note: The JUnit reporter needs to be configured accordingly via
```ts
["junit", { outputFile: "test-results/e2e-junit-results.xml" }]
```
in `playwright.config.ts`.

### CircleCI

Running Playwright on CircleCI is very similar to running on GitHub Actions. In order to specify the pre-built Playwright [Docker image](./docker.md) , simply modify the agent definition with `docker:` in your config like so:

   ```yml
   executors:
      pw-focal-development:
        docker:
          - image: mcr.microsoft.com/playwright:v1.32.0-focal
   ```

Note: When using the docker agent definition, you are specifying the resource class of where playwright runs to the 'medium' tier [here](https://circleci.com/docs/configuration-reference?#docker-execution-environment). The default behavior of Playwright is to set the number of workers to the detected core count (2 in the case of the medium tier). Overriding the number of workers to greater than this number will cause unnecessary timeouts and failures.

Similarly, If you’re using Playwright through Jest, then you may encounter an error spawning child processes:

   ```
   [00:00.0]  jest args: --e2e --spec --max-workers=36
   Error: spawn ENOMEM
      at ChildProcess.spawn (internal/child_process.js:394:11)
   ```

   This is likely caused by Jest autodetecting the number of processes on the entire machine (`36`) rather than the number allowed to your container (`2`). To fix this, set `jest --maxWorkers=2` in your test command.

#### Sharding in CircleCI

Sharding in CircleCI is indexed with 0 which means that you will need to override the default parallelism ENV VARS. The following example demonstrates how to run Playwright with a CircleCI Parallelism of 4 by adding 1 to the `CIRCLE_NODE_INDEX` to pass into the `--shard` cli arg.

  ```yml
    playwright-job-name:
      executor: pw-focal-development
      parallelism: 4
      steps:
        - run: SHARD="$((${CIRCLE_NODE_INDEX}+1))"; npx playwright test -- --shard=${SHARD}/${CIRCLE_NODE_TOTAL}      
  ```

### Jenkins

Jenkins supports Docker agents for pipelines. Use the [Playwright Docker image](./docker.md)
to run tests on Jenkins.

```groovy
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright:v1.32.0-focal' } }
   stages {
      stage('e2e-tests') {
         steps {
            // Depends on your language / test framework
            sh 'npm install'
            sh 'npx playwright test'
         }
      }
   }
}
```

### Bitbucket Pipelines

Bitbucket Pipelines can use public [Docker images as build environments](https://confluence.atlassian.com/bitbucket/use-docker-images-as-build-environments-792298897.html). To run Playwright tests on Bitbucket, use our public Docker image ([see Dockerfile](./docker.md)).

```yml
image: mcr.microsoft.com/playwright:v1.32.0-focal
```

### GitLab CI

To run Playwright tests on GitLab, use our public Docker image ([see Dockerfile](./docker.md)).

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.32.0-focal
  script:
  ...
```

#### Sharding
* langs: js

GitLab CI supports [sharding tests between multiple jobs](https://docs.gitlab.com/ee/ci/jobs/job_control.html#parallelize-large-jobs) using the [parallel](https://docs.gitlab.com/ee/ci/yaml/index.html#parallel) keyword. The test job will be split into multiple smaller jobs that run in parallel. Parallel jobs are named sequentially from `job_name 1/N` to `job_name N/N`.

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.32.0-focal
  parallel: 7
  script:
    - npm ci
    - npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

GitLab CI also supports sharding tests between multiple jobs using the [parallel:matrix](https://docs.gitlab.com/ee/ci/yaml/index.html#parallelmatrix) option. The test job will run multiple times in parallel in a single pipeline, but with different variable values for each instance of the job. In the example below, we have 2 `PROJECT` values, 10 `SHARD_INDEX` values and 1 `SHARD_TOTAL` value, resulting in a total of 20 jobs to be run.

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.32.0-focal
  parallel:
    matrix:
      - PROJECT: ['chromium', 'webkit']
        SHARD_INDEX: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        SHARD_TOTAL: 10
  script:
    - npm ci
    - npx playwright test --project=$PROJECT --shard=$SHARD_INDEX/$SHARD_TOTAL
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
DEBUG=pw:browser* npx playwright test
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
await playwright.Chromium.LaunchAsync(new()
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
