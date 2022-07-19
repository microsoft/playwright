---
id: intro
title: "Installation"
---

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation. 

You can choose to use the [Playwright Pytest plugin](./test-runners.md) to write end-to-end tests. It provides context isolation, running it on multiple browser configurations out of the box. Alternatively you can use the [library](./library.md) to manually write the testing infrastructure with your preferred test-runner.

Get started by installing Playwright and running the example test to see it in action.

Install the [Pytest plugin](https://pypi.org/project/pytest-playwright/):

```bash
pip install pytest-playwright
```

Install the required browsers:

```bash
playwright install
```

## Add Example Test

Create a `test_my_application.py` file inside the current working directory or in a sub-directory with the code below:

```py
def test_example_is_working(page):
    page.goto("https://example.com")
    assert page.inner_text('h1') == 'Example Domain'
    page.locator("text=More information").click()
```

## Running the Example Test

By default tests will be run on chromium. This can be configured via the CLI options. Tests are run in headless mode meaning no browser will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

```bash
pytest
```

See our doc on [Running Tests](./running-tests.md) to learn more about running tests in headed mode, running multiple tests, running specific tests etc.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single tests, multiple tests, headed mode](./running-tests.md)
- [Debug tests with the Playwright Debugger](./debug.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)
