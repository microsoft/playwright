---
id: intro
title: "Installation"
---
## Introduction

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation.

The [Playwright library](./library.md) can be used as a general purpose browser automation tool, providing a powerful set of APIs to automate web applications, for both sync and async Python.

This introduction describes the Playwright Pytest plugin, which is the recommended way to write end-to-end tests.

**You will learn**

- [How to install Playwright Pytest](/intro.md#installing-playwright-pytest)
- [How to run the example test](/intro.md#running-the-example-test)

## Installing Playwright Pytest

Playwright recommends using the official [Playwright Pytest plugin](./test-runners.md) to write end-to-end tests. It provides context isolation, running it on multiple browser configurations out of the box.

Get started by installing Playwright and running the example test to see it in action.

<Tabs
  groupId="package-managers"
  defaultValue="pypi"
  values={[
    {label: 'PyPI', value: 'pypi'},
    {label: 'Anaconda', value: 'anaconda'}
  ]
}>
<TabItem value="pypi">

Install the [Pytest plugin](https://pypi.org/project/pytest-playwright/):

```bash
pip install pytest-playwright
```

</TabItem>
<TabItem value="anaconda">

Install the [Pytest plugin](https://anaconda.org/Microsoft/pytest-playwright):

```bash
conda config --add channels conda-forge
conda config --add channels microsoft
conda install pytest-playwright
```

</TabItem>
</Tabs>

Install the required browsers:

```bash
playwright install
```

## Add Example Test

Create a file that follows the `test_` prefix convention, such as `test_example.py`, inside the current working directory or in a sub-directory with the code below. Make sure your test name also follows the `test_` prefix convention.

```py title="test_example.py"
import re
from playwright.sync_api import Page, expect

def test_has_title(page: Page):
    page.goto("https://playwright.dev/")

    # Expect a title "to contain" a substring.
    expect(page).to_have_title(re.compile("Playwright"))

def test_get_started_link(page: Page):
    page.goto("https://playwright.dev/")

    # Click the get started link.
    page.get_by_role("link", name="Get started").click()

    # Expects page to have a heading with the name of Installation.
    expect(page.get_by_role("heading", name="Installation")).to_be_visible()
```

## Running the Example Test

By default tests will be run on chromium. This can be configured via the [CLI options](./running-tests.md). Tests are run in headless mode meaning no browser UI will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

```bash
pytest
```

## Updating Playwright

To update Playwright to the latest version run the following command:

```bash
pip install pytest-playwright playwright -U
```

## System requirements

- Python 3.8 or higher.
- Windows 10+, Windows Server 2016+ or Windows Subsystem for Linux (WSL).
- macOS 14 Ventura, or later.
- Debian 12, Ubuntu 22.04, Ubuntu 24.04, on x86-64 and arm64 architecture.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
