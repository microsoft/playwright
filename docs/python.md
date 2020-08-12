# Playwright for Python

[Plawright Python](https://github.com/microsoft/playwright-python) is an official Python version of Playwright, it provides the full feature set of Playwright in an async (async/await) and sync version.

## Installation

To install the library via [pip](https://pypi.org/project/playwright/) and the browsers, you need to execute the following:

```
pip install playwright
python -m playwright install
```

## Usage

For most use cases its more convenient to use the sync variant of Playwright because then inline REPLs like pdb/ipython or the Visual Studio Code debugger automatically returns the correct value. A basic example to make a screenshot with all the browser engines would look like as follows:

```py
from playwright import sync_playwright

with sync_playwright() as p:
    for browser_type in [p.chromium, p.firefox, p.webkit]:
        browser = browser_type.launch()
        page = browser.newPage()
        page.goto('http://whatsmyuseragent.org/')
        page.screenshot(path=f'example-{browser_type.name}.png')
        browser.close()
```

The async alternative would look like that:

```py
import asyncio
from playwright import async_playwright

async def main():
    async with async_playwright() as p:
        for browser_type in [p.chromium, p.firefox, p.webkit]:
            browser = await browser_type.launch()
            page = await browser.newPage()
            await page.goto('http://whatsmyuseragent.org/')
            await page.screenshot(path=f'example-{browser_type.name}.png')
            await browser.close()

asyncio.get_event_loop().run_until_complete(main())
```

## Further reference

For more information about it especially about how to use the methods, evaluating JavaScript, or waiting for events you'll find a full reference in the [GitHub](https://github.com/microsoft/playwright-python#readme) repository.
