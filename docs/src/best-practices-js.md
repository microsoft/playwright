---
id: best-practices
title: "Best Practices"
---


This guide should help you to make sure you are following our best practices and writing tests that are more resilient.

## Testing philosophy

### Test user-visible behavior

Automated tests should verify that the application code works for the end users, and avoid relying on implementation details such as things which users will not typically use, see, or even know about such as the name of a function, whether something is an array, or the CSS class of some element. The end user will see or interact with what is rendered on the page, so your test should typically only see/interact with the same rendered output.

### Make tests as isolated as possible

Each test should be completely isolated from another test and should run independently with its own local storage, session storage, data, cookies etc. [Test isolation](./browser-contexts.md) improves reproducibility, makes debugging easier and prevents cascading test failures.

In order to avoid repetition for a particular part of your test you can use [before and after hooks](/api/class-test.md) or [global setup](/auth.md#reuse-signed-in-state). Within your test file add a before hook to run a part of your test before each test such as going to a particular URL or logging in to a part of your app. This keeps your tests isolated as no test relies on another. However it is also ok to have a little duplication when tests are simple enough especially if it keeps your tests clearer and easier to read and maintain.

### Write fewer tests but longer tests

When it comes to end to end testing having long tests is not a bad thing. It's ok to have multiple actions and assertions in your test so you can test complete App flows. You should avoid separating your assertions into individual test blocks as it doesn't really bring much value and just slows down the running of your tests. 

If your test does fail, Playwright will give you an error message showing what part of the test failed which you can see either in VS Code, the terminal, the HTML report, or the trace viewer. You can also use [soft assertions](/test-assertions.md#soft-assertions) which do not terminate test execution but mark the test as failed.

### Avoid testing third-party dependencies

Only test what you control. Don't try to test links to external sites or third party servers that you do not control. Not only is it time consuming and can slow down your tests but also you can not control the content of the page you are linking to, if there are cookie banners or overlay pages or anything else that might cause your test to fail.

### Testing with a database

If working with a database then make sure you control the data. Test against a staging environment and make sure it doesn't change. For visual regression tests make sure the operating system and browser versions are the same.

## Best Practices

### Use locators

In order to write end to end tests we need to first find elements on the webpage. We can do this by using Playwright's built in [locators](./locators.md). Locators come with auto waiting and retry-ability. Auto waiting means that Playwright performs a range of actionability checks on the elements, such as ensuring the element is visible and enabled before it performs the click. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts.

```js
👍 page.getByRole('button', { name: 'submit' })
```

#### Use chaining and filtering

Locators can be [chained](./locators.md#chaining-locators) to narrow down the search to a particular part of the page.

```js
const product = page.getByRole('listitem').filter({ hasText: 'Product 2' });
```

You can also [filter locators](./locators.md#filtering-locators) by text or by another locator.

```js
await page
    .getByRole('listitem')
    .filter({ hasText: 'Product 2' })
    .getByRole('button', { name: 'Add to cart' })
    .click();
```

#### Prefer user-facing attributes to XPath or CSS selectors

Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests. For example consider selecting this button by its CSS classes. Should the designer change something then the class might change breaking your test. 


```js
👎 page.locator('button.buttonIcon.episode-actions-later')
```

Use locators that are resilient to changes in the DOM.

```js
👍 page.getByRole('button', { name: 'submit' })
```
### Generate locators

Playwright has a [test generator](./codegen.md) that can generate tests and pick locators for you. It will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

#### Use `codegen` to generate locators

To pick a locator you can run the `codegen` command and click on the pick locator button. Then hover over your page in the browser window and click on the element you want to pick. You can then copy and paste this locator into your code. You can also use `codegen` to record a test for you.

```bash
npx playwright codegen
```
#### Use the VS Code extension to generate locators

You can also use the [VS Code Extension](./getting-started-vscode.md) to generate locators as well as record a test. The VS Code extension also gives you a great developer experience when writing, running, and debugging tests.

### Use web first assertions

Assertions are a way to verify that the expected result and the actual result matched or not. By using [web first assertions](./test-assertions.md) Playwright will wait until the expected condition is met. For example, when testing an alert message, a test would click a button that makes a message appear and check that the alert message is there. If the alert message takes half a second to appear, assertions such as `toBeVisible()` will wait and retry if needed.

```js
👍 await expect(page.getByText('welcome')).toBeVisible();

👎 expect(await page.getByText('welcome').isVisible()).toBe(true);
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

### Configure debugging

#### Local debugging

For local debugging we recommend you [debug your tests live in VSCode.](/getting-started-vscode.md#live-debugging) by installing the [VS Code extension](./getting-started-vscode.md). Running the tests in debug mode by right clicking on the line next to the test you want to run will open a browser window and pause at where the breakpoint is set. You can then modify your test right in VS Code while debugging.

You can also debug your tests with the Playwright inspector by running your tests with the `--debug` flag. You can then step through your test as well as view actionability logs, or use the pick locator button to explore other available locators on the page.

```js
npx playwright test --debug
```

To debug a specific test at a specific point add the name of the test followed by the line number before the `--debug` flag.

```js
npx playwright test example.spec.ts:42 --debug
```
#### Debugging on CI

For CI failures, use the Playwright [trace viewer](./trace-viewer.md) instead of videos and screenshots. The trace viewer gives you a full trace of your tests as a local Progressive Web App (PWA) that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.

Traces are set to run on CI on the first retry of a failed test. We don't recommend setting this to `on` so that traces are run on every test as it's very performance heavy. However you can run a trace locally when developing with the `--trace` flag.

```js
npx playwright test --trace on
```
### Use Playwright's Tooling

Playwright comes with a range of tooling to help you write tests. 
- The [VS Code extension](./getting-started-vscode.md) gives you a great developer experience when writing, running, and debugging tests. 
- The [test generator](./codegen.md) can generate tests and pick locators for you.
- The [trace viewer](./trace-viewer.md) gives you a full trace of your tests as a local PWA that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.
- [Typescript](./test-typescript) in Playwright works out of the box and gives you better IDE integrations. Your IDE will show you everything you can do and highlight when you do something wrong. No TypeScript experience is needed and it is not necessary for your code to be in TypeScript, all you need to do is create your tests with a `.ts` extension.

### Test across all browsers

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

### Mock third-party Links

If you want to test links to third party API's then you should intercept the route with a mock response. This ensures the link is visible and clickable. Before hitting the link the route gets intercepted and a mock response is returned. Clicking the link results in a new page being opened containing the mock response rather than the actual page. We can then check this has the URL we expect.

```js
test('github link works', async ({ page }) => {
    await page.context().route('https://www.github.com/**', route => route.fulfill({
      body: '<html><body><h1>Github - Playwright</h1></body></html>'
    }));

    const [page1] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: 'GitHub' }).click()
    ]);
    await expect(page1).toHaveURL('https://www.github.com/microsoft/playwright');
  });
```

### Keep your Playwright dependency up to date

By keeping your Playwright version up to date you will be able to test your app on the latest browser versions and catch failures before the latest browser version is released to the public. Check the [release notes](./release-notes.md) to see what the latest version is and what changes have been released.

```js
npm install -D @playwright/test@latest
```

### Run tests on CI

Setup CI/CD and run your tests frequently. The more often you run your tests the better. Ideally you should run your tests on each commit and pull request. Playwright comes with a [GitHub actions workflow](/ci-intro.md) already setup so that tests will run on CI for you with no setup required. Playwright can also be setup on the [CI environment](/ci.md) of your choice. 

Use [parallelism and sharding](./test-parallel.md). Playwright runs tests in parallel by default. Tests in a single file are run in order, in the same worker process. Playwright can [shard]./test-parallel.md##shard-tests-between-multiple-machines) a test suite, so that it can be executed on multiple machines

Use Linux when running your tests on CI as it is cheaper. Developers can use whatever environment when running locally but use linux on CI.
