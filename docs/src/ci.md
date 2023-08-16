---
id: ci
title: "Continuous Integration"
---

Playwright tests can be executed in CI environments. We have created sample
configurations for common CI providers.

## Introduction

3 steps to get your tests running on CI:

1. **Ensure CI agent can run browsers**: Use [our Docker image](./docker.md)
   in Linux agents or install your dependencies using the [CLI](./browsers#install-system-dependencies).
1. **Install Playwright**:
   ```bash js
   # Install NPM packages
   npm ci

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
   dotnet build
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

## Workers
* langs: js

We recommend setting [workers](./api/class-testconfig.md#test-config-workers) to "1" in CI environments to prioritize stability and reproducibility. Running tests sequentially ensures each test gets the full system resources, avoiding potential conflicts. However, if you have a powerful self-hosted CI system, you may enable [parallel](./test-parallel.md) tests. For wider parallelization, consider [sharding](./test-parallel.md#shard-tests-between-multiple-machines) - distributing tests across multiple CI jobs.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,
});
```


## CI configurations

The [Command line tools](./browsers#install-system-dependencies) can be used to install all operating system dependencies on GitHub Actions.

### GitHub Actions

#### On push/pull_request

```yml js
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
    - uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

```yml python
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    - name: Ensure browsers are installed
      run: python -m playwright install --with-deps
    - name: Run your tests
      run: pytest
```

```yml java
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
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
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup dotnet
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: 6.0.x
    - run: dotnet build
    - name: Ensure browsers are installed
      run: pwsh bin/Debug/net6.0/playwright.ps1 install --with-deps
    - name: Run your tests
      run: dotnet test
```

#### On push/pull_request (sharded)
* langs: js

GitHub Actions supports [sharding tests between multiple jobs](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) using the [`jobs.<job_id>.strategy.matrix`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) option. The `matrix` option will run a separate job for every possible combination of the provided options. In the example below, we have 2 `project` values, 10 `shardIndex` values and 1 `shardTotal` value, resulting in a total of 20 jobs to be run. So it will split up the tests between 20 jobs, each running a different browser and a different subset of tests, see [here](./test-parallel.md#shard-tests-between-multiple-machines) for more details.

```yml js
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests - ${{ matrix.project }} - Shard ${{ matrix.shard }}'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, webkit]
        shard: [1/10, 2/10, 3/10, 4/10, 5/10, 6/10, 7/10, 8/10, 9/10, 10/10]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Install browsers
        run: npx playwright install --with-deps
      - name: Run your tests
        run: npx playwright test --project=${{ matrix.project }} --shard=${{ matrix.shard }}
```

> Note: The `${{ <expression> }}` is the [expression](https://docs.github.com/en/actions/learn-github-actions/expressions) syntax that allows accessing the current [context](https://docs.github.com/en/actions/learn-github-actions/contexts). In this example, we are using the [`matrix`](https://docs.github.com/en/actions/learn-github-actions/contexts#matrix-context) context to set the job variants.

#### Via Containers

GitHub Actions support [running jobs in a container](https://docs.github.com/en/actions/using-jobs/running-jobs-in-a-container) by using the [`jobs.<job_id>.container`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idcontainer) option. This is useful to not pollute the host environment with dependencies and to have a consistent environment for e.g. screenshots/visual regression testing across different operating systems.

```yml js
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Run your tests
        run: npx playwright test
```

```yml python
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy
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
      - name: Run your tests
        run: pytest
```

```yml java
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Build & Install
        run: mvn -B install -D skipTests --no-transfer-progress
      - name: Run tests
        run: mvn test
```

```yml csharp
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy
    steps:
      - uses: actions/checkout@v3
      - name: Setup dotnet
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: 6.0.x
      - run: dotnet build
      - name: Run your tests
        run: dotnet test
```

#### Via Containers (sharded)
* langs: js

GitHub Actions supports [sharding tests between multiple jobs](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) using the [`jobs.<job_id>.strategy.matrix`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) option. The `matrix` option will run a separate job for every possible combination of the provided options. In the example below, we have 2 `project` values, 10 `shardIndex` values and 1 `shardTotal` value, resulting in a total of 20 jobs to be run. So it will split up the tests between 20 jobs, each running a different browser and a different subset of tests, see [here](./test-parallel.md#shard-tests-between-multiple-machines) for more details.

```yml js
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright:
    name: 'Playwright Tests - ${{ matrix.project }} - Shard ${{ matrix.shard }}'
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, webkit]
        shard: [1/10, 2/10, 3/10, 4/10, 5/10, 6/10, 7/10, 8/10, 9/10, 10/10]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Run your tests
        run: npx playwright test --project=${{ matrix.project }} --shard=${{ matrix.shard }}
```

#### On deployment

This will start the tests after a [GitHub Deployment](https://developer.github.com/v3/repos/deployments/) went into the `success` state.
Services like Vercel use this pattern so you can run your end-to-end tests on their deployed environment.

```yml js
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
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
      env:
        PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

```yml python
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
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    - name: Ensure browsers are installed
      run: python -m playwright install --with-deps
    - name: Run tests
      run: pytest
      env:
        # This might depend on your test-runner
        PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

```yml java
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
      env:
        # This might depend on your test-runner
        PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

```yml csharp
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
    - name: Setup dotnet
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: 6.0.x
    - run: dotnet build
    - name: Ensure browsers are installed
      run: pwsh bin/Debug/net6.0/playwright.ps1 install --with-deps
    - name: Run tests
      run: dotnet test
      env:
        # This might depend on your test-runner
        PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}
```

### Docker

We have a [pre-built Docker image](./docker.md) which can either be used directly, or as a reference to update your existing Docker definitions.

Suggested configuration
1. Using `--ipc=host` is also recommended when using Chromium. Without it Chromium can run out of memory
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
Alternatively, you can use [Command line tools](./browsers#install-system-dependencies) to install all necessary dependencies.

For running the Playwright tests use this pipeline task:

```yml js
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18'
  displayName: 'Install Node.js'
- script: npm ci
  displayName: 'npm ci'
- script: npx playwright install --with-deps
  displayName: 'Install Playwright browsers'
- script: npx playwright test
  displayName: 'Run Playwright tests'
  env:
    CI: 'true'
```

```yml python
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.11'
  displayName: 'Use Python'
- script: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
  displayName: 'Install dependencies'
- script: playwright install --with-deps
  displayName: 'Install Playwright browsers'
- script: pytest
  displayName: 'Run Playwright tests'
```

```yml java
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: JavaToolInstaller@0
  inputs:
    versionSpec: '17'
    jdkArchitectureOption: 'x64'
    jdkSourceOption: AzureStorage
- script: mvn -B install -D skipTests --no-transfer-progress
  displayName: 'Build and install'
- script: mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"
  displayName: 'Install Playwright browsers'
- script: mvn test
  displayName: 'Run tests'
```

```yml csharp
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: UseDotNet@2
  inputs:
    packageType: sdk
    version: '6.0.x'
  displayName: 'Use .NET SDK'
- script: dotnet build --configuration Release
  displayName: 'Build'
- script: pwsh bin/Release/net6.0/playwright.ps1 install --with-deps
  displayName: 'Install Playwright browsers'
- script: dotnet test --configuration Release
  displayName: 'Run tests'
```

#### Uploading playwright-report folder with Azure Pipelines
* langs: js

This will make the pipeline run fail if any of the playwright tests fails.
If you also want to integrate the test results with Azure DevOps, use the task `PublishTestResults` task like so:

```yml
trigger:
- main

pool:
  vmImage: ubuntu-latest

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18'
  displayName: 'Install Node.js'

- script: npm ci
  displayName: 'npm ci'
- script: npx playwright install --with-deps
  displayName: 'Install Playwright browsers'
- script: npx playwright test
  displayName: 'Run Playwright tests'
  env:
    CI: 'true'
- task: PublishTestResults@2
  displayName: 'Publish test results'
  inputs:
    searchFolder: 'test-results'
    testResultsFormat: 'JUnit'
    testResultsFiles: 'e2e-junit-results.xml'
    mergeTestResults: true
    failTaskOnFailedTests: true
    testRunTitle: 'My End-To-End Tests'
  condition: succeededOrFailed()
- task: PublishPipelineArtifact@1
  inputs:
    targetPath: playwright-report
    artifact: playwright-report
    publishLocation: 'pipeline'
  condition: succeededOrFailed()

```
Note: The JUnit reporter needs to be configured accordingly via
```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: ['junit', { outputFile: 'test-results/e2e-junit-results.xml' }],
});
```
in `playwright.config.ts`.

#### Azure Pipelines (sharded)
* langs: js

```yaml
trigger:
- main

pool:
  vmImage: ubuntu-latest

strategy:
  matrix:
    chromium-1:
      project: chromium
      shard: 1/3
    chromium-2:
      project: chromium
      shard: 2/3
    chromium-3:
      project: chromium
      shard: 3/3
    firefox-1:
      project: firefox
      shard: 1/3
    firefox-2:
      project: firefox
      shard: 2/3
    firefox-3:
      project: firefox
      shard: 3/3
    webkit-1:
      project: webkit
      shard: 1/3
    webkit-2:
      project: webkit
      shard: 2/3
    webkit-3:
      project: webkit
      shard: 3/3
steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18'
  displayName: 'Install Node.js'

- script: npm ci
  displayName: 'npm ci'
- script: npx playwright install --with-deps
  displayName: 'Install Playwright browsers'
- script: npx playwright test --project=$(project) --shard=$(shard)
  displayName: 'Run Playwright tests'
  env:
    CI: 'true'
```


#### Azure Pipelines (containerized)

```yml js
trigger:
- main

pool:
  vmImage: ubuntu-latest
container: mcr.microsoft.com/playwright:v%%VERSION%%-jammy

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18'
  displayName: 'Install Node.js'

- script: npm ci
  displayName: 'npm ci'
- script: npx playwright test
  displayName: 'Run Playwright tests'
  env:
    CI: 'true'
```

```yml python
trigger:
- main

pool:
  vmImage: ubuntu-latest
container: mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.11'
  displayName: 'Use Python'

- script: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
  displayName: 'Install dependencies'
- script: pytest
  displayName: 'Run tests'
```

```yml java
trigger:
- main

pool:
  vmImage: ubuntu-latest
container: mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy

steps:
- task: JavaToolInstaller@0
  inputs:
    versionSpec: '17'
    jdkArchitectureOption: 'x64'
    jdkSourceOption: AzureStorage

- script: mvn -B install -D skipTests --no-transfer-progress
  displayName: 'Build and install'
- script: mvn test
  displayName: 'Run tests'
```

```yml csharp
trigger:
- main

pool:
  vmImage: ubuntu-latest
container: mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy

steps:
- task: UseDotNet@2
  inputs:
    packageType: sdk
    version: '6.0.x'
  displayName: 'Use .NET SDK'

- script: dotnet build --configuration Release
  displayName: 'Build'
- script: dotnet test --configuration Release
  displayName: 'Run tests'
```

### CircleCI

Running Playwright on CircleCI is very similar to running on GitHub Actions. In order to specify the pre-built Playwright [Docker image](./docker.md), simply modify the agent definition with `docker:` in your config like so:

```yml js
executors:
  pw-jammy-development:
    docker:
      - image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
```

```yml python
executors:
  pw-jammy-development:
    docker:
      - image: mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy
```

```yml java
executors:
  pw-jammy-development:
    docker:
      - image: mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy
```

```yml csharp
executors:
  pw-jammy-development:
    docker:
      - image: mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy
```

Note: When using the docker agent definition, you are specifying the resource class of where playwright runs to the 'medium' tier [here](https://circleci.com/docs/configuration-reference?#docker-execution-environment). The default behavior of Playwright is to set the number of workers to the detected core count (2 in the case of the medium tier). Overriding the number of workers to greater than this number will cause unnecessary timeouts and failures.

#### Sharding in CircleCI
* langs: js

Sharding in CircleCI is indexed with 0 which means that you will need to override the default parallelism ENV VARS. The following example demonstrates how to run Playwright with a CircleCI Parallelism of 4 by adding 1 to the `CIRCLE_NODE_INDEX` to pass into the `--shard` cli arg.

  ```yml
    playwright-job-name:
      executor: pw-jammy-development
      parallelism: 4
      steps:
        - run: SHARD="$((${CIRCLE_NODE_INDEX}+1))"; npx playwright test -- --shard=${SHARD}/${CIRCLE_NODE_TOTAL}
  ```

### Jenkins

Jenkins supports Docker agents for pipelines. Use the [Playwright Docker image](./docker.md)
to run tests on Jenkins.

```groovy js
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright:v%%VERSION%%-jammy' } }
   stages {
      stage('e2e-tests') {
         steps {
            sh 'ci'
            sh 'npx playwright test'
         }
      }
   }
}
```

```groovy python
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy' } }
   stages {
      stage('e2e-tests') {
         steps {
            sh 'pip install -r requirements.txt'
            sh 'pytest'
         }
      }
   }
}
```

```groovy java
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy' } }
   stages {
      stage('e2e-tests') {
         steps {
            sh 'mvn -B install -D skipTests --no-transfer-progress'
            sh 'mvn test'
         }
      }
   }
}
```

```groovy csharp
pipeline {
   agent { docker { image 'mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy' } }
   stages {
      stage('e2e-tests') {
         steps {
            sh 'dotnet build'
            sh 'dotnet test'
         }
      }
   }
}
```

### Bitbucket Pipelines

Bitbucket Pipelines can use public [Docker images as build environments](https://confluence.atlassian.com/bitbucket/use-docker-images-as-build-environments-792298897.html). To run Playwright tests on Bitbucket, use our public Docker image ([see Dockerfile](./docker.md)).

```yml js
image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
```

```yml python
image: mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy
```

```yml java
image: mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy
```

```yml csharp
image: mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy
```

### GitLab CI

To run Playwright tests on GitLab, use our public Docker image ([see Dockerfile](./docker.md)).

```yml js
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
  script:
  ...
```

```yml python
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright/python:v%%VERSION%%-jammy
  script:
  ...
```

```yml java
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright/java:v%%VERSION%%-jammy
  script:
  ...
```

```yml dotnet
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright/dotnet:v%%VERSION%%-jammy
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
  image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
  parallel: 7
  script:
    - npm ci
    - npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

GitLab CI also supports sharding tests between multiple jobs using the [parallel:matrix](https://docs.gitlab.com/ee/ci/yaml/index.html#parallelmatrix) option. The test job will run multiple times in parallel in a single pipeline, but with different variable values for each instance of the job. In the example below, we have 2 `PROJECT` values and 10 `SHARD` values, resulting in a total of 20 jobs to be run.

```yml
stages:
  - test

tests:
  stage: test
  image: mcr.microsoft.com/playwright:v%%VERSION%%-jammy
  parallel:
    matrix:
      - PROJECT: ['chromium', 'webkit']
        SHARD: ['1/10', '2/10', '3/10', '4/10', '5/10', '6/10', '7/10', '8/10', '9/10', '10/10']
  script:
    - npm ci
    - npx playwright test --project=$PROJECT --shard=$SHARD
```

## Caching browsers

Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries. Especially under Linux, [operating system dependencies](./browsers.md#install-system-dependencies) need to be installed, which are not cacheable.

If you still want to cache the browser binaries between CI runs, cache [these directories](./browsers.md#managing-browser-binaries) in your CI configuration, against a hash of the Playwright version.

## Debugging browser launches

Playwright supports the `DEBUG` environment variable to output debug logs during execution. Setting it to `pw:browser` is helpful while debugging `Error: Failed to launch browser` errors.

```bash js
DEBUG=pw:browser npx playwright test
```
```bash python
DEBUG=pw:browser pytest
```

```bash java
DEBUG=pw:browser mvn test
```

```bash csharp
DEBUG=pw:browser dotnet test
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
```bash java
xvfb-run mvn test
```
```bash csharp
xvfb-run dotnet test
```
