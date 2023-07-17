---
id: test-merge-report
title: "Merging multiple reports"
---

## Introduction

When running tests on multiple shards, each shard will get its own report with the results of the tests from only one shard. In many cases it's more convenient to see all test results from all shards in one report. That can be achieved by producing blob reports on the individual shards and combining them into a single report via playwright CLI as the post processing step. At the high level the process consists of the following steps:

1. Get Playwright to produce `blob` report on every running shard.
2. Copy all blob reports into a single local directory.
3. Run `npx playwright merge-reports` on the blob reports data to generate combined HTML (or any other) report.

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

