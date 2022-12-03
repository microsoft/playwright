---
id: running-tests
title: "Running Tests"
---

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `--headed` flag.

- Running tests on Chromium

  ```bash
  pytest
  ```

- Running a single test file

  ```bash
  pytest test_login.py
  ```

- Run a set of test files

  ```bash
  pytest tests/todo-page/ tests/landing-page/
  ```

- Run the test with the function name

  ```bash
  pytest -k "test_add_a_todo_item"
  ```

- Running tests in headed mode

  ```bash
  pytest --headed test_login.py
  ```

- Running Tests on specific browsers

  ```bash
  pytest test_login.py --browser webkit
  ```

- Running Tests on multiple browsers

  ```bash
  pytest test_login.py --browser webkit --browser firefox
  ```

- Running Tests in parallel

  ```bash
  pytest --numprocesses auto
  ```

  (This assumes `pytest-xdist` is installed. For more information see [here](./test-runners.md#parallelism-running-multiple-tests-at-once).)

For more information see [Playwright Pytest usage](./test-runners.md) or the Pytest documentation for [general CLI usage](https://docs.pytest.org/en/stable/usage.html).

## Running Tests

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