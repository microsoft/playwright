---
id: running-tests
title: "Running and debugging tests"
---
## Introduction

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers by using the `--browser` flag. By default, tests are run in a headless manner, meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer, you can run your tests in headed mode by using the `--headed` CLI argument.

**You will learn**

- [How to run tests from the command line](/running-tests.md#command-line)
- [How to debug tests](/running-tests.md#debugging-tests)

## Running tests

### Command Line

To run your tests, use the `pytest` command. This will run your tests on the Chromium browser by default. Tests run in headless mode by default meaning no browser window will be opened while running the tests and results will be seen in the terminal.

```bash
pytest
```

### Run tests in headed mode

To run your tests in headed mode, use the `--headed` flag. This will open up a browser window while running your tests and once finished the browser window will close.

```bash
pytest --headed
```
### Run tests on different browsers

To specify which browser you would like to run your tests on, use the `--browser` flag followed by the name of the browser.

```bash
pytest --browser webkit
```

To specify multiple browsers to run your tests on, use the `--browser` flag multiple times followed by the name of each browser.


```bash
pytest --browser webkit --browser firefox
```

### Run specific tests

To run a single test file, pass in the name of the test file that you want to run.

  ```bash
  pytest test_login.py
  ```

To run a set of test files, pass in the names of the test files that you want to run.

  ```bash
  pytest tests/test_todo_page.py tests/test_landing_page.py
  ```

To run a specific test, pass in the function name of the test you want to run.

  ```bash
  pytest -k test_add_a_todo_item
  ```

### Run tests in parallel

To run your tests in parallel, use the `--numprocesses` flag followed by the number of processes you would like to run your tests on. We recommend half of logical CPU cores.

  ```bash
  pytest --numprocesses 2
  ```

  (This assumes `pytest-xdist` is installed. For more information see [here](./test-runners.md#parallelism-running-multiple-tests-at-once).)

For more information, see [Playwright Pytest usage](./test-runners.md) or the Pytest documentation for [general CLI usage](https://docs.pytest.org/en/stable/usage.html).

## Debugging tests

Since Playwright runs in Python, you can debug it with your debugger of choice, e.g., with the [Python extension](https://code.visualstudio.com/docs/python/python-tutorial) in Visual Studio Code. Playwright comes with the Playwright Inspector which allows you to step through Playwright API calls, see their debug logs and explore [locators](./locators.md).

To debug all tests, run the following command.

```bash tab=bash-bash lang=python
PWDEBUG=1 pytest -s
```

```batch tab=bash-batch lang=python
set PWDEBUG=1
pytest -s
```

```powershell tab=bash-powershell lang=python
$env:PWDEBUG=1
pytest -s
```

To debug one test file, run the command followed by the name of the test file that you want to debug.

```bash tab=bash-bash lang=python
PWDEBUG=1 pytest -s test_example.py
```

```batch tab=bash-batch lang=python
set PWDEBUG=1
pytest -s test_example.py
```

```powershell tab=bash-powershell lang=python
$env:PWDEBUG=1
pytest -s test_example.py
```

To debug a specific test, add `-k` followed by the name of the test that you want to debug.

```bash tab=bash-bash lang=python
PWDEBUG=1 pytest -s -k test_get_started_link
```

```batch tab=bash-batch lang=python
set PWDEBUG=1
pytest -s -k test_get_started_link
```

```powershell tab=bash-powershell lang=python
$env:PWDEBUG=1
pytest -s -k test_get_started_link
```

This command will open up a Browser window as well as the Playwright Inspector. You can use the step over button at the top of the inspector to step through your test. Or press the play button to run your test from start to finish. Once the test has finished, the browser window will close.

While debugging you can use the Pick Locator button to select an element on the page and see the locator that Playwright would use to find that element. You can also edit the locator and see it highlighting live on the Browser window. Use the Copy Locator button to copy the locator to your clipboard and then paste it into your test.

![Playwright Inspector](https://github.com/microsoft/playwright/assets/13063165/c94c89c8-f945-460c-a653-7809c6ca50ee)

Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## What's next

- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
- [Run your tests on CI with GitHub Actions](./ci-intro.md)
