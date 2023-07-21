---
id: test-merge-report
title: "Merging multiple reports"
---

## Sharding tests

TODO

## Introduction

When running tests on multiple shards, each shard will get its own report with the results of the tests from only one shard. In many cases it's more convenient to see all test results from all shards in one report. That can be achieved by producing blob reports on the individual shards and combining them into a single report via playwright CLI as the post processing step. At the high level the process consists of the following steps:

1. Get Playwright to produce `blob` report on every running shard.
1. Copy all blob reports into a single local directory.
1. Run `npx playwright merge-reports` on the blob reports data to generate combined HTML (or any other) report.

In the following sections we consider details of each step.

### Configuring shard reporting

We start by adding `blob` reporter to the config:

```js
export default defineConfig({
  testDir: './tests',
  reporter: [['blob', { outputDir: 'blob-report' }]],
});
```

Blob report contains information about all the tests that were run and their results as well as all test attachments such as traces and screenshot diffs. Blob reports can be merged and converted to any other Playwright report.

### Copying blob reports

On each machine that is running tests we'll get a blob report under `blob-report` directory. Once all shards finish, contents of all `blob-report` directories should be copied into a single directory. All files inside `blob-report` directory have unique names, so don't worry about possible name collisions when copying the files.

### Creating combined report

Once all blob report files have been copied into a directory we can call `npx playwright merge-reports` which will combine the data and create any report you like. Assuming that you copied all blob reports into `all-blob-reports` directory, you can create an HTML report like this:

```sh
npx playwright merge-reports path/to/all-blob-reports --reporter html
```
This command will put a combined HTML report inside the `playwright-report` directory. Then you can upload the HTML report to your artifact storage or publish it somewhere.

## Merging sharded report using GitHub Actions

One of the easiest ways to shard Playwright tests across multiple machines is by using a GitHub Actions matrix strategy. For example, you can configure a job to run the tests on 4 machines in parallel and upload blob report from each of them into GitHub Actions Artifacts with name`blob-report-${{ github.run_attempt }}` (this is essentially a shared directory where each shard will copy its blob report):

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

    - name: Upload blob report to Artifacts
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: blob-report-${{ github.run_attempt }}
        path: blob-report
        retention-days: 2
```

With this configuration all blob reports for a given attempt will be stored in `blob-report-${{ github.run_attempt }}` artifact. Now we can add a [dependent job](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow#defining-prerequisite-jobs) that will run after the shards to merge all blob reports into a single HTML:


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

`merge-report` job will run even if there are some test failures and it will save resulting HTML report as `html-report-${{ github.run_attempt }}` artifact. You can download the artifact to review the report. Downloading the HTML report as a zip file might not be the most user-friendly method. In the next section, we'll illustrate how to effortlessly make it accessible from cloud storage.

## Serving report from Azure blob storage

After an HTML report has been generated, it can be stored in the cloud, ensuring accessibility from any device at a later time. We can utilize Azure Storage's [Static websites hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website) capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration. You can simply add a step that uploads HTML report to Azure:

```yaml
- name: Upload HTML report to Azure
  shell: bash
  run: |
    REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
    az storage blob upload-batch -s playwright-report -d "\$web/$REPORT_DIR" --connection-string "${{ secrets.AZURE_CONNECTION_STRING }}"
```

The code above assumes that you have the Azure connection string stored in GitHub [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository) called `AZURE_CONNECTION_STRING`.

Afrer you enable [static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website#setting-up-a-static-website) for your storage account, the contents of `$web` can be accessed from a browser by using the public URL of the website ([how to find the website URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url)).

### Uploading Pull Request reports

The code in the previous section requires access to the repository secrets. When a workflow is triggered on a pull request from a forked repository, secrets are [not passed](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow) to the runner. To overcome that limitation you'll need to extract the upload logic into a separate workflow triggered by [workflow_run](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run) event. The workflow started by the `workflow_run` event is able to access secrets, even if the previous workflow was not.

The logic of downloading blob report from GitHub Actions Artifacts has to be updated too, as the merge workflow can not access artifacts from the test workflow directly. You can use the following custom action for that:

```yaml
name: 'Download blob report'
description: 'Download blob report from GitHub artifacts'
inputs:
  name:
    description: 'Name of the artifact to download'
    required: true
    type: string
    default: 'blob-report'
  path:
    description: 'Directory with downloaded artifacts'
    required: true
    type: string
    default: 'blob-report'
runs:
  using: "composite"
  steps:
    - name: Download blob report
      uses: actions/github-script@v6
      with:
        script: |
          const { data } = await github.rest.actions.listWorkflowRunArtifacts({
            ...context.repo,
            run_id: context.payload.workflow_run.id
          });
          const name = '${{ inputs.name }}';
          const report = data.artifacts.filter(a => a.name === name)[0];
          const result = await github.rest.actions.downloadArtifact({
            ...context.repo,
            artifact_id: report.id,
            archive_format: 'zip'
          });
          const fs = require('fs');
          fs.writeFileSync(`${name}.zip`, Buffer.from(result.data));
    - name: Unzip blob report
      shell: bash
      run: unzip ${{ inputs.name }}.zip -d ${{ inputs.path }}
```

Putting it all together:

```yaml
name: Publish Test Results
on:
  workflow_run:
    workflows: ["Playwright Tests"]
    types:
      - completed
jobs:
  merge-reports:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 18
    - name: Install dependencies
      run: npm ci

    - name: Download blob report artifact
      uses: ./.github/actions/download-artifact
      with:
        name: 'blob-report-${{ github.event.workflow_run.run_attempt }}'
        path: 'blob-report'

    - name: Merge reports
      run: |
        npx playwright merge-reports --reporter html ./blob-report

    - name: Upload HTML report to Azure
      run: |
        REPORT_DIR='run-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}'
        az storage blob upload-batch -s playwright-report -d "\$web/$REPORT_DIR" --connection-string "${{ secrets.AZURE_CONNECTION_STRING }}"
        echo "Report url: https://mspwblobreport.z1.web.core.windows.net/$REPORT_DIR/index.html"
```
