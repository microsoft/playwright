---
id: test-projects
title: "Projects"
---


Playwright supports multiple **projects** so you can run your tests in multiple browsers such as chromium, webkit and firefox browsers as well as branded browsers such as Google Chrome and Microsoft Edge. Playwright can also run on emulated tablet and mobile devices. See the [registry of device parameters](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json) for a complete list of selected desktop, tablet and mobile devices. 

Each project is given a name and a set of options which are configured in the `use` object.

## Project Configuration


```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
```
## Running tests on projects

Playwright will run all projects by default.

```bash
npx playwright test

Running 7 tests using 5 workers

  ✓ [chromium] › example.spec.ts:3:1 › basic test (2s)
  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
  ✓ [webkit] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Chrome] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Safari] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Microsoft Edge] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Google Chrome] › example.spec.ts:3:1 › basic test (2s)
```

Use the `--project` command line option to run a single project.

```bash
npx playwright test --project=firefox

Running 1 test using 1 worker

  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
```

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown from the testing sidebar and choose another profile or modify the default profile by clicking **Select Default Profile** and select the browsers you wish to run your tests on.

<img width="1464" alt="selecting browsers" src="https://user-images.githubusercontent.com/13063165/221136731-9d4bc18f-38a4-4adb-997b-5b98c98aec7f.png" />

Choose a specific profile, various profiles or all profiles to run tests on.

<img width="1536" alt="choosing default profiles" src="https://user-images.githubusercontent.com/13063165/221669537-e5df8672-f50d-4ff1-96f9-141cd67e12f8.png" />

## Multiple configurations

You can also use projects to run the same tests in different configurations. For example, you can run the same tests in a logged-in and logged-out state.

Note that each [test project](#projects) can provide its own [options][TestProject], for example two projects can run different tests by providing different `testDir`s.

Here is an example that defines a common timeout and two projects. The "Smoke" project runs a small subset of tests without retries, and "Default" project runs all other tests with retries.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60000, // Timeout is shared between all tests.
  projects: [
    {
      name: 'Smoke',
      testMatch: /.*smoke.spec.ts/,
      retries: 0,
    },
    {
      name: 'Default',
      testIgnore: /.*smoke.spec.ts/,
      retries: 2,
    },
  ],
});
```
