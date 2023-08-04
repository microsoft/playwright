---
id: test-sharding
title: "Sharding"
---

By default, Playwright runs tests in [parallel](/test-parallel.md) and strives for optimal utilization of CPU cores on your machine. In order to achieve even greater parallelisation, you can further scale Playwright test execution by running tests on multiple machines simultaneously. We call this mode of operation "sharding".

## Sharding tests between multiple machines

To shard the test suite, pass `--shard=x/y` to the command line. For example, to split the suite into four shards, each running one fourth of the tests:

```bash
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

Now, if you run these shards in parallel on different computers, your test suite completes four times faster.

## Merging reports from multiple shards

In the previous example, each test shard has its own test report. If you want to have a combined report showing all the test results from all the shards, you can merge them.

Start with adding `blob` reporter to the config when running on CI:

```ts title="playwright.config.ts"
export default defineConfig({
  testDir: './tests',
  reporter: process.env.CI ? 'blob' : 'html',
});
```

Blob report contains information about all the tests that were run and their results as well as all test attachments such as traces and screenshot diffs. Blob reports can be merged and converted to any other Playwright report. By default, blob report will be generated into `blob-report` directory.

To merge reports from multiple shards, put the blob report files into a single directory, for example `all-blob-reports`. Blob report names contain shard number, so they will not clash.

Afterwards, run `npx playwright merge-reports` command:

```bash
npx playwright merge-reports --reporter html ./all-blob-reports
```

This will produce a standard HTML report into `playwright-report` directory.

## GitHub Actions example

One of the easiest ways to shard Playwright tests across multiple machines is by using GitHub Actions matrix strategy. For example, you can configure a job to run your tests on four machines in parallel like this:

```yaml title=".github/workflows/playwright.yml"
name: "Playwright Tests"

on:
  push:
    branches:
      - main

jobs:
  playwright-tests:
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright browsers
      run: npx playwright install

    - name: Run Playwright tests
      run: npx playwright test --shard ${{ matrix.shard }}/4

    - name: Upload blob report to GitHub Actions Artifacts
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: all-blob-reports
        path: blob-report
        retention-days: 1
```

After all shards have completed, run a separate job that will merge the reports and produce a combined HTML report.

```yaml title=".github/workflows/playwright.yml"
jobs:
...
  merge-reports:
    # Merge reports after playwright-tests, even if some shards have failed
    if: always()
    needs: [playwright-tests]

    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - name: Install dependencies
      run: npm ci

    - name: Download blob reports from GitHub Actions Artifacts
      uses: actions/download-artifact@v3
      with:
        name: all-blob-reports
        path: all-blob-reports

    - name: Merge into HTML Report
      run: npx playwright merge-reports --reporter html ./all-blob-reports 

    - name: Upload HTML report
      uses: actions/upload-artifact@v3
      with:
        name: html-report--attempt-${{ github.run_attempt }}
        path: playwright-report
        retention-days: 14
```

To ensure the execution order, we make `merge-reports` job [depend](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs) on our sharded `playwright-tests` job.

## Publishing report on the web

In the previous example, the HTML report is uploaded to GitHub Actions Artifacts. This is easy to configure, but downloading HTML report as a zip file is not very convenient.

We can utilize Azure Storage's static websites hosting capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration.

1. Create an [Azure Storage account](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create).
1. Enable [Static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to#enable-static-website-hosting) for the storage account.
1. Add the Azure connection string as a [GitHub Actions secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) called `AZURE_CONNECTION_STRING`.
1. Add a step that uploads HTML report to Azure Storage.

    ```yaml
    ...
        - name: Upload HTML report to Azure
          shell: bash
          run: |
            REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
            az storage blob upload-batch -s playwright-report -d "\$web/$REPORT_DIR" --connection-string "${{ secrets.AZURE_CONNECTION_STRING }}"
    ```

The contents of `$web` storage container can be accessed from a browser by using the [public URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url) of the website.

:::note
This step will not work for pull requests created from a forked repository because such workflow [doesn't have access to the secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow).
:::

## Merge-reports CLI

`npx playwright merge-reports path/to/blob-reports-dir` reads all blob reports from the passed directory and merges them into a single report.

Supported options:
- `--reporter reporter-to-use`

  Which report to produce. Can be multiple reporters separated by comma.

  Example: `npx playwright merge-reports --reporter=html,github ./blob-reports`

- `--config path/to/config/file`

  Takes reporters from Playwright configuration file.

  Example: `npx playwright merge-reports --config=merge.config.ts ./blob-reports`

  ```ts title="merge.config.ts"
  export default {
    reporter: [['html', { open: 'never' }]],
  };
  ```
