---
id: test-runners
title: "Pytest Plugin Reference"
---

Playwright provides a [Pytest](https://docs.pytest.org/en/stable/) plugin to write end-to-end tests. To get started with it, refer to the [getting started guide](./intro.md).

## Usage

To run your tests, use [Pytest](https://docs.pytest.org/en/stable/) CLI.

```bash
pytest --browser webkit --headed
```

If you want to add the CLI arguments automatically without specifying them, you can use the [pytest.ini](https://docs.pytest.org/en/stable/reference.html#ini-options-ref) file:

```ini
# content of pytest.ini
[pytest]
# Run firefox with UI
addopts = --headed --browser firefox
```

## CLI arguments

- `--headed`: Run tests in headed mode (default: headless).
- `--browser`: Run tests in a different browser `chromium`, `firefox`, or `webkit`. It can be specified multiple times (default: `chromium`).
- `--browser-channel` [Browser channel](./browsers.md) to be used.
- `--slowmo` Run tests with slow mo.
- `--device` [Device](./emulation.md) to be emulated.
- `--output` Directory for artifacts produced by tests (default: `test-results`).
- `--tracing` Whether to record a [trace](./trace-viewer.md) for each test. `on`, `off`, or `retain-on-failure` (default: `off`).
- `--video` Whether to record video for each test. `on`, `off`, or `retain-on-failure` (default: `off`).
- `--screenshot` Whether to automatically capture a screenshot after each test. `on`, `off`, or `only-on-failure` (default: `off`).

## Fixtures

This plugin configures Playwright-specific [fixtures for pytest](https://docs.pytest.org/en/latest/fixture.html). To use these fixtures, use the fixture name as an argument to the test function.

```py
def test_my_app_is_working(fixture_name):
    # Test using fixture_name
    # ...
```

**Function scope**: These fixtures are created when requested in a test function and destroyed when the test ends.

- `context`: New [browser context](https://playwright.dev/python/docs/browser-contexts) for a test.
- `page`: New [browser page](https://playwright.dev/python/docs/pages) for a test.

**Session scope**: These fixtures are created when requested in a test function and destroyed when all tests end.

- `playwright`: [Playwright](https://playwright.dev/python/docs/api/class-playwright) instance.
- `browser_type`: [BrowserType](https://playwright.dev/python/docs/api/class-browsertype) instance of the current browser.
- `browser`: [Browser](https://playwright.dev/python/docs/api/class-browser) instance launched by Playwright.
- `browser_name`: Browser name as string.
- `browser_channel`: Browser channel as string.
- `is_chromium`, `is_webkit`, `is_firefox`: Booleans for the respective browser types.

**Customizing fixture options**: For `browser` and `context` fixtures, use the following fixtures to define custom launch options.

- `browser_type_launch_args`: Override launch arguments for [`method: BrowserType.launch`]. It should return a Dict.
- `browser_context_args`: Override the options for [`method: Browser.newContext`]. It should return a Dict.

## Parallelism: Running Multiple Tests at Once

If your tests are running on a machine with a lot of CPUs, you can speed up the overall execution time of your test suite by using [`pytest-xdist`](https://pypi.org/project/pytest-xdist/) to run multiple tests at once:

```bash
# install dependency
pip install pytest-xdist
# use the --numprocesses flag
pytest --numprocesses auto
```

Depending on the hardware and nature of your tests, you can set `numprocesses` to be anywhere from `2` to the number of CPUs on the machine. If set too high, you may notice unexpected behavior.

See [Running Tests](./running-tests.md) for general information on `pytest` options.

## Examples

### Configure Mypy typings for auto-completion

```py
# test_my_application.py
from playwright.sync_api import Page

def test_visit_admin_dashboard(page: Page):
    page.goto("/admin")
    # ...
```

### Configure slow mo

Run tests with slow mo with the `--slowmo` argument.

```bash
pytest --slowmo 100
```

### Skip test by browser

```py
# test_my_application.py
import pytest

@pytest.mark.skip_browser("firefox")
def test_visit_example(page):
    page.goto("https://example.com")
    # ...
```

### Run on a specific browser

```py
# conftest.py
import pytest

@pytest.mark.only_browser("chromium")
def test_visit_example(page):
    page.goto("https://example.com")
    # ...
```

### Run with a custom browser channel like Google Chrome or Microsoft Edge

```bash
pytest --browser-channel chrome
```

```python
# test_my_application.py
def test_example(page):
    page.goto("https://example.com")
```

### Configure base-url

Start Pytest with the `base-url` argument. The [`pytest-base-url`](https://github.com/pytest-dev/pytest-base-url) plugin is used
for that which allows you to set the base url from the config, CLI arg or as a fixture.

```bash
pytest --base-url http://localhost:8080
```

```py
# test_my_application.py
def test_visit_example(page):
    page.goto("/admin")
    # -> Will result in http://localhost:8080/admin
```

### Ignore HTTPS errors

```py
# conftest.py
import pytest

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "ignore_https_errors": True
    }
```

### Use custom viewport size

```py
# conftest.py
import pytest

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "viewport": {
            "width": 1920,
            "height": 1080,
        }
    }
```

### Device emulation

```py
# conftest.py
import pytest

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args, playwright):
    iphone_11 = playwright.devices['iPhone 11 Pro']
    return {
        **browser_context_args,
        **iphone_11,
    }
```

Or via the CLI `--device="iPhone 11 Pro"`

### Persistent context

```py
# conftest.py
import pytest
from playwright.sync_api import BrowserType
from typing import Dict

@pytest.fixture(scope="session")
def context(
    browser_type: BrowserType,
    browser_type_launch_args: Dict,
    browser_context_args: Dict
):
    context = browser_type.launch_persistent_context("./foobar", **{
        **browser_type_launch_args,
        **browser_context_args,
        "locale": "de-DE",
    })
    yield context
    context.close()
```

When using that all pages inside your test are created from the persistent context.

### Using with `unittest.TestCase`

See the following example for using it with `unittest.TestCase`. This has a limitation,
that only a single browser can be specified and no matrix of multiple browsers gets
generated when specifying multiple.

```py
import pytest
import unittest

from playwright.sync_api import Page


class MyTest(unittest.TestCase):
    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        self.page = page

    def test_foobar(self):
        self.page.goto("https://microsoft.com")
        self.page.locator("#foobar").click()
        assert self.page.evaluate("1 + 1") == 2
```

## Debugging

### Use with pdb

Use the `breakpoint()` statement in your test code to pause execution and get a [pdb](https://docs.python.org/3/library/pdb.html) REPL.

```py
def test_bing_is_working(page):
    page.goto("https://bing.com")
    breakpoint()
    # ...
```

## Deploy to CI

See the [guides for CI providers](./ci.md) to deploy your tests to CI/CD.
