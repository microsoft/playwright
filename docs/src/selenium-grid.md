---
id: selenium-grid
title: "Selenium Grid"
---

Playwright can connect to [Selenium Grid Hub](https://www.selenium.dev/documentation/grid/) to launch **Chrome** browser, instead of running browser on the local machine. To enable this mode, set `SELENIUM_REMOTE_URL` environment variable pointing to your Selenium Grid Hub.

```bash js
# Playwright Test
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub npx playwright test

# Playwright Library
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub node script.js
```

```bash python
# With Pytest
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub pytest --browser chromium

# Plain Python
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub python script.py
```

```bash java
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub mvn test
```

```bash csharp
SELENIUM_REMOTE_URL=http://internal.grid:4444/wd/hub dotnet test
```

You don't have to change your code, just use [`method: BrowserType.launch`] as usual.

When using Selenium Grid Hub, you can [skip browser downloads](./browsers.md#skip-browser-downloads).

:::note
Internally, Playwright connects to the browser using [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) websocket. This requires Selenium Grid nodes to be directly accessible from the machine that runs Playwright.
:::
