---
id: test-snapshots
title: "Visual comparisons"
---

Playwright Test includes the ability to produce and visually compare screenshots using `await expect(page).toHaveScreenshot()`. On first execution, Playwright test will generate reference screenshots. Subsequent runs will compare against the reference.

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  await expect(page).toHaveScreenshot();
});
```

When you run above for the first time, test runner will say:

```txt
Error: A snapshot doesn't exist at example.spec.ts-snapshots/example-test-1-chromium-darwin.png, writing actual.
```

That's because there was no reference screenshot yet. This method took a bunch of screenshots until two consecutive
screenshots matched, and saved the last screenshot to file system. It is now ready to be added to the repository. You should review any changes to the reference screenshots to make sure they are expected.

The name of the folder with the reference screenshots starts with the name of your test file:

```bash
drwxr-xr-x  5 user  group  160 Jun  4 11:46 .
drwxr-xr-x  6 user  group  192 Jun  4 11:45 ..
-rw-r--r--  1 user  group  231 Jun  4 11:16 example.spec.ts
drwxr-xr-x  3 user  group   96 Jun  4 11:46 example.spec.ts-snapshots
```

The name of the reference screenshot `example-test-1-chromium-darwin.png` consists of a few parts:
- `example-test-1.png` - an auto-generated name of the snapshot. Alternatively you can specify snapshot name as the first argument of the `toHaveScreenshot()` method:
    ```js
    await expect(page).toHaveScreenshot('landing.png');
    ```

- `chromium-darwin` - the browser name and the platform. Screenshots differ between browsers and platforms due to different rendering, fonts and more, so you will need different snapshots for them. If you use multiple projects in your [configuration file](./test-configuration.md), project name will be used instead of `chromium`.

You can customize the name and the path of the reference screnshot by modifying [`property: TestProject.snapshotPathTemplate`] property in the config file.

Sometimes you need to update the reference screenshot, for example when the page has changed. Do this with the  `--update-snapshots` flag.

```bash
npx playwright test --update-snapshots
```

Playwright Test uses the [pixelmatch](https://github.com/mapbox/pixelmatch) library. You can [pass various options](./api/class-pageassertions.md#page-assertions-to-have-screenshot-1) to modify its behavior:

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev');
  await expect(page).toHaveScreenshot({ maxDiffPixels: 100 });
});
```

If you'd like to share the default value among all the tests in the project, you can specify it in the playwright config, either globally or per project:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
});
```

If you are not on the same operating system as your CI system, you can use Docker to generate/update the screenshots:

```bash
docker run --rm --network host -v $(pwd):/work/ -w /work/ -it mcr.microsoft.com/playwright:v%%VERSION%%-jammy /bin/bash
npm install
npx playwright test --update-snapshots
```
