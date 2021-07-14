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
  expect(await page.screenshot()).toMatchSnapshot('landing.png');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  expect(await page.screenshot()).toMatchSnapshot('landing.png');
});
```

When you run above for the first time, test runner will say:
```
Error: example.spec.ts-snapshots/landing-chromium-darwin.png is missing in snapshots, writing actual.
```

That's because there was no golden file for your `landing.png` snapshot. It is now created and is ready to be added to the repository. The name of the folder with the golden expectations starts with the name of your test file:

```bash
drwxr-xr-x  5 user  group  160 Jun  4 11:46 .
drwxr-xr-x  6 user  group  192 Jun  4 11:45 ..
-rw-r--r--  1 user  group  231 Jun  4 11:16 example.spec.ts
drwxr-xr-x  3 user  group   96 Jun  4 11:46 example.spec.ts-snapshots
```

Note the `chromium-darwin` in the generated snapshot file name - it contains the browser name and the platform. Screenshots differ between browsers and platforms due to different rendering, fonts and more, so you will need different snapshots for them. If you use multiple projects in your [configuration file](./test-configuration.md), project name will be used instead of `chromium`.

Sometimes you need to update the reference screenshot, for example when the page has changed. Do this with the  `--update-snapshots` flag.

```bash
npx playwright test --update-snapshots
```

Note that `snapshotName` is *not a path* relative to the test file, so don't try to use it like `expect(value).toMatchSnapshot('../../test-snapshots/snapshot.png')`.

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

If you'd like to share the default value among all the tests in the project, you can specify it in the playwright config, either globally or per project:

```js js-flavor=js
module.exports = {
  expect: {
    toMatchSnapshot: { threshold: 0.1 },
  },
};
```

```js js-flavor=ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  expect: {
    toMatchSnapshot: { threshold: 0.1 },
  },
};
export default config;
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
