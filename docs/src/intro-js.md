---
id: intro
title: "Installation"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari.

**You will learn**

- [How to install Playwright](/intro.md#installing-playwright)
- [What's Installed](/intro.md#whats-installed)
- [How to run the example test](/intro.md#running-the-example-test)
- [How to open the HTML test report](/intro.md#html-test-reports)


## Installing Playwright

Get started by installing Playwright using npm or yarn. Alternatively you can also get started and run your tests using the [VS Code Extension](./getting-started-vscode.md).

<Tabs
  defaultValue="npm"
  values={[
    {label: 'npm', value: 'npm'},
    {label: 'yarn', value: 'yarn'},
    {label: 'pnpm', value: 'pnpm'}
  ]
}>
<TabItem value="npm">

```bash
npm init playwright@latest
```

</TabItem>

<TabItem value="yarn">

```bash
yarn create playwright
```

</TabItem>
  
<TabItem value="pnpm">

```bash
pnpm dlx create-playwright
```

</TabItem>
</Tabs>


Run the install command and select the following to get started:
 - Choose between TypeScript or JavaScript (default is TypeScript)
 - Name of your Tests folder (default is tests or e2e if you already have a tests folder in your project)
 - Add a GitHub Actions workflow to easily run tests on CI
 - Install Playwright browsers (default is true)


## What's Installed

Playwright will download the browsers needed as well as create the following files.

```bash
playwright.config.ts
package.json
package-lock.json
tests/
  example.spec.ts
tests-examples/
  demo-todo-app.spec.ts
```

The [playwright.config](./test-configuration.md) is where you can add configuration for Playwright including modifying which browsers you would like to run Playwright on. If you are running tests inside an already existing project then dependencies will be added directly to your `package.json`.
 
The `tests` folder contains a basic example test to help you get started with testing. For a more detailed example check out the `tests-examples` folder which contains tests written to test a todo app.

## Running the Example Test

By default tests will be run on all 3 browsers, chromium, firefox and webkit using 3 workers. This can be configured in the [playwright.config file](./test-configuration.md). Tests are run in headless mode meaning no browser will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

```bash
npx playwright test
```

See our doc on [Running Tests](./running-tests.md) to learn more about running tests in headed mode, running multiple tests, running specific tests etc.

## HTML Test Reports

Once your test has finished running a [HTML Reporter](./test-reporters.md#html-reporter) will have been created which shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests. You can click on each test and explore the test's errors as well as each step of the test. By default, the HTML report is opened automatically if some of the tests failed.

```bash
npx playwright show-report
```

<img width="1392" alt="HTML Reporter" src="https://user-images.githubusercontent.com/13063165/212743312-edf1e8ed-3fc2-48aa-9c93-24ae3e36504d.png" />

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen-intro.md)
- [See a trace of your tests](./trace-viewer-intro.md)
