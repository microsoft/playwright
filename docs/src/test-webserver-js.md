---
id: test-webserver
title: "Web server"
---

## Introduction

Playwright comes with a `webserver` option in the config file which gives you the ability to launch a local dev server before running your tests. This is ideal for when writing your tests during development and when you don't have a staging or production url to test against.

## Configuring a web server

Use the `webserver` property in your Playwright config to launch a development web server during the tests.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

| Property | Description |
| :- | :- |
| [`property: TestConfig.webServer`] | Launch a development web server (or multiple) during the tests. |
| `command`| Shell command to start the local dev server of your app. |
| `cwd` | Current working directory of the spawned process, defaults to the directory of the configuration file. |
| `env` | Environment variables to set for the command, `process.env` by default. |
| `gracefulShutdown` | How to shut down the process. If unspecified, the process group is forcefully `SIGKILL`ed. If set to `{ signal: 'SIGTERM', timeout: 500 }`, the process group is sent a `SIGTERM` signal, followed by `SIGKILL` if it doesn't exit within 500ms. You can also use `SIGINT` as the signal instead. A `0` timeout means no `SIGKILL` will be sent. Windows doesn't support `SIGTERM` and `SIGINT` signals, so this option is ignored on Windows. Note that shutting down a Docker container requires `SIGTERM`. |
| `ignoreHTTPSErrors` | Whether to ignore HTTPS errors when fetching the `url`. Defaults to `false`. |
| `name` | Specifies a custom name for the web server. This name will be prefixed to log messages. Defaults to `[WebServer]`. |
| `reuseExistingServer`| If `true`, it will re-use an existing server on the url when available. If no server is running on that url, it will run the command to start a new server. If `false`, it will throw if an existing process is listening on the url. To see the stdout, you can set the `DEBUG=pw:webserver` environment variable. |
| `stderr` | Whether to pipe the stderr of the command to the process stderr or ignore it. Defaults to `"pipe"`. |
| `stdout` | If `"pipe"`, it will pipe the stdout of the command to the process stdout. If `"ignore"`, it will ignore the stdout of the command. Default to `"ignore"`. |
| `timeout` | How long to wait for the process to start up and be available in milliseconds. Defaults to 60000. |
| `url`| URL of your http server that is expected to return a 2xx, 3xx, 400, 401, 402, or 403 status code when the server is ready to accept connections. |

## Adding a server timeout

Webservers can sometimes take longer to boot up. In this case, you can increase the timeout to wait for the server to start.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Rest of your config...

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## Adding a baseURL

It is also recommended to specify the `baseURL` in the `use: {}` section of your config, so that tests can use relative urls and you don't have to specify the full URL over and over again. 

When using [`method: Page.goto`], [`method: Page.route`], [`method: Page.waitForURL`], [`method: Page.waitForRequest`], or [`method: Page.waitForResponse`] it takes the base URL in consideration by using the [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor for building the corresponding URL. For Example, by setting the baseURL to `http://localhost:3000` and navigating to `/login` in your tests, Playwright will run the test using `http://localhost:3000/login`.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Rest of your config...

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

Now you can use a relative path when navigating the page:

```js title="test.spec.ts"
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // This will navigate to http://localhost:3000/login
  await page.goto('./login');
});
```

## Multiple web servers

Multiple web servers (or background processes) can be launched simultaneously by providing an array of `webServer` configurations. See [`property: TestConfig.webServer`] for more info.


```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      name: 'Frontend',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run backend',
      url: 'http://localhost:3333',
      name: 'Backend',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ],
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```
