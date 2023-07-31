---
id: test-sharding
title: "Running tests on multiple machines"
---

Playwright Test runs tests in [parallel](/test-parallel.md) and strives for optimal utilization of all accessible CPU cores on your machine. As the number of tests in your suite grows, you can improve execution speed by running them on several machines simultaneously.

## Sharding tests between multiple machines

Playwright Test can shard a test suite, so that it can be executed on multiple machines. For that, pass `--shard=x/y` to the command line. For example, to split the suite into three shards, each running one third of the tests:

npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3

Now, if you run these shards in parallel on different computers, your test suite completes three times faster.

### GitHub Actions sharding example

One of the easiest ways to shard Playwright tests across multiple machines is by using GitHub Actions matrix strategy. For example, you can configure a job to run your tests on 4 machines in parallel like this:

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright browsers
      run: npx playwright install

    - name: Run Playwright tests
      run: npx playwright test --shard ${{ matrix.shard }}
```

## Creating combined report in GitHub Actions

In the previous example, each test shard will have its own test report. If you want to have a combined report showing all tests results from all shards, you need to add a separate job that will merge individual shard reports.

### Configuring shard reporting

We start by adding `blob` reporter to the config:

```js
export default defineConfig({
  testDir: './tests',
  reporter: [['blob', { outputDir: 'blob-report' }]],
});
```

Blob report contains information about all the tests that were run and their results as well as all test attachments such as traces and screenshot diffs. Blob reports can be merged and converted to any other Playwright report.

### Uploading shard report

To merge individual reports they need to be copied into a shared location. GitHub Actions Artifacts is a convenient mechanism that lets you do that. By adding the following step after the test execution we upload blob report from each shard into GitHub Actions Artifact with name`blob-report-${{ github.run_attempt }}` (this is essentially a shared directory where each shard will copy its report to):

```yaml
jobs:
  test:
...
    - name: Upload blob report to Artifacts
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: blob-report-${{ github.run_attempt }}
        path: blob-report
        retention-days: 2
```

### Merge reports job

After all shards finished running it's time to run a job that will merge the reports and produce a combined HTML report. To ensure the execution order, we make `merge-report` job [depend](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs) on our sharded `test` job. `merge-report` job below reads all blob reports from `blob-report-${{ github.run_attempt }}` artifact and produces a single HTML report.

```yaml
jobs:
  merge-report:
    if: always()
    needs: [test]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci

    - name: Download Blob Reports from Artifacts
      uses: actions/download-artifact@v3
      with:
        name: blob-report-${{ github.run_attempt }}
        path: blob-report

    - name: Merge into HTML Report
      run: |
        npx playwright merge-reports ./blob-report --reporter html

    - name: Upload HTML report
      uses: actions/upload-artifact@v3
      with:
        name: html-report-${{ github.run_attempt }}
        path: playwright-report
```

`merge-report` job will run even if there were test failures and it wil write the HTML report into `playwright-report` directory by default.

### Serving report: GitHub Actions Artifacts 

Merged HTML report can be saved as `html-report-${{ github.run_attempt }}` artifact by adding following step:

```yaml
    - name: Upload HTML report
      uses: actions/upload-artifact@v3
      with:
        name: html-report-${{ github.run_attempt }}
        path: playwright-report
```

You can download the artifact via GitHub UI to see the report. This method has its own pros and cons:

Pros:
- Easy configuration, builtin mechanism of GitHub Actions
- Flexible retention policy
Cons:
- Downloading the HTML report as a zip file might not be the most user-friendly method.

In the next section, we'll illustrate how to make the report accessible from cloud storage.

### Serving report: Azure Blob Storage

We can utilize Azure Storage's [Static websites hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website) capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration. You can simply add a step that uploads HTML report to Azure:

```yaml
- name: Upload HTML report to Azure
  shell: bash
  run: |
    REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
    az storage blob upload-batch -s playwright-report -d "\$web/$REPORT_DIR" --connection-string "${{ secrets.AZURE_CONNECTION_STRING }}"
```

The code above assumes that you have the Azure connection string stored in GitHub [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) called `AZURE_CONNECTION_STRING`.

Afrer you enable [static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website#setting-up-a-static-website) for your storage account, the contents of `$web` can be accessed from a browser by using the public URL of the website ([how to find the website URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url)).

:::note
Note that this step will not work for pull requests created from a forked repository because such workflow [does't have access to the secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow)
:::

### Serving report: other CI and storage systems

At the high level, running multiple shards and generating a single combined report requires:

1. Configure Playwright to produce `blob` report on every running shard.
1. Copy all blob reports into a single local directory.
1. Run `npx playwright merge-reports path/to/all-blob-reports-dir --reporter html` to generate HTML (or any other) report.
1. Upload generated report to the storage of your choice.

Similarly to the GitHub Actions steps above, you can configure you can integrate these steps into your CI.

### Uploading Pull Request reports

TODO