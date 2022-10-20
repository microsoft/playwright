---
id: ci-intro
title: "CI Github Actions"
---

When installing Playwright you are given the option to add a [GitHub Actions](https://docs.github.com/en/actions). This creates a `playwright.yml` file inside a `.github/workflows` folder containing everything you need so that your tests run on each push and pull request into the main/master branch.

**What you will learn:**

- [How to use GitHub Actions to run your tests](#github-actions)
- [How to create a repo and push to GitHub](#create-a-repo-and-push-to-github)
- [How to open the workflows](#opening-the-workflows)
- [How to view the test logs](#viewing-test-logs)
- [How to download the report from GitHub](#downloading-the-html-report)
- [How to view the report](#viewing-the-html-report)
- [How to view the trace](#viewing-the-trace)

## GitHub Actions

Tests will run on push or pull request on branches main/master. The [workflow](https://docs.github.com/en/actions/using-workflows/about-workflows) will install all dependencies, install Playwright and then run the tests. It will also create the HTML report.

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

[Create a repo on GitHub](https://docs.github.com/en/get-started/quickstart/create-a-repo) and create a new repository or push an existing repository. Follow the instructions on GitHub and don't forget to [initialize a git repository](https://github.com/git-guides/git-init) using the `git init` command so you can [add](https://github.com/git-guides/git-add), [commit](https://github.com/git-guides/git-commit) and [push](https://github.com/git-guides/git-push) your code.

<img width="861" alt="Create a Repo and Push to GitHub" src="https://user-images.githubusercontent.com/13063165/183423254-d2735278-a2ab-4d63-bb99-48d8e5e447bc.png"/>

### Opening the Workflows

Click on the **Actions** tab to see the workflows. Here you will see if your tests have passed or failed.

<img width="847" alt="Opening the Workflows" src="https://user-images.githubusercontent.com/13063165/183423584-2ea18038-cd49-4daa-a20c-2205352f0933.png"/>

On Pull Requests you can also click on the **Details** link in the [PR status check](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks).

<img width="645" alt="pr status checked" src="https://user-images.githubusercontent.com/13063165/183722462-17a985db-0e10-4205-b16c-8aaac36117b9.png" />

### Viewing Test Logs

Clicking on the workflow run will show you the all the actions that GitHub performed and clicking on **Run Playwright tests** will show the error messages, what was expected and what was received as well as the call log.

<img width="839" alt="Viewing Test Logs" src="https://user-images.githubusercontent.com/13063165/183423783-58bf2008-514e-4f96-9c12-c9a55703960c.png"/>



## HTML Report

The HTML Report shows you a full report of your tests. You can filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests.

### Downloading the HTML Report

In the Artifacts section click on the **playwright-report** to download your report in the format of a zip file.

<img width="972" alt="Downloading the HTML Report" src="https://user-images.githubusercontent.com/13063165/183437023-524f1803-84e4-4862-9ce3-1d55af0e023e.png" />

### Viewing the HTML Report

Locally opening the report will not work as expected as you need a web server in order for everything to work correctly. First, extract the zip, preferably in a folder that already has Playwright installed. Using the command line change into the directory where the report is and use `npx playwright show-report` followed by the name of the extracted folder. This will serve up the report and enable you to view it in your browser.


```bash
npx playwright show-report name-of-my-extracted-playwright-report
```

<img width="752" alt="Viewing the HTML Report" src="https://user-images.githubusercontent.com/13063165/183437645-b47dd175-2e07-4ecc-a469-27d5b150b7ed.png" />

To learn more about reports check out our detailed guide on [HTML Reporter](/test-reporters.md#html-reporter)

### Viewing the Trace

Once you have served the report using `npx playwright show-report`, click on the trace icon next to the test's file name as seen in the image above. You can then view the trace of your tests and inspect each action to try to find out why the tests are failing.


<img width="1907" alt="Viewing the Trace" src="https://user-images.githubusercontent.com/13063165/183879653-d442e6b4-14f5-4d0e-99f3-9ba19f82c7cf.png"/>

To learn more about traces check out our detailed guide on [Trace Viewer](/trace-viewer.md).

To learn more about running tests on CI check out our detailed guide on [Continuous Integration](/ci.md).


## What's Next

- [Learn how to use Web First Assertions](/test-assertions.md)
- [Learn how to use Selectors](/selectors.md)
- [Learn how to use Locators](/locators.md)
