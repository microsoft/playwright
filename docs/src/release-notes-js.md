---
id: release-notes
title: "Release notes"
---

<!-- TOC -->

## Version 1.19

### Playwright Test Update

- Playwright Test v1.19 now supports *soft assertions*. Failed soft assertions
  **do not** terminate test execution, but mark the test as failed.

  ```js
  // Make a few checks that will not stop the test when failed...
  await expect.soft(page.locator('#status')).toHaveText('Success');
  await expect.soft(page.locator('#eta')).toHaveText('1 day');

  // ... and continue the test to check more things.
  await page.locator('#next-page').click();
  await expect.soft(page.locator('#title')).toHaveText('Make another order');
  ```

  Read more in [our documentation](./test-assertions#soft-assertions)

- You can now specify a **custom error message** as a second argument to the `expect` and `expect.soft` functions, for example:

  ```js
  await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
  ```

  The error would look like this:

  ```bash
      Error: should be logged in

      Call log:
        - expect.toBeVisible with timeout 5000ms
        - waiting for selector "text=Name"


        2 |
        3 | test('example test', async({ page }) => {
      > 4 |   await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
          |                                                                  ^
        5 | });
        6 |
  ```

  Read more in [our documentation](./test-assertions#custom-error-message)
- By default, tests in a single file are run in order. If you have many independent tests in a single file, you can now
  run them in parallel with [`method: Test.describe.configure`].


## Other Updates

- Locator now supports a `has` option that makes sure it contains another locator inside:

  ```js
  await page.locator('article', {
    has: page.locator('span'),
  }).click();
  ```

  Read more in [locator documentation](./api/class-locator#locator-locator-option-has)

- New [`method: Locator.page`]
- [`method: Page.screenshot`] now automatically hides blinking caret
- Playwright Codegen now generates locators and frame locators
- `testConfig.webServer.url` is new, `testConfig.webServer.port` is now optional
- New [`property: TestInfo.errors`]


## Potentially breaking change in Playwright Test Global Setup

It is unlikely that this change will affect you, no action is required if your tests keep running as they did.

We've noticed that in rare cases, the set of tests to be executed was configured in the global setup by means of the environment variables. We also noticed some applications that were post processing the reporters' output in the global teardown. If you are doing one of the two, [learn more](https://github.com/microsoft/playwright/issues/12018)

## Version 1.18

### Locator Improvements

- [`method: Locator.dragTo`]
- [`expect(locator).toBeChecked({ checked })`](./api/class-locatorassertions#locator-assertions-to-be-checked)
- Each locator can now be optionally filtered by the text it contains:
    ```js
    await page.locator('li', { hasText: 'my item' }).locator('button').click();
    ```
    Read more in [locator documentation](./api/class-locator#locator-locator-option-has-text)


### Testing API improvements

- [`expect(response).toBeOK()`](./api/class-apiresponseassertions)
- [`testInfo.attach()`](./api/class-testinfo#test-info-attach)
- [`test.info()`](./api/class-test#test-info)

### Improved TypeScript Support

1. Playwright Test now respects `tsconfig.json`'s [`baseUrl`](https://www.typescriptlang.org/tsconfig#baseUrl) and [`paths`](https://www.typescriptlang.org/tsconfig#paths), so you can use aliases
1. There is a new environment variable `PW_EXPERIMENTAL_TS_ESM` that allows importing ESM modules in your TS code, without the need for the compile step. Don't forget the `.js` suffix when you are importing your esm modules. Run your tests as follows:

```bash
npm i --save-dev @playwright/test@1.18.0-rc1
PW_EXPERIMENTAL_TS_ESM=1 npx playwright test
```

### Create Playwright

The `npm init playwright` command is now generally available for your use:

```sh
# Run from your project's root directory
npm init playwright
# Or create a new project
npm init playwright new-project
```

This will create a Playwright Test configuration file, optionally add examples, a GitHub Action workflow and a first test `example.spec.ts`.

### New APIs & changes

- new [`testCase.repeatEachIndex`](./api/class-testcase#test-case-repeat-each-index) API
- [`acceptDownloads`](./api/class-browser#browser-new-context-option-accept-downloads) option now defaults to `true`

### Breaking change: custom config options

Custom config options are a convenient way to parametrize projects with different values. Learn more in [this guide](./test-parameterize#parameterized-projects).

Previously, any fixture introduced through [`method: Test.extend`] could be overridden in the [`property: TestProject.use`] config section. For example,

```js
// WRONG: THIS SNIPPET DOES NOT WORK SINCE v1.18.

// fixtures.js
const test = base.extend({
  myParameter: 'default',
});

// playwright.config.js
module.exports = {
  use: {
    myParameter: 'value',
  },
};
```

The proper way to make a fixture parametrized in the config file is to specify `option: true` when defining the fixture. For example,

```js
// CORRECT: THIS SNIPPET WORKS SINCE v1.18.

// fixtures.js
const test = base.extend({
  // Fixtures marked as "option: true" will get a value specified in the config,
  // or fallback to the default value.
  myParameter: ['default', { option: true }],
});

// playwright.config.js
module.exports = {
  use: {
    myParameter: 'value',
  },
};
```

### Browser Versions

- Chromium 99.0.4812.0
- Mozilla Firefox 95.0
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 97
- Microsoft Edge 97


## Version 1.17

### Frame Locators

Playwright 1.17 introduces [frame locators](./api/class-framelocator) - a locator to the iframe on the page. Frame locators capture the logic sufficient to retrieve the `iframe` and then locate elements in that iframe. Frame locators are strict by default, will wait for `iframe` to appear and can be used in Web-First assertions.

![Graphics](https://user-images.githubusercontent.com/746130/142082759-2170db38-370d-43ec-8d41-5f9941f57d83.png)

Frame locators can be created with either [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```js
const locator = page.frameLocator('#my-iframe').locator('text=Submit');
await locator.click();
```

Read more at [our documentation](./api/class-framelocator).

### Trace Viewer Update

Playwright Trace Viewer is now **available online** at https://trace.playwright.dev! Just drag-and-drop your `trace.zip` file to inspect its contents.

> **NOTE**: trace files are not uploaded anywhere; [trace.playwright.dev](https://trace.playwright.dev) is a [progressive web application](https://web.dev/progressive-web-apps/) that processes traces locally.

- Playwright Test traces now include sources by default (these could be turned off with tracing option)
- Trace Viewer now shows test name
- New trace metadata tab with browser details
- Snapshots now have URL bar

![image](https://user-images.githubusercontent.com/746130/141877831-29e37cd1-e574-4bd9-aab5-b13a463bb4ae.png)

### HTML Report Update

- HTML report now supports dynamic filtering
- Report is now a **single static HTML file** that could be sent by e-mail or as a slack attachment.

![image](https://user-images.githubusercontent.com/746130/141877402-e486643d-72c7-4db3-8844-ed2072c5d676.png)

### Ubuntu ARM64 support + more

- Playwright now supports **Ubuntu 20.04 ARM64**. You can now run Playwright tests inside Docker on Apple M1 and on Raspberry Pi.
- You can now use Playwright to install stable version of Edge on Linux:
    ```bash
    npx playwright install msedge
    ```

### New APIs

- Tracing now supports a [`'title'`](./api/class-tracing#tracing-start-option-title) option
- Page navigations support a new [`'commit'`](./api/class-page#page-goto) waiting option
- HTML reporter got [new configuration options](./test-reporters#html-reporter)
- [`testConfig.snapshotDir` option](./api/class-testconfig#test-config-snapshot-dir)
- [`testInfo.parallelIndex`](./api/class-testinfo#test-info-parallel-index)
- [`testInfo.titlePath`](./api/class-testinfo#test-info-title-path)
- [`testOptions.trace`](./api/class-testoptions#test-options-trace) has new options
- [`expect.toMatchSnapshot`](./test-assertions#expectvaluetomatchsnapshotname-options) supports subdirectories
- [`reporter.printsToStdio()`](./api/class-reporter#reporter-prints-to-stdio)


## Version 1.16

### 🎭 Playwright Test

#### API Testing

Playwright 1.16 introduces new [API Testing](./api/class-apirequestcontext) that lets you send requests to the server directly from Node.js!
Now you can:

- test your server API
- prepare server side state before visiting the web application in a test
- validate server side post-conditions after running some actions in the browser

To do a request on behalf of Playwright's Page, use **new [`property: Page.request`] API**:

```ts
import { test, expect } from '@playwright/test';

test('context fetch', async ({ page }) => {
  // Do a GET request on behalf of page
  const response = await page.request.get('http://example.com/foo.json');
  // ...
});
```

To do a stand-alone request from node.js to an API endpoint, use **new [`request` fixture](./api/class-fixtures#fixtures-request)**:

```ts
import { test, expect } from '@playwright/test';

test('context fetch', async ({ request }) => {
  // Do a GET request on behalf of page
  const response = await request.get('http://example.com/foo.json');
  // ...
});
```

Read more about it in our [API testing guide](./test-api-testing).

#### Response Interception

It is now possible to do response interception by combining [API Testing](./test-api-testing) with [request interception](./network#modify-requests).

For example, we can blur all the images on the page:

```ts
import { test, expect } from '@playwright/test';
import jimp from 'jimp'; // image processing library

test('response interception', async ({ page }) => {
  await page.route('**/*.jpeg', async route => {
    const response = await page._request.fetch(route.request());
    const image = await jimp.read(await response.body());
    await image.blur(5);
    route.fulfill({
      response,
      body: await image.getBufferAsync('image/jpeg'),
    });
  });
  const response = await page.goto('https://playwright.dev');
  expect(response.status()).toBe(200);
});
```

Read more about [response interception](./network#modify-responses).

#### New HTML reporter

Try it out new HTML reporter with either `--reporter=html` or a `reporter` entry
in `playwright.config.ts` file:

```bash
$ npx playwright test --reporter=html
```

The HTML reporter has all the information about tests and their failures, including surfacing
trace and image artifacts.

![html reporter](https://user-images.githubusercontent.com/746130/138324311-94e68b39-b51a-4776-a446-f60037a77f32.png)

Read more about [our reporters](./test-reporters/#html-reporter).

### 🎭 Playwright Library

#### locator.waitFor

Wait for a locator to resolve to a single element with a given state.
Defaults to the `state: 'visible'`.

Comes especially handy when working with lists:

```ts
import { test, expect } from '@playwright/test';

test('context fetch', async ({ page }) => {
  const completeness = page.locator('text=Success');
  await completeness.waitFor();
  expect(await page.screenshot()).toMatchSnapshot('screen.png');
});
```

Read more about [`method: Locator.waitFor`].

### Docker support for Arm64

Playwright Docker image is now published for Arm64 so it can be used on Apple Silicon.

Read more about [Docker integration](./docker).

### 🎭 Playwright Trace Viewer

- web-first assertions inside trace viewer
- run trace viewer with `npx playwright show-trace` and drop trace files to the trace viewer PWA
- API testing is integrated with trace viewer
- better visual attribution of action targets

Read more about [Trace Viewer](./trace-viewer).

### Browser Versions

- Chromium 97.0.4666.0
- Mozilla Firefox 93.0
- WebKit 15.4

This version of Playwright was also tested against the following stable channels:

- Google Chrome 94
- Microsoft Edge 94


## Version 1.15

### 🎭 Playwright Library

#### 🖱️ Mouse Wheel

By using [`Page.mouse.wheel`](https://playwright.dev/docs/api/class-mouse#mouse-wheel) you are now able to scroll vertically or horizontally.

#### 📜 New Headers API

Previously it was not possible to get multiple header values of a response. This is now  possible and additional helper functions are available:

- [Request.allHeaders()](https://playwright.dev/docs/api/class-request#request-all-headers)
- [Request.headersArray()](https://playwright.dev/docs/api/class-request#request-headers-array)
- [Request.headerValue(name: string)](https://playwright.dev/docs/api/class-request#request-header-value)
- [Response.allHeaders()](https://playwright.dev/docs/api/class-response#response-all-headers)
- [Response.headersArray()](https://playwright.dev/docs/api/class-response#response-headers-array)
- [Response.headerValue(name: string)](https://playwright.dev/docs/api/class-response#response-header-value)
- [Response.headerValues(name: string)](https://playwright.dev/docs/api/class-response/#response-header-values)

#### 🌈 Forced-Colors emulation

Its now possible to emulate the `forced-colors` CSS media feature by passing it in the [context options](https://playwright.dev/docs/api/class-browser#browser-new-context-option-forced-colors) or calling [Page.emulateMedia()](https://playwright.dev/docs/api/class-page#page-emulate-media).

#### New APIs

- [Page.route()](https://playwright.dev/docs/api/class-page#page-route) accepts new `times` option to specify how many times this route should be matched.
- [Page.setChecked(selector: string, checked: boolean)](https://playwright.dev/docs/api/class-page#page-set-checked) and [Locator.setChecked(selector: string, checked: boolean)](https://playwright.dev/docs/api/class-locator#locator-set-checked) was introduced to set the checked state of a checkbox.
- [Request.sizes()](https://playwright.dev/docs/api/class-request#request-sizes) Returns resource size information for given http request.
- [BrowserContext.tracing.startChunk()](https://playwright.dev/docs/api/class-tracing#tracing-start-chunk) - Start a new trace chunk.
- [BrowserContext.tracing.stopChunk()](https://playwright.dev/docs/api/class-tracing#tracing-stop-chunk) - Stops a new trace chunk.

### 🎭 Playwright Test

#### 🤝 `test.parallel()` run tests in the same file in parallel

```ts
test.describe.parallel('group', () => {
  test('runs in parallel 1', async ({ page }) => {
  });
  test('runs in parallel 2', async ({ page }) => {
  });
});
```

By default, tests in a single file are run in order. If you have many independent tests in a single file, you can now run them in parallel with [test.describe.parallel(title, callback)](https://playwright.dev/docs/api/class-test#test-describe-parallel).

#### 🛠 Add `--debug` CLI flag

By using `npx playwright test --debug` it will enable the [Playwright Inspector](https://playwright.dev/docs/debug#playwright-inspector) for you to debug your tests.

### Browser Versions

- Chromium 96.0.4641.0
- Mozilla Firefox 92.0
- WebKit 15.0

## Version 1.14

### 🎭 Playwright Library

#### ⚡️ New "strict" mode

Selector ambiguity is a common problem in automation testing. **"strict" mode**
ensures that your selector points to a single element and throws otherwise.

Pass `strict: true` into your action calls to opt in.

```js
// This will throw if you have more than one button!
await page.click('button', { strict: true });
```

#### 📍 New [**Locators API**](./api/class-locator)

Locator represents a view to the element(s) on the page. It captures the logic sufficient to retrieve the element at any given moment.

The difference between the [Locator](./api/class-locator) and [ElementHandle](./api/class-elementhandle) is that the latter points to a particular element, while [Locator](./api/class-locator) captures the logic of how to retrieve that element.

Also, locators are **"strict" by default**!

```js
const locator = page.locator('button');
await locator.click();
```

Learn more in the [documentation](./api/class-locator).

#### 🧩 Experimental [**React**](./selectors#react-selectors) and [**Vue**](./selectors#vue-selectors) selector engines

React and Vue selectors allow selecting elements by its component name and/or property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

```js
await page.click('_react=SubmitButton[enabled=true]');
await page.click('_vue=submit-button[enabled=true]');
```

Learn more in the [react selectors documentation](./selectors#react-selectors) and the [vue selectors documentation](./selectors#vue-selectors).

#### ✨ New [**`nth`**](./selectors#n-th-element-selector) and [**`visible`**](./selectors#selecting-visible-elements) selector engines

- [`nth`](./selectors#n-th-element-selector) selector engine is equivalent to the `:nth-match` pseudo class, but could be combined with other selector engines.
- [`visible`](./selectors#selecting-visible-elements) selector engine is equivalent to the `:visible` pseudo class, but could be combined with other selector engines.

```js
// select the first button among all buttons
await button.click('button >> nth=0');
// or if you are using locators, you can use first(), nth() and last()
await page.locator('button').first().click();

// click a visible button
await button.click('button >> visible=true');
```

### 🎭 Playwright Test

#### ✅ Web-First Assertions

`expect` now supports lots of new web-first assertions.

Consider the following example:

```js
await expect(page.locator('.status')).toHaveText('Submitted');
```

Playwright Test will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"` text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is reached. You can either pass this timeout or configure it once via the [`testProject.expect`](./api/class-testproject/#test-project-expect) value in test config.

By default, the timeout for assertions is not set, so it'll wait forever, until the whole test times out.

List of all new assertions:

- [`expect(locator).toBeChecked()`](./test-assertions#expectlocatortobechecked)
- [`expect(locator).toBeDisabled()`](./test-assertions#expectlocatortobedisabled)
- [`expect(locator).toBeEditable()`](./test-assertions#expectlocatortobeeditable)
- [`expect(locator).toBeEmpty()`](./test-assertions#expectlocatortobeempty)
- [`expect(locator).toBeEnabled()`](./test-assertions#expectlocatortobeenabled)
- [`expect(locator).toBeFocused()`](./test-assertions#expectlocatortobefocused)
- [`expect(locator).toBeHidden()`](./test-assertions#expectlocatortobehidden)
- [`expect(locator).toBeVisible()`](./test-assertions#expectlocatortobevisible)
- [`expect(locator).toContainText(text, options?)`](./test-assertions#expectlocatortocontaintexttext-options)
- [`expect(locator).toHaveAttribute(name, value)`](./test-assertions#expectlocatortohaveattributename-value)
- [`expect(locator).toHaveClass(expected)`](./test-assertions#expectlocatortohaveclassexpected)
- [`expect(locator).toHaveCount(count)`](./test-assertions#expectlocatortohavecountcount)
- [`expect(locator).toHaveCSS(name, value)`](./test-assertions#expectlocatortohavecssname-value)
- [`expect(locator).toHaveId(id)`](./test-assertions#expectlocatortohaveidid)
- [`expect(locator).toHaveJSProperty(name, value)`](./test-assertions#expectlocatortohavejspropertyname-value)
- [`expect(locator).toHaveText(expected, options)`](./test-assertions#expectlocatortohavetextexpected-options)
- [`expect(page).toHaveTitle(title)`](./test-assertions#expectpagetohavetitletitle)
- [`expect(page).toHaveURL(url)`](./test-assertions#expectpagetohaveurlurl)
- [`expect(locator).toHaveValue(value)`](./test-assertions#expectlocatortohavevaluevalue)

#### ⛓ Serial mode with [`describe.serial`](./api/class-test#test-describe-serial)

Declares a group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together.

```ts
test.describe.serial('group', () => {
  test('runs first', async ({ page }) => { /* ... */ });
  test('runs second', async ({ page }) => { /* ... */ });
});
```

Learn more in the [documentation](./api/class-test#test-describe-serial).

#### 🐾 Steps API with [`test.step`](./api/class-test#test-step)

Split long tests into multiple steps using `test.step()` API:

```ts
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await test.step('Log in', async () => {
    // ...
  });
  await test.step('news feed', async () => {
    // ...
  });
});
```

Step information is exposed in reporters API.

#### 🌎 Launch web server before running tests

To launch a server during the tests, use the [`webServer`](./test-advanced/#launching-a-development-web-server-during-the-tests) option in the configuration file. The server will wait for a given port to be available before running the tests, and the port will be passed over to Playwright as a [`baseURL`](./api/class-fixtures#fixtures-base-url) when creating a context.

```ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run start', // command to launch
    port: 3000, // port to await for
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};
export default config;
```

Learn more in the [documentation](./test-advanced#launching-a-development-web-server-during-the-tests).

### Browser Versions

- Chromium 94.0.4595.0
- Mozilla Firefox 91.0
- WebKit 15.0


## Version 1.13


#### Playwright Test

- **⚡️ Introducing [Reporter API](https://github.com/microsoft/playwright/blob/65a9037461ffc15d70cdc2055832a0c5512b227c/packages/playwright-test/types/testReporter.d.ts)** which is already used to create an [Allure Playwright reporter](https://github.com/allure-framework/allure-js/pull/297).
- **⛺️ New [`baseURL` fixture](./test-configuration#basic-options)** to support relative paths in tests.


#### Playwright

- **🖖 Programmatic drag-and-drop support** via the [`method: Page.dragAndDrop`] API.
- **🔎 Enhanced HAR** with body sizes for requests and responses. Use via `recordHar` option in [`method: Browser.newContext`].

#### Tools

- Playwright Trace Viewer now shows parameters, returned values and `console.log()` calls.
- Playwright Inspector can generate Playwright Test tests.

#### New and Overhauled Guides

- [Intro](./intro.md)
- [Authentication](./auth.md)
- [Chrome Extensions](./chrome-extensions.md)
- [Playwright Test Annotations](./test-annotations.md)
- [Playwright Test Configuration](./test-configuration.md)
- [Playwright Test Fixtures](./test-fixtures.md)

#### Browser Versions

- Chromium 93.0.4576.0
- Mozilla Firefox 90.0
- WebKit 14.2

#### New Playwright APIs

- new `baseURL` option in [`method: Browser.newContext`] and [`method: Browser.newPage`]
- [`method: Response.securityDetails`] and [`method: Response.serverAddr`]
- [`method: Page.dragAndDrop`] and [`method: Frame.dragAndDrop`]
- [`method: Download.cancel`]
- [`method: Page.inputValue`], [`method: Frame.inputValue`] and [`method: ElementHandle.inputValue`]
- new `force` option in [`method: Page.fill`], [`method: Frame.fill`], and [`method: ElementHandle.fill`]
- new `force` option in [`method: Page.selectOption`], [`method: Frame.selectOption`], and [`method: ElementHandle.selectOption`]

## Version 1.12

#### ⚡️ Introducing Playwright Test

[Playwright Test](./intro.md) is a **new test runner** built from scratch by Playwright team specifically to accommodate end-to-end testing needs:

- Run tests across all browsers.
- Execute tests in parallel.
- Enjoy context isolation and sensible defaults out of the box.
- Capture videos, screenshots and other artifacts on failure.
- Integrate your POMs as extensible fixtures.

Installation:
```bash
npm i -D @playwright/test
```

Simple test `tests/foo.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

Running:

```bash
npx playwright test
```

👉  Read more in [Playwright Test documentation](./intro.md).

#### 🧟‍♂️ Introducing Playwright Trace Viewer

[Playwright Trace Viewer](./trace-viewer.md) is a new GUI tool that helps exploring recorded Playwright traces after the script ran. Playwright traces let you examine:
- page DOM before and after each Playwright action
- page rendering before and after each Playwright action
- browser network during script execution

Traces are recorded using the new [`property: BrowserContext.tracing`] API:

```ts
const browser = await chromium.launch();
const context = await browser.newContext();

// Start tracing before creating / navigating a page.
await context.tracing.start({ screenshots: true, snapshots: true });

const page = await context.newPage();
await page.goto('https://playwright.dev');

// Stop tracing and export it into a zip archive.
await context.tracing.stop({ path: 'trace.zip' });
```

Traces are examined later with the Playwright CLI:


```sh
npx playwright show-trace trace.zip
```

That will open the following GUI:

![image](https://user-images.githubusercontent.com/746130/121109654-d66c4480-c7c0-11eb-8d4d-eb70d2b03811.png)

👉 Read more in [trace viewer documentation](./trace-viewer.md).


#### Browser Versions

- Chromium 93.0.4530.0
- Mozilla Firefox 89.0
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 91
- Microsoft Edge 91

#### New APIs

- `reducedMotion` option in [`method: Page.emulateMedia`], [`method: BrowserType.launchPersistentContext`], [`method: Browser.newContext`] and [`method: Browser.newPage`]
- [`event: BrowserContext.request`]
- [`event: BrowserContext.requestFailed`]
- [`event: BrowserContext.requestFinished`]
- [`event: BrowserContext.response`]
- `tracesDir` option in [`method: BrowserType.launch`] and [`method: BrowserType.launchPersistentContext`]
- new [`property: BrowserContext.tracing`] API namespace
- new [`method: Download.page`] method

## Version 1.11

🎥  New video: [Playwright: A New Test Automation Framework for the Modern Web](https://youtu.be/_Jla6DyuEu4) ([slides](https://docs.google.com/presentation/d/1xFhZIJrdHkVe2CuMKOrni92HoG2SWslo0DhJJQMR1DI/edit?usp=sharing))
- We talked about Playwright
- Showed engineering work behind the scenes
- Did live demos with new features ✨
- **Special thanks** to [applitools](http://applitools.com/) for hosting the event and inviting us!

#### Browser Versions

- Chromium 92.0.4498.0
- Mozilla Firefox 89.0b6
- WebKit 14.2

#### New APIs

- support for **async predicates** across the API in methods such as [`method: Page.waitForRequest`] and others
- new **emulation devices**: Galaxy S8, Galaxy S9+, Galaxy Tab S4, Pixel 3, Pixel 4
- new methods:
    * [`method: Page.waitForURL`] to await navigations to URL
    * [`method: Video.delete`] and [`method: Video.saveAs`] to manage screen recording
- new options:
    * `screen` option in the [`method: Browser.newContext`] method to emulate `window.screen` dimensions
    * `position` option in [`method: Page.check`] and [`method: Page.uncheck`] methods
    * `trial` option to dry-run actions in [`method: Page.check`], [`method: Page.uncheck`], [`method: Page.click`], [`method: Page.dblclick`], [`method: Page.hover`] and [`method: Page.tap`]

## Version 1.10

- [Playwright for Java v1.10](https://github.com/microsoft/playwright-java) is **now stable**!
- Run Playwright against **Google Chrome** and **Microsoft Edge** stable channels with the [new channels API](./browsers).
- Chromium screenshots are **fast** on Mac & Windows.

#### Bundled Browser Versions

- Chromium 90.0.4430.0
- Mozilla Firefox 87.0b10
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 89
- Microsoft Edge 89

#### New APIs

- [`browserType.launch()`](./api/class-browsertype#browsertypelaunchoptions) now accepts the new `'channel'` option. Read more in [our documentation](./browsers).


## Version 1.9

- [Playwright Inspector](./inspector.md) is a **new GUI tool** to author and debug your tests.
  - **Line-by-line debugging** of your Playwright scripts, with play, pause and step-through.
  - Author new scripts by **recording user actions**.
  - **Generate element selectors** for your script by hovering over elements.
  - Set the `PWDEBUG=1` environment variable to launch the Inspector

- **Pause script execution** with [`method: Page.pause`] in headed mode. Pausing the page launches [Playwright Inspector](./inspector.md) for debugging.

- **New has-text pseudo-class** for CSS selectors. `:has-text("example")` matches any element containing `"example"` somewhere inside, possibly in a child or a descendant element. See [more examples](./selectors.md#text-selector).

- **Page dialogs are now auto-dismissed** during execution, unless a listener for `dialog` event is configured. [Learn more](./dialogs.md) about this.

- [Playwright for Python](https://github.com/microsoft/playwright-python) is **now stable** with an idiomatic snake case API and pre-built [Docker image](./docker.md) to run tests in CI/CD.

#### Browser Versions

- Chromium 90.0.4421.0
- Mozilla Firefox 86.0b10
- WebKit 14.1

#### New APIs
- [`method: Page.pause`].


## Version 1.8

- [Selecting elements based on layout](./selectors.md#selecting-elements-based-on-layout) with `:left-of()`, `:right-of()`, `:above()` and `:below()`.
- Playwright now includes [command line interface](./cli.md), former playwright-cli.
  ```bash js
  npx playwright --help
  ```
  ```bash python
  playwright --help
  ```
- [`method: Page.selectOption`] now waits for the options to be present.
- New methods to [assert element state](./actionability#assertions) like [`method: Page.isEditable`].

#### New APIs

- [`method: ElementHandle.isChecked`].
- [`method: ElementHandle.isDisabled`].
- [`method: ElementHandle.isEditable`].
- [`method: ElementHandle.isEnabled`].
- [`method: ElementHandle.isHidden`].
- [`method: ElementHandle.isVisible`].
- [`method: Page.isChecked`].
- [`method: Page.isDisabled`].
- [`method: Page.isEditable`].
- [`method: Page.isEnabled`].
- [`method: Page.isHidden`].
- [`method: Page.isVisible`].
- New option `'editable'` in [`method: ElementHandle.waitForElementState`].

#### Browser Versions

- Chromium 90.0.4392.0
- Mozilla Firefox 85.0b5
- WebKit 14.1

## Version 1.7

- **New Java SDK**: [Playwright for Java](https://github.com/microsoft/playwright-java) is now on par with [JavaScript](https://github.com/microsoft/playwright), [Python](https://github.com/microsoft/playwright-python) and [.NET bindings](https://github.com/microsoft/playwright-dotnet).
- **Browser storage API**: New convenience APIs to save and load browser storage state (cookies, local storage) to simplify automation scenarios with authentication.
- **New CSS selectors**: We heard your feedback for more flexible selectors and have revamped the selectors implementation. Playwright 1.7 introduces [new CSS extensions](./selectors.md) and there's more coming soon.
- **New website**: The docs website at [playwright.dev](https://playwright.dev/) has been updated and is now built with [Docusaurus](https://v2.docusaurus.io/).
- **Support for Apple Silicon**: Playwright browser binaries for WebKit and Chromium are now built for Apple Silicon.

#### New APIs

- [`method: BrowserContext.storageState`] to get current state for later reuse.
- `storageState` option in [`method: Browser.newContext`] and [`method: Browser.newPage`] to setup browser context state.

#### Browser Versions

- Chromium 89.0.4344.0
- Mozilla Firefox 84.0b9
- WebKit 14.1
