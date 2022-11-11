---
id: intro
title: "Installation"
---

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation. 

Playwright recommends using the official [Playwright Pytest plugin](./test-runners.md) to write end-to-end tests. It provides context isolation, running it on multiple browser configurations out of the box. Alternatively you can use the [library](./library.md) to manually write the testing infrastructure with your preferred test-runner. The Pytest plugin utilizes the sync version of Playwright, there is also an async version accessible via the library.

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
import re
from playwright.sync_api import Page, expect


def test_homepage_has_Playwright_in_title_and_get_started_link_linking_to_the_intro_page(page: Page):
    page.goto("https://playwright.dev/")

    # Expect a title "to contain" a substring.
    expect(page).to_have_title(re.compile("Playwright"))

    # create a locator
    get_started = page.get_by_role("link", name="Get started")

    # Expect an attribute "to be strictly equal" to the value.
    expect(get_started).to_have_attribute("href", "/docs/intro")

    # Click the get started link.
    get_started.click()

    # Expects the URL to contain intro.
    expect(page).to_have_url(re.compile(".*intro"))
```

## Running the Example Test

By default tests will be run on chromium. This can be configured via the CLI options. Tests are run in headless mode meaning no browser UI will open up when running the tests. Results of the tests and test logs will be shown in the terminal.

```bash
pytest
```

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
