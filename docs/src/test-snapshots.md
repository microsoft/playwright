---
id: test-snapshots
title: "Snapshots"
---

Playwright Test includes the ability to produce and compare snapshots. For that, use `expect(value).toMatchSnapshot()`. Test runner auto-detects the content type, and includes built-in matchers for text, png and jpeg images, and arbitrary binary data.

```js
// example.spec.js
const { test, expect } = require('playwright/test');

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('optional-snapshot-name.png');
});
```

```ts
// example.spec.ts
import { test, expect } from 'playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('optional-snapshot-name.png');
});
```

Snapshots are stored next to the test file, in a separate directory. For example, `my.spec.js` file will produce and store snapshots in the `my.spec.js-snapshots` directory. You should commit this directory to your version control (e.g. `git`), and review any changes to it.
