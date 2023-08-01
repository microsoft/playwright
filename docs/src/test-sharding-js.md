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

### GitHub Actions sharding example

One of the easiest ways to shard Playwright tests across multiple machines is by using GitHub Actions matrix strategy. For example, you can configure a job to run your tests on four machines in parallel like this:

```yaml
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

    - name: Upload HTML report
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: html-report-${{ matrix.shard }}
        path: playwright-report
```

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

To merge reports from multiple shards, put the blob report files into a single directory, for example `blob-reports`, and run `merge-reports` tool:

```bash
npx playwright merge-reports ./blob-reports --reporter html
```

This will produce a standard `html` report into `playwright-report` directory.

### GitHub Actions merge example

Individual reports from each shard need to be copied into a shared location. GitHub Actions Artifacts is a convenient mechanism that lets you do that. Note that you don't need to upload individual HTML reports anymore, but only upload the blob report.

```yaml
jobs:
  playwright-tests:
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
...
    - name: Upload blob report to Artifacts
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: blob-report-${{ github.run_attempt }}
        path: blob-report
        retention-days: 2
```

After all shards have completed, run a separate job that will merge the reports and produce a combined HTML report.

```yaml
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

    - name: Download Blob Reports from Artifacts
      uses: actions/download-artifact@v3
      with:
        name: blob-report-${{ github.run_attempt }}
        path: all-blob-reports

    - name: Merge into HTML Report
      run: npx playwright merge-reports ./all-blob-reports --reporter html

    - name: Upload HTML report
      uses: actions/upload-artifact@v3
      with:
        name: html-report-${{ github.run_attempt }}
        path: playwright-report
```

To ensure the execution order, we make `merge-reports` job [depend](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs) on our sharded `playwright-tests` job.

## Serving final HTML report

After individual shard reports have been merged into a single HTML report, we should make it available.

### GitHub Actions Artifacts

In this example we upload the HTML report as GitHub Actions Artifact. This is easy to configure, but downloading HTML report as a zip file is not very convenient.

```yaml
...
    - name: Upload HTML report
      uses: actions/upload-artifact@v3
      with:
        name: html-report-${{ github.run_attempt }}
        path: playwright-report
```

### Azure Blob Storage

We can utilize Azure Storage's [Static websites hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website) capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration. You can simply add a step that uploads HTML report to Azure:

```yaml
...
    - name: Upload HTML report to Azure
      shell: bash
      run: |
        REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
        az storage blob upload-batch -s playwright-report -d "\$web/$REPORT_DIR" --connection-string "${{ secrets.AZURE_CONNECTION_STRING }}"
```

The code above assumes that you have the Azure connection string stored in GitHub [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) called `AZURE_CONNECTION_STRING`.

Afrer you enable [static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website#setting-up-a-static-website) for your storage account, the contents of `$web` can be accessed from a browser by using the public URL of the website ([how to find the website URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url)).

:::note
Note that this step will not work for pull requests created from a forked repository because such workflow [does't have access to the secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow).
:::

## Other CI and storage systems

At the high level, running multiple shards and generating a single combined report requires:

1. Configure Playwright to produce `blob` report on every running shard.
1. Copy all blob reports into a single local directory.
1. Run `npx playwright merge-reports path/to/all-blob-reports-dir --reporter html` to generate HTML (or any other) report.
1. Upload generated report to the storage of your choice.

Similarly to the GitHub Actions steps above, you can integrate these steps into your CI.

## Merge-reports utility

`npx playwright merge-reports path/to/blob-reports-dir` reads all `.zip` files from the passed directory and treats them as blob reports to be merged into a single report.

Supported options:
- `--reporter reporter-to-use`

  Which report to produce. Can be multiple reporters separate by comma.

  Example: `npx playwright merge-reports ./blob-reports --reporter=html,github`.

- `--config path/to/config/file`

  Take reporters from Playwright configuration file.

  Example: `npx playwright merge-reports ./blob-reports --config=merge.config.ts`.

  ```ts title="merge.config.ts"
  export default {
    reporter: [['html']],
  };
  ```
