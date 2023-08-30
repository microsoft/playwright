---
id: ci-intro
title: "CI GitHub Actions"
---

## Introduction
* langs: js

Playwright tests can be executed on CI using GitHub actions. When installing Playwright you are given the option to add a [GitHub Actions](https://docs.github.com/en/actions). This creates a `playwright.yml` file inside a `.github/workflows` folder containing everything you need so that your tests run on each push and pull request into the main/master branch.+

#### You will learn
* langs: js

- [How to run tests on push/pull_request](/ci-intro.md#on-pushpull_request)
- [How to view test logs](/ci-intro.md#viewing-test-logs)
- [How to view the HTML report](/ci-intro.md#viewing-the-html-report)
- [How to view the trace](/ci-intro.md#viewing-the-trace)
- [How to publish report on the web](/ci-intro.md#publishing-report-on-the-web)


## Introduction
* langs: python, java, csharp

Playwright tests can be executed on CI using GitHub Actions. To add a [GitHub Actions](https://docs.github.com/en/actions) file first create `.github/workflows` folder and inside it add a `playwright.yml` file containing the example code below so that your tests will run on each push and pull request for the main/master branch.

#### You will learn
* langs: python, java, csharp
  
- [How to run tests on push/pull_request](/ci.md#on-pushpull_request)
- [How to view test logs](/ci-intro.md#viewing-test-logs)
- [How to view the trace](/ci-intro.md#viewing-the-trace)



## Setting up GitHub Actions

### On push/pull_request
* langs: js

Tests will run on push or pull request on branches main/master. The [workflow](https://docs.github.com/en/actions/using-workflows/about-workflows) will install all dependencies, install Playwright and then run the tests. It will also create the HTML report.

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

### On push/pull_request
* langs: python, java, csharp

Tests will run on push or pull request on branches main/master. The [workflow](https://docs.github.com/en/actions/using-workflows/about-workflows) will install all dependencies, install Playwright and then run the tests.

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

### On push/pull_request (sharded)
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

### Via Containers

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

### Via Containers (sharded)
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

### On deployment

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


## Create a Repo and Push to GitHub

[Create a repo on GitHub](https://docs.github.com/en/get-started/quickstart/create-a-repo) and create a new repository or push an existing repository. Follow the instructions on GitHub and don't forget to [initialize a git repository](https://github.com/git-guides/git-init) using the `git init` command so you can [add](https://github.com/git-guides/git-add), [commit](https://github.com/git-guides/git-commit) and [push](https://github.com/git-guides/git-push) your code.

<img width="861" alt="Create a Repo and Push to GitHub" src="https://user-images.githubusercontent.com/13063165/183423254-d2735278-a2ab-4d63-bb99-48d8e5e447bc.png"/>

## Opening the Workflows

Click on the **Actions** tab to see the workflows. Here you will see if your tests have passed or failed.

<img width="847" alt="Opening the Workflows" src="https://user-images.githubusercontent.com/13063165/183423584-2ea18038-cd49-4daa-a20c-2205352f0933.png"/>

On Pull Requests you can also click on the **Details** link in the [PR status check](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks).

<img width="645" alt="pr status checked" src="https://user-images.githubusercontent.com/13063165/183722462-17a985db-0e10-4205-b16c-8aaac36117b9.png" />

## Viewing Test Logs

Clicking on the workflow run will show you the all the actions that GitHub performed and clicking on **Run Playwright tests** will show the error messages, what was expected and what was received as well as the call log.

<img width="839" alt="Viewing Test Logs" src="https://user-images.githubusercontent.com/13063165/183423783-58bf2008-514e-4f96-9c12-c9a55703960c.png"/>


## HTML Report
* langs: js

The HTML Report shows you a full report of your tests. You can filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests.

### Downloading the HTML Report
* langs: js

In the Artifacts section click on the **playwright-report** to download your report in the format of a zip file.

<img width="972" alt="Downloading the HTML Report" src="https://user-images.githubusercontent.com/13063165/183437023-524f1803-84e4-4862-9ce3-1d55af0e023e.png" />

### Viewing the HTML Report
* langs: js

Locally opening the report will not work as expected as you need a web server in order for everything to work correctly. First, extract the zip, preferably in a folder that already has Playwright installed. Using the command line change into the directory where the report is and use `npx playwright show-report` followed by the name of the extracted folder. This will serve up the report and enable you to view it in your browser.


```bash
npx playwright show-report name-of-my-extracted-playwright-report
```

<img width="1404" alt="Playwright HTML Report" src="https://user-images.githubusercontent.com/13063165/212745273-c19487d2-bc5e-483f-9f67-f9c9e5413ff4.png" />

To learn more about reports check out our detailed guide on [HTML Reporter](/test-reporters.md#html-reporter)

### Viewing the Trace
* langs: js

Once you have served the report using `npx playwright show-report`, click on the trace icon next to the test's file name as seen in the image above. You can then view the trace of your tests and inspect each action to try to find out why the tests are failing.

<img width="1976" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/13063165/212869694-61368b16-f176-4083-bbc2-fc85b95131f0.png" />

### Viewing the Trace
* langs: python, java, csharp

[trace.playwright.dev](https://trace.playwright.dev) is a statically hosted variant of the Trace Viewer. You can upload trace files using drag and drop.

<img width="1119" alt="Drop Playwright Trace to load" src="https://user-images.githubusercontent.com/13063165/194577918-b4d45726-2692-4093-8a28-9e73552617ef.png" />

## Publishing report on the web
* langs: js

Downloading the HTML report as a zip file is not very convenient. However, we can utilize Azure Storage's static websites hosting capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration.

1. Create an [Azure Storage account](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create).
1. Enable [Static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to#enable-static-website-hosting) for the storage account.
1. Create a Service Principal in Azure and grant it access to Azure Blob storage. Upon successful execution, the command will display the credentials which will be used in the next step.

    ```bash
    az ad sp create-for-rbac --name "github-actions" --role "Storage Blob Data Contributor" --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP_NAME>/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT_NAME>
    ```
1. Use the credentials from the previous step to set up encrypted secrets in your GitHub repository. Go to your repository's settings, under [GitHub Actions secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository), and add the following secrets:

    - `AZCOPY_SPA_APPLICATION_ID`
    - `AZCOPY_SPA_CLIENT_SECRET`
    - `AZCOPY_TENANT_ID`

   For a detailed guide on how to authorize a service principal using a client secret, refer to [this Microsoft documentation](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-authorize-azure-active-directory#authorize-a-service-principal-by-using-a-client-secret-1).
1. Add a step that uploads HTML report to Azure Storage.

    ```yaml
    ...
        - name: Upload HTML report to Azure
          shell: bash
          run: |
            REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
            azcopy cp --recursive "./playwright-report/*" "https://<STORAGE_ACCOUNT_NAME>.blob.core.windows.net/\$web/$REPORT_DIR"
            echo "::notice title=HTML report url::https://<STORAGE_ACCOUNT_NAME>.z1.web.core.windows.net/$REPORT_DIR/index.html"
          env:
            AZCOPY_AUTO_LOGIN_TYPE: SPN
            AZCOPY_SPA_APPLICATION_ID: '${{ secrets.AZCOPY_SPA_APPLICATION_ID }}'
            AZCOPY_SPA_CLIENT_SECRET: '${{ secrets.AZCOPY_SPA_CLIENT_SECRET }}'
            AZCOPY_TENANT_ID: '${{ secrets.AZCOPY_TENANT_ID }}'
    ```

The contents of `$web` storage container can be accessed from a browser by using the [public URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url) of the website.

:::note
This step will not work for pull requests created from a forked repository because such workflow [doesn't have access to the secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow).
:::

######
* langs: js python, java, csharp
  
To learn more about traces check out our detailed guide on [Trace Viewer](/trace-viewer.md).

To learn more about running tests on other CI providers check out our detailed guide on [Continuous Integration](/ci.md).

## What's Next

- [Learn how to use Locators](./locators.md)
- [Learn how to perform Actions](./input.md)
- [Learn how to write Assertions](./test-assertions.md)
