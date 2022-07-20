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

For more information see [Playwright Pytest usage](./test-runners.md) or the Pytest documentation for [general CLI usage](https://docs.pytest.org/en/stable/usage.html).

## What's Next

- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)