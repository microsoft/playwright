---
id: intro
title: "Getting Started"
---

<!-- TOC -->
- [Release notes](./release-notes.md)

## Installation

See [system requirements](#system-requirements).

### Pip

[![PyPI version](https://badge.fury.io/py/playwright.svg)](https://pypi.python.org/pypi/playwright/)

```bash
pip install playwright
playwright install
```

### Conda

[![Anaconda version](https://img.shields.io/conda/v/microsoft/playwright)](https://anaconda.org/Microsoft/playwright)

```bash
conda config --add channels conda-forge
conda config --add channels microsoft
conda install playwright
playwright install
```

These commands download the Playwright package and install browser binaries for Chromium, Firefox and WebKit. To modify this behavior see [installation parameters](./installation.md).

## Usage

Once installed, you can `import` Playwright in a Python script, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

```py
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("http://playwright.dev")
    print(page.title())
    browser.close()
```

Playwright supports two variations of the API: synchronous and asynchronous. If your modern project uses [asyncio](https://docs.python.org/3/library/asyncio.html), you should use async API:

```py
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://playwright.dev")
        print(await page.title())
        await browser.close()

asyncio.run(main())
```

## First script

In our first script, we will navigate to `whatsmyuseragent.org` and take a screenshot in WebKit.

```py
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page()
    page.goto("http://whatsmyuseragent.org/")
    page.screenshot(path="example.png")
    browser.close()
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless=False` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```py
firefox.launch(headless=False, slow_mo=50)
```

## Record scripts

Command Line Interface [CLI](./cli.md) can be used to record user interactions and generate Python code.

```bash
playwright codegen wikipedia.org
```

## With Pytest

See [here](./test-runners.md) for Pytest instructions and examples.

## Interactive mode (REPL)

Blocking REPL, as in CLI via Python directly:

```bash
python
```

```py
>>> from playwright.sync_api import sync_playwright
>>> playwright = sync_playwright().start()
# Use playwright.chromium, playwright.firefox or playwright.webkit
# Pass headless=False to launch() to see the browser UI
>>> browser = playwright.chromium.launch()
>>> page = browser.new_page()
>>> page.goto("http://whatsmyuseragent.org/")
>>> page.screenshot(path="example.png")
>>> browser.close()
>>> playwright.stop()
```

Async REPL such as `asyncio` REPL:

```bash
python -m asyncio
```

```py
>>> from playwright.async_api import async_playwright
>>> playwright = await async_playwright().start()
>>> browser = await playwright.chromium.launch()
>>> page = await browser.new_page()
>>> await page.goto("http://whatsmyuseragent.org/")
>>> await page.screenshot(path="example.png")
>>> await browser.close()
>>> await playwright.stop()
```

## Known issues

### `time.sleep()` leads to outdated state

You should use `page.wait_for_timeout(5000)` instead of `time.sleep(5)` and it is better to not wait for a timeout at all, but sometimes it is useful for debugging. In these cases, use our wait method instead of the `time` module. This is because we internally rely on asynchronous operations and when using `time.sleep(5)` they can't get processed correctly.

## System requirements

Playwright requires Python 3.7 or above. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

### Windows

Works with Windows and Windows Subsystem for Linux (WSL).

### macOS

Requires 10.14 (Mojave) or above.

### Linux

Depending on your Linux distribution, you might need to install additional
dependencies to run the browsers.

:::note
Only Ubuntu 18.04 and Ubuntu 20.04 are officially supported.
:::

See also in the [Command Line Interface](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.
