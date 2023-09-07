---
id: running-tests
title: "Running tests"
---

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers by using the `--browser` flag. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `--headed` CLI argument.

**You will learn**

- [How to run tests from the command line](/running-tests.md#command-line)
- [How to debug tests](/running-tests.md#debugging-tests)

## Command Line

To run your tests use the `pytest` command. This will run your tests on the Chromium browser by default. Tests run in headless mode by default meaning no browser window will be opened while running the tests and results will be seen in the terminal.

```bash
pytest
```

### Running tests headed

To run your tests in headed mode use the `--headed` flag. This will open up a browser window while running your tests.

```bash
pytest --headed
```
### Running tests on different browsers

To specify which browser you would like to run your tests on use the `--browser` flag followed by the name of the browser.

```bash
pytest --browser webkit
```

To specify multiple browsers to run your tests on use the `--browser` flag multiple times followed by the name of each browser.


```bash
pytest --browser webkit --browser firefox
```

### Running specific tests

To run a single test file pass in the name of the test file that you want to run.

  ```bash
  pytest test_login.py
  ```

To run a set of test files pass in the names of the test files that you want to run.

  ```bash
  pytest tests/test_todo_page.py tests/test_landing_page.py
  ```

To run a specific test pass in the function name of the test you want to run.

  ```bash
  pytest -k test_add_a_todo_item
  ```

### Run tests in Parallel

To run your tests in parallel use the `--numprocesses` flag followed by the number of processes you would like to run your tests on. We recommend half of logical CPU cores.

  ```bash
  pytest --numprocesses 2
  ```

  (This assumes `pytest-xdist` is installed. For more information see [here](./test-runners.md#parallelism-running-multiple-tests-at-once).)

For more information see [Playwright Pytest usage](./test-runners.md) or the Pytest documentation for [general CLI usage](https://docs.pytest.org/en/stable/usage.html).

## Debugging Tests

Since Playwright runs in Python, you can debug it with your debugger of choice with e.g. the [Python extension](https://code.visualstudio.com/docs/python/python-tutorial) in Visual Studio Code. Playwright comes with the Playwright Inspector which allows you to step through Playwright API calls, see their debug logs and explore [locators](./locators.md).


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
<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>

Check out our [debugging guide](./debug.md) to learn more about the [Playwright Inspector](./debug.md#playwright-inspector) as well as debugging with [Browser Developer tools](./debug.md#browser-developer-tools).


## What's Next

- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
