---
id: ci-intro
title: "CI Github Actions"
---

When installing Playwright you are given the option to add a GitHub Actions. This creates a `playwright.yml` file inside a `.github/workflows` containing everything you need so that your tests run on each push into the main/master branch and pull request.

**What you will learn:**

- [How to use GitHub Actions to run your tests](#github-actions)
- [How to create a repo and push to GitHub](#create-a-repo-and-push-to-github)
- [How to open the workflows](#opening-the-workflows)
- [How to view the test Logs](#viewing-test-logs)
- [How to download the Playwright Report from GitHub](#downloading-the-playwright-report)
- [How to view the Playwright Report](#viewing-the-playwright-report)
- [How to view the trace](#viewing-the-trace)

## GitHub Actions

Tests will run on push or pull request on branches main or master. The workflow will install all dependencies, install playwright and then run the tests. It will also create the playwright report.

```yaml
name: Playwright Tests
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "14.x"
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test
      - uses: actions/upload-artifact@v2
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Create a Repo and Push to GitHub

[Create a repo on GitHub](https://docs.github.com/en/get-started/quickstart/create-a-repo) and create a new repository or push an existing repository. Follow the instructions on GitHub and don't forget to initialize a git repository using the `git init` command so you can push your code.

<img width="861" alt="Create a Repo and Push to GitHub" src="https://user-images.githubusercontent.com/13063165/183423254-d2735278-a2ab-4d63-bb99-48d8e5e447bc.png"/>

### Opening the Workflows

Click on the **Actions** tab to see the workflows. Here you will see if your tests have passed or failed.

<img width="847" alt="Opening the Workflows" src="https://user-images.githubusercontent.com/13063165/183423584-2ea18038-cd49-4daa-a20c-2205352f0933.png"/>

### Viewing Test Logs

Clicking on the workflow run will show you the all the actions that GitHub performed and clicking on **Run Playwright tests** will show the error messages, what was expected and what was received as well as the call log.

<img width="839" alt="Viewing Test Logs" src="https://user-images.githubusercontent.com/13063165/183423783-58bf2008-514e-4f96-9c12-c9a55703960c.png"/>

## HTML Report

The HTML Reporter shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests.

### Downloading the Playwright Report

In the Artifacts section click on the **playwright-report** to download your report in the format of a zip file.

<img width="972" alt="Downloading the Playwright Report" src="https://user-images.githubusercontent.com/13063165/183437023-524f1803-84e4-4862-9ce3-1d55af0e023e.png" />

### Viewing the Playwright Report

To view the Playwright Report you will need to extract the zip, preferably in a folder that already has Playwright installed otherwise you will have to install Playwright in the folder where you extracted the zip. Then use `npx playwright show-report` followed by the name of the extracted folder which by default is called `playwright-report`.

```bash	
npx playwright show-report playwright-report
```

<img width="752" alt="Viewing the Playwright Report" src="https://user-images.githubusercontent.com/13063165/183437645-b47dd175-2e07-4ecc-a469-27d5b150b7ed.png" />

### Viewing the Trace

Click on the trace icon next to the test's file name to view the trace.

<img width="1909" alt="Deploying the Playwright Report to view the Trace" src="https://user-images.githubusercontent.com/13063165/183438037-01935200-f784-4c80-bbea-bcff8adae078.png" />

To learn more about running tests on CI check out our detailed guide on [Continuous Integration](/ci.md)


## What's Next

- [Learn how to write Web First Assertions](/test-assertions.md)
- [Learn how to use Selectors](/selectors.md)
- [Learn how to use Locators](/locators.md)