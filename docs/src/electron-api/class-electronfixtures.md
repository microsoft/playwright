# class: ElectronFixtures
* since: v1.60
* langs: js

The `@playwright/electron` package exposes a `test` object with a set of fixtures tailored for Electron automation. Fixtures are used to establish the environment for each test, giving the test everything it needs and nothing else.

```js
import { test, expect } from '@playwright/electron';

test('basic test', async ({ page }) => {
  // ...
});
```

Given the test above, Playwright Test will launch the Electron application, wait for its first window, and expose it as the `page` fixture. Underneath, the [`property: ElectronFixtures.app`] fixture launches the application via [`method: Electron.launch`] using [`property: ElectronFixtures.appOptions`]. The application is closed after the test finishes.

## property: ElectronFixtures.app
* since: v1.60
- type: <[ElectronApplication]>

[ElectronApplication] instance, created for each test by launching Electron with [`property: ElectronFixtures.appOptions`]. The application is closed after the test finishes.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test.use({ appOptions: { args: ['main.js'] } });

test('scripts the main process', async ({ app }) => {
  const appPath = await app.evaluate(({ app }) => app.getAppPath());
  expect(appPath).toBeTruthy();
});
```

## property: ElectronFixtures.appOptions
* since: v1.60
- type: <[Object]>

Options passed to [`method: Electron.launch`] when creating the [`property: ElectronFixtures.app`]. Override via `use` in the config file or `test.use()` to point at your Electron entry point and configure the launch.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/electron';

export default defineConfig({
  use: {
    appOptions: {
      args: ['main.js'],
      env: { NODE_ENV: 'test' },
    },
  },
});
```

## property: ElectronFixtures.context
* since: v1.60
- type: <[BrowserContext]>

[BrowserContext] of the launched Electron app. All windows of the Electron application belong to this context.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test('routes network', async ({ context, page }) => {
  await context.route('**/api/**', route => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('https://example.com/api/data');
});
```

## property: ElectronFixtures.page
* since: v1.60
- type: <[Page]>

First window of the launched Electron app, as returned by [`method: ElectronApplication.firstWindow`]. This is the most common fixture used in an Electron test.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test('interacts with the first window', async ({ page }) => {
  await page.setContent('<h1>Hello</h1>');
  await expect(page.locator('h1')).toHaveText('Hello');
});
```
