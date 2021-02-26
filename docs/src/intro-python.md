---
id: intro
title: "Getting Started"
---

<!-- TOC -->
- [Release notes](./release-notes.md)

## Installation

Use pip to install Playwright in your Python project. See [system requirements](#system-requirements).

```sh
$ pip install playwright
$ playwright install
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
    page = await browser.new_page()
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

```sh
$ playwright codegen wikipedia.org
```

## System requirements

Playwright requires Python version 3.7 or above. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

* **Windows**: Works with Windows and Windows Subsystem for Linux (WSL).
* **macOS**: Requires 10.14 or above.
* **Linux**: Depending on your Linux distribution, you might need to install additional
  dependencies to run the browsers.
  * Firefox requires Ubuntu 18.04+
  * For Ubuntu 18.04, the additional dependencies are defined in [our Docker image](https://github.com/microsoft/playwright/blob/master/utils/docker/Dockerfile.bionic),
    which is based on Ubuntu.
