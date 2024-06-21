---
id: test-sharding
title: "Sharding"
---

## Introduction

By default, Playwright runs test files in [parallel](./test-parallel.md) and strives for optimal utilization of CPU cores on your machine. In order to achieve even greater parallelisation, you can further scale Playwright test execution by running tests on multiple machines simultaneously. We call this mode of operation "sharding". Sharding in Playwright means splitting your tests into smaller parts called "shards". Each shard is like a separate job that can run independently. The whole purpose is to divide your tests to speed up test runtime.

When you shard your tests, each shard can run on its own, utilizing the available CPU cores. This helps speed up the testing process by doing tasks simultaneously.

In a CI pipeline, each shard can run as a separate job, making use of the hardware resources available in your CI pipeline, like CPU cores, to run tests faster.

## Sharding tests between multiple machines

To shard the test suite, pass `--shard=x/y` to the command line. For example, to split the suite into four shards, each running one fourth of the tests:

```bash
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4
```

Now, if you run these shards in parallel on different jobs, your test suite completes four times faster.

Note that Playwright can only shard tests that can be run in parallel. By default, this means Playwright will shard test files. Learn about other options in the [parallelism guide](./test-parallel.md).

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

GitHub Actions supports [sharding tests between multiple jobs](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs) using the [`jobs.<job_id>.strategy.matrix`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) option. The `matrix` option will run a separate job for every possible combination of the provided options.

The following example shows you how to configure a job to run your tests on four machines in parallel and then merge the reports into a single report. Don't forget to add `reporter: process.env.CI ? 'blob' : 'html',` to your `playwright.config.ts` file as in the example above.

1. First we add a `matrix` option to our job configuration with the `shardTotal: [4]` option containing the total number of shards we want to create and `shardIndex: [1, 2, 3, 4]` with an array of the shard numbers.

1. Then we run our Playwright tests with the `--shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}` option. This will run our test command for each shard.

1. Finally we upload our blob report to the GitHub Actions Artifacts. This will make the blob report available to other jobs in the workflow.



```yaml title=".github/workflows/playwright.yml"
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  playwright-tests:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright browsers
      run: npx playwright install --with-deps

    - name: Run Playwright tests
      run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}

    - name: Upload blob report to GitHub Actions Artifacts
      if: ${{ !cancelled() }}
      uses: actions/upload-artifact@v4
      with:
        name: blob-report-${{ matrix.shardIndex }}
        path: blob-report
        retention-days: 1
```

1. After all shards have completed, you can run a separate job that will merge the reports and produce a combined [HTML report](./test-reporters.md#html-reporter). To ensure the execution order, we make the `merge-reports` job [depend](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs) on our sharded `playwright-tests` job by adding `needs: [playwright-tests]`.

```yaml title=".github/workflows/playwright.yml"
jobs:
...
  merge-reports:
    # Merge reports after playwright-tests, even if some shards have failed
    if: ${{ !cancelled() }}
    needs: [playwright-tests]

    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci

    - name: Download blob reports from GitHub Actions Artifacts
      uses: actions/download-artifact@v4
      with:
        path: all-blob-reports
        pattern: blob-report-*
        merge-multiple: true

    - name: Merge into HTML Report
      run: npx playwright merge-reports --reporter html ./all-blob-reports

    - name: Upload HTML report
      uses: actions/upload-artifact@v4
      with:
        name: html-report--attempt-${{ github.run_attempt }}
        path: playwright-report
        retention-days: 14
```

You can now see the reports have been merged and a combined HTML report is available in the GitHub Actions Artifacts tab.

<img width="875" alt="image" src="https://github.com/microsoft/playwright/assets/9798949/b69dac59-fc19-4b98-8f49-814b1c29ca02" />


## Merge-reports CLI

`npx playwright merge-reports path/to/blob-reports-dir` reads all blob reports from the passed directory and merges them into a single report.

When merging reports from different OS'es you'll have to provide an explicit merge config to disambiguate which directory should be used as tests root.

Supported options:
- `--reporter reporter-to-use`

  Which report to produce. Can be multiple reporters separated by comma.

  Example:

  ```bash
  npx playwright merge-reports --reporter=html,github ./blob-reports
  ```

- `--config path/to/config/file`

  Specifies the Playwright configuration file with output reporters. Use this option to pass
  additional configuration to the output reporter. This configuration file can differ from
  the one used during the creation of blob reports.

  Example:

  ```bash
  npx playwright merge-reports --config=merge.config.ts ./blob-reports
  ```

  ```ts title="merge.config.ts"
  export default {
    testDir: 'e2e',
    reporter: [['html', { open: 'never' }]],
  };
  ```
