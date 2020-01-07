# Playwright

[![npm version](https://badge.fury.io/js/playwright.svg)](https://badge.fury.io/js/playwright)

Playwright is a Node library to automate web browsers (Chromium, Webkit and Firefox).

## Getting started

### Installation

```
npm i playwright
```

### Usage

Playwright can be used to create a browser instance, open pages, and then manipulate them. See [API docs](https://github.com/microsoft/playwright/blob/master/docs/api.md) for a comprehensive list.

#### Example

This code snippet navigates to example.com in the Webkit browser, and saves a screenshot.

```js
const pw = require('playwright');

(async () => {
    const browser = await pw.playwright('webkit').launch(); // or 'chromium', 'firefox'
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://www.example.com/');
    await page.screenshot({ path: 'example.png' });

    await browser.close();
})();
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
