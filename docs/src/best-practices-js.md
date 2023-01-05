---
id: best-practices
title: "Best Practices"
---


This guide should help you to make sure you are following our best practices and writing tests that are more resilient.
## Use locators

In order to write end to end tests we need to first find elements on the webpage. Automated tests should verify that the application code works for the end users. Implementation details are things which users of your code will not typically use, see, or even know about such as the name of a function or if it's an array. The end user will see or interact with what we render so our test should typically only see/interact with the rendered output.

Use Playwright's built in [locators](./locators.md) to find element(s) on the page. Locators come with auto waiting and retry-ability. Auto waiting means that Playwright performs a range of actionability checks on the elements, such as ensuring the element is visible and enabled before it performs the click. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts.

```js
👍 page.getByRole('button', { name: 'submit' })
```

#### Prefer user-facing attributes to xpath or css selectors

Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests. For example consider selecting this button by its CSS classes. Should the designer change something then the class might change breaking your test. 


```js
👎 page.locator('button.buttonIcon.episode-actions-later')
```

Use locators that are resilient to changes in the DOM.

```js
👍 page.getByRole('button', { name: 'submit' })
```
## Generate locators

Playwright has a [test generator](./codegen.md) that can generate tests and pick locators for you. It will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

#### Use the codegen to generate locators

To pick a locator you can run the codegen command and click on the pick locator button. Then hover over your page in the browser window and click on the element you want to pick. You can then copy and paste this locator into your code. You can also use the codegen to record a test for you.

```bash
npx playwright codegen
```
#### Use the VS Code extension to generate locators

You can also use the [VS Code Extension](./getting-started-vscode.md) to generate locators as well as record a test. The VS Code extension also gives you a great developer experience when writing, running and debugging tests.

## Use web first assertions

Assertions are a way to verify that the expected result and the actual result matched or not. By using [web first assertions](./test-assertions.md) Playwright will wait until the expected condition is met. For Example when testing a toast message, if you click a button that makes a toast message appear you can test the toast message is there. If the toast takes half a second to appear Playwright will wait. Web assertions such as `toBeVisible()` will wait and retry.

```js
👍 await expect(page.getByText('welcome')).toBeVisible();
```

#### Don't use manual assertions

Don't use manual assertions that are not awaiting the expect. In the code below the await is inside the expect rather than before it. When using assertions such as `isVisible()` the test wont wait a single second, it will just check the locator is there and return immediately. Use web first assertions such as `toBeVisible()` instead.

```js
👎 expect(await page.getByText('welcome').isVisible()).toBe(true);
```

Use web first assertions such as `toBeVisible()` instead.

```js
👍 await expect(page.getByText('welcome')).toBeVisible();
```
## Configure post-mortem debugging

Use the playwright [trace viewer](./trace-viewer.md) for local debugging and post mortem debugging instead of videos and screenshots. The trace viewer gives you a full trace of your tests as a local PWA that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.

Traces are set to run on CI on the first retry of a failed test. However you can also run a trace locally when developing.

```js
npx playwright test --trace on
```
## Mock API responses

Only test what you control. Don't try to test links to external sites or third party servers that you do not control. Not only is it time consuming and can slow down your tests but also you can not control the content of the page you are linking to, if there are cookie banners or overlay pages or anything else that might cause your test to fail.

Intercepting the route with a mock response ensures the link is visible and clickable. Before hitting the link the route gets intercepted and a mock response is returned. Clicking the link results in a new page being opened containing the mock response rather than the actual page. We can then check this has the URL we expect.

```js
test('github link works', async ({ page }) => {
    await page.context().route('https://www.github.com/**', route => route.fulfill({
      body: '<html><body><h1>Github - Playwright</h1></body></html>'
    }));

    const [page1] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: 'linkedIn' }).click()
    ]);
    await expect(page1).toHaveURL('https://www.github.com/microsoft/playwright');
  });
```
## Use Playwright's Tooling

Playwright comes with a range of tooling to help you write tests. 
- The [VS Code extension](./getting-started-vscode.md) gives you a great developer experience when writing, running and debugging tests. 
- The [test generator](./codegen.md) can generate tests and pick locators for you.
- The [trace viewer](./trace-viewer.md) gives you a full trace of your tests as a local PWA that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.
- [Typescript](./test-typescript) in Playwright works out of the box and gives you better IDE integrations. When using VS Code it will show you everything you can do and highlight when you do something wrong. No TypeScript experience is needed and it is not necessary for your code to be in TypeScript, all you need to do is create your tests with a `.ts` extension.

## Test across all browsers

Playwright makes it easy to test your site across all [browsers](./test-configuration#multiple-browsers) no matter what platform you are on. Testing across all browsers ensures your app works for all users. In your config file you can set up projects adding the name and which browser or device to use.

```js tab=js-js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
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
  ],
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import { type PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
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
  ],
};
export default config;
```

## Keep your Playwright dependency up to date

By keeping your Playwright version up to date you will be able to test your app on the latest browser versions and catch failures before the latest browser version is released to the public. Check the [release notes](./release-notes.md) to see what the latest version is and what changes have been released. Releases happen on a monthly basis.

```js
npm install -D @playwright/test@latest
```

## Run tests on CI

Setup CI/CD and run your tests frequently. The more often you run your tests the better. Ideally you should run your tests on each commit and pull request. Use [parallelism and sharding](./test-parallel.md).

Use linux when running your tests on CI as it is cheaper. Developers can use whatever environment when running locally but use linux on CI.

If working with a database then make sure you control the data. Test against a staging environment and make sure it doesn't change. For visual regression tests make sure the operating system and browser versions are the same.
