---
id: test-snapshots
title: "Visual comparisons"
---

Playwright Test includes the ability to produce and visually compare screenshots using `expect(value).toMatchSnapshot(snapshotName)`. On first execution, Playwright test will generate reference screenshots. Subsequent runs will compare against the reference.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('snapshot-name.png');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('snapshot-name.png');
});
```

Sometimes you need to update the reference screenshot, for example when the page has changed. Do this with the  `--update-snapshots` flag.

```bash
npx playwright test --update-snapshots
```

Playwright Test uses the [pixelmatch](https://github.com/mapbox/pixelmatch) library. You can pass comparison `threshold` as an option.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('home.png', { threshold: 0.2 });
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('home.png', { threshold: 0.2 });
});
```

Apart from screenshots, `expect(value).toMatchSnapshot(snapshotName)` can also be used to compare text, png and jpeg images, or arbitrary binary data. Playwright Test auto-detects the content type and uses the appropriate comparison algorithm.

Here we compare text content against the reference.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.textContent('.hero__title')).toMatchSnapshot('hero.txt');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.textContent('.hero__title')).toMatchSnapshot('hero.txt');
});
```

Snapshots are stored next to the test file, in a separate directory. For example, `my.spec.ts` file will produce and store snapshots in the `my.spec.ts-snapshots` directory. You should commit this directory to your version control (e.g. `git`), and review any changes to it.
