---
id: release-notes
title: "Release notes"
toc_max_heading_level: 2
---

import LiteYouTube from '@site/src/components/LiteYouTube';

## Version 1.54

### Highlights

- New cookie property `partitionKey` in [`method: BrowserContext.cookies`] and [`method: BrowserContext.addCookies`]. This property allows to save and restore partitioned cookies. See [CHIPS MDN article](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies) for more information. Note that browsers have different support and defaults for cookie partitioning.

- New option `noSnippets` to disable code snippets in the html report.
  ```js
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    reporter: [['html', { noSnippets: true }]]
  });
  ```

- New property `location` in test annotations, for example in [`property: TestResult.annotations`] and [`property: TestInfo.annotations`]. It shows where the annotation like `test.skip` or `test.fixme` was added.

### Command Line

- New option `--user-data-dir` in multiple commands. You can specify the same user data dir to reuse browsing state, like authentication, between sessions.
  ```bash
  npx playwright codegen --user-data-dir=./user-data
  ```

- Option `-gv` has been removed from the `npx playwright test` command. Use `--grep-invert` instead.

- `npx playwright open` does not open the test recorder anymore. Use `npx playwright codegen` instead.

### Miscellaneous

- Support for Node.js 16 has been removed.

- Support for Node.js 18 has been deprecated, and will be removed in the future.

### Browser Versions

- Chromium 139.0.7258.5
- Mozilla Firefox 140.0.2
- WebKit 26.0

This version was also tested against the following stable channels:

- Google Chrome 140
- Microsoft Edge 140

## Version 1.53

### Trace Viewer and HTML Reporter Updates

- New Steps in Trace Viewer and HTML reporter:
  ![New Trace Viewer Steps](https://github.com/user-attachments/assets/1963ff7d-4070-41be-a79b-4333176921a2)
- New option in `'html'` reporter to set the title of a specific test run:
  ```js
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    reporter: [['html', { title: 'Custom test run #1028' }]]
  });
  ```

### Miscellaneous

- New option [`option: TestInfo.snapshotPath.kind`] in [`method: TestInfo.snapshotPath`] controls which snapshot path template is used.
- New method [`method: Locator.describe`] to describe a locator. Used for trace viewer and reports.
  ```js
  const button = page.getByTestId('btn-sub').describe('Subscribe button');
  await button.click();
  ```
- `npx playwright install --list` will now list all installed browsers, versions and locations.

### Browser Versions

- Chromium 138.0.7204.4
- Mozilla Firefox 139.0
- WebKit 18.5

This version was also tested against the following stable channels:

- Google Chrome 137
- Microsoft Edge 137

## Version 1.52

### Highlights

- New method [`method: LocatorAssertions.toContainClass`] to ergonomically assert individual class names on the element.

  ```ts
  await expect(page.getByRole('listitem', { name: 'Ship v1.52' })).toContainClass('done');
  ```

- [Aria Snapshots](./aria-snapshots.md) got two new properties: [`/children`](./aria-snapshots.md#strict-matching) for strict matching and `/url` for links.

  ```ts
  await expect(locator).toMatchAriaSnapshot(`
    - list
      - /children: equal
      - listitem: Feature A
      - listitem:
        - link "Feature B":
          - /url: "https://playwright.dev"
  `);
  ```

### Test Runner

- New property [`property: TestProject.workers`] allows to specify the number of concurrent worker processes to use for a test project. The global limit of property [`property: TestConfig.workers`] still applies.
- New [`property: TestConfig.failOnFlakyTests`] option to fail the test run if any flaky tests are detected, similarly to `--fail-on-flaky-tests`. This is useful for CI/CD environments where you want to ensure that all tests are stable before deploying.
- New property [`property: TestResult.annotations`] contains annotations for each test retry.

### Miscellaneous

- New option [`option: APIRequest.newContext.maxRedirects`] in [`method: APIRequest.newContext`] to control the maximum number of redirects.
- New option `ref` in [`method: Locator.ariaSnapshot`] to generate reference for each element in the snapshot which can later be used to locate the element.
- HTML reporter now supports *NOT filtering* via `!@my-tag` or `!my-file.spec.ts` or `!p:my-project`.

### Breaking Changes

- Glob URL patterns in methods like [`method: Page.route`] do not support `?` and `[]` anymore. We recommend using regular expressions instead.
- Method [`method: Route.continue`] does not allow to override the `Cookie` header anymore. If a `Cookie` header is provided, it will be ignored, and the cookie will be loaded from the browser's cookie store. To set custom cookies, use [`method: BrowserContext.addCookies`].
- macOS 13 is now deprecated and will no longer receive WebKit updates. Please upgrade to a more recent macOS version to continue benefiting from the latest WebKit improvements.

### Browser Versions

- Chromium 136.0.7103.25
- Mozilla Firefox 137.0
- WebKit 18.4

This version was also tested against the following stable channels:

- Google Chrome 135
- Microsoft Edge 135

## Version 1.51

### StorageState for indexedDB

* New option [`option: BrowserContext.storageState.indexedDB`] for [`method: BrowserContext.storageState`] allows to save and restore IndexedDB contents. Useful when your application uses [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) to store authentication tokens, like Firebase Authentication.

  Here is an example following the [authentication guide](./auth.md#basic-shared-account-in-all-tests):

  ```js title="tests/auth.setup.ts"
  import { test as setup, expect } from '@playwright/test';
  import path from 'path';

  const authFile = path.join(__dirname, '../playwright/.auth/user.json');

  setup('authenticate', async ({ page }) => {
    await page.goto('/');
    // ... perform authentication steps ...

    // make sure to save indexedDB
    await page.context().storageState({ path: authFile, indexedDB: true });
  });
  ```

### Copy as prompt

New "Copy prompt" button on errors in the HTML report, trace viewer and UI mode. Click to copy a pre-filled LLM prompt that contains the error message and useful context for fixing the error.

  ![Copy prompt](https://github.com/user-attachments/assets/f3654407-dd6d-4240-9845-0d96df2bf30a)

### Filter visible elements

New option [`option: Locator.filter.visible`] for [`method: Locator.filter`] allows matching only visible elements.

  ```js title="example.spec.ts"
  test('some test', async ({ page }) => {
    // Ignore invisible todo items.
    const todoItems = page.getByTestId('todo-item').filter({ visible: true });
    // Check there are exactly 3 visible ones.
    await expect(todoItems).toHaveCount(3);
  });
  ```

### Git information in HTML report

Set option [`property: TestConfig.captureGitInfo`] to capture git information into [`property: TestConfig.metadata`].

  ```js title="playwright.config.ts"
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    captureGitInfo: { commit: true, diff: true }
  });
  ```

  HTML report will show this information when available:

  ![Git information in the report](https://github.com/user-attachments/assets/f5b3f6f4-aa08-4a24-816c-7edf33ef0c37)

### Test Step improvements

A new [TestStepInfo] object is now available in test steps. You can add step attachments or skip the step under some conditions.

  ```js
  test('some test', async ({ page, isMobile }) => {
    // Note the new "step" argument:
    await test.step('here is my step', async step => {
      step.skip(isMobile, 'not relevant on mobile layouts');

      // ...
      await step.attach('my attachment', { body: 'some text' });
      // ...
    });
  });
  ```

### Miscellaneous

* New option `contrast` for methods [`method: Page.emulateMedia`] and [`method: Browser.newContext`] allows to emulate the `prefers-contrast` media feature.
* New option [`option: APIRequest.newContext.failOnStatusCode`] makes all fetch requests made through the [APIRequestContext] throw on response codes other than 2xx and 3xx.
* Assertion [`method: PageAssertions.toHaveURL`] now supports a predicate.

### Browser Versions

* Chromium 134.0.6998.35
* Mozilla Firefox 135.0
* WebKit 18.4

This version was also tested against the following stable channels:

* Google Chrome 133
* Microsoft Edge 133


## Version 1.50

### Test runner

* New option [`option: Test.step.timeout`] allows specifying a maximum run time for an individual test step. A timed-out step will fail the execution of the test.

  ```js
  test('some test', async ({ page }) => {
    await test.step('a step', async () => {
      // This step can time out separately from the test
    }, { timeout: 1000 });
  });
  ```

* New method [`method: Test.step.skip`] to disable execution of a test step.

  ```js
  test('some test', async ({ page }) => {
    await test.step('before running step', async () => {
      // Normal step
    });

    await test.step.skip('not yet ready', async () => {
      // This step is skipped
    });

    await test.step('after running step', async () => {
      // This step still runs even though the previous one was skipped
    });
  });
  ```

* Expanded [`method: LocatorAssertions.toMatchAriaSnapshot#2`] to allow storing of aria snapshots in separate YAML files.
* Added method [`method: LocatorAssertions.toHaveAccessibleErrorMessage`] to assert the Locator points to an element with a given [aria errormessage](https://w3c.github.io/aria/#aria-errormessage).
* Option [`property: TestConfig.updateSnapshots`] added the configuration enum `changed`. `changed` updates only the snapshots that have changed, whereas `all` now updates all snapshots, regardless of whether there are any differences.
* New option [`property: TestConfig.updateSourceMethod`] defines the way source code is updated when [`property: TestConfig.updateSnapshots`] is configured. Added `overwrite` and `3-way` modes that write the changes into source code, on top of existing `patch` mode that creates a patch file.

  ```bash
  npx playwright test --update-snapshots=changed --update-source-method=3way
  ```

* Option [`property: TestConfig.webServer`] added a `gracefulShutdown` field for specifying a process kill signal other than the default `SIGKILL`.
* Exposed [`property: TestStep.attachments`] from the reporter API to allow retrieval of all attachments created by that step.
* New option `pathTemplate` for `toHaveScreenshot` and `toMatchAriaSnapshot` assertions in the [`property: TestConfig.expect`] configuration.

### UI updates

* Updated default HTML reporter to improve display of attachments.
* New button in Codegen for picking elements to produce aria snapshots.
* Additional details (such as keys pressed) are now displayed alongside action API calls in traces.
* Display of `canvas` content in traces is error-prone. Display is now disabled by default, and can be enabled via the `Display canvas content` UI setting.
* `Call` and `Network` panels now display additional time information.

### Breaking

* [`method: LocatorAssertions.toBeEditable`] and [`method: Locator.isEditable`] now throw if the target element is not `<input>`, `<select>`, or a number of other editable elements.
* Option [`property: TestConfig.updateSnapshots`] now updates all snapshots when set to `all`, rather than only the failed/changed snapshots. Use the new enum `changed` to keep the old functionality of only updating the changed snapshots.

### Browser Versions

* Chromium 133.0.6943.16
* Mozilla Firefox 134.0
* WebKit 18.2

This version was also tested against the following stable channels:

* Google Chrome 132
* Microsoft Edge 132

## Version 1.49

<LiteYouTube
  id="S5wCft-ImKk"
  title="Playwright 1.49"
/>

### Aria snapshots

New assertion [`method: LocatorAssertions.toMatchAriaSnapshot`] verifies page structure by comparing to an expected accessibility tree, represented as YAML.

```js
await page.goto('https://playwright.dev');
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - banner:
    - heading /Playwright enables reliable/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
  - main:
    - img "Browsers (Chromium, Firefox, WebKit)"
    - heading "Any browser • Any platform • One API"
`);
```

You can generate this assertion with [Test Generator](./codegen) and update the expected snapshot with `--update-snapshots` command line flag.

Learn more in the [aria snapshots guide](./aria-snapshots).

### Test runner

- New option [`property: TestConfig.tsconfig`] allows to specify a single `tsconfig` to be used for all tests.
- New method [`method: Test.fail.only`] to focus on a failing test.
- Options [`property: TestConfig.globalSetup`] and [`property: TestConfig.globalTeardown`] now support multiple setups/teardowns.
- New value `'on-first-failure'` for [`property: TestOptions.screenshot`].
- Added "previous" and "next" buttons to the HTML report to quickly switch between test cases.
- New properties [`property: TestInfoError.cause`] and [`property: TestError.cause`] mirroring [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause).

### Breaking: `chrome` and `msedge` channels switch to new headless mode

This change affects you if you're using one of the following channels in your `playwright.config.ts`:
- `chrome`, `chrome-dev`, `chrome-beta`, or `chrome-canary`
- `msedge`, `msedge-dev`, `msedge-beta`, or `msedge-canary`

#### What do I need to do?

After updating to Playwright v1.49, run your test suite. If it still passes, you're good to go. If not, you will probably need to update your snapshots, and adapt some of your test code around PDF viewers and extensions. See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for more details.

### Other breaking changes

- There will be no more updates for WebKit on Ubuntu 20.04 and Debian 11. We recommend updating your OS to a later version.
- Package `@playwright/experimental-ct-vue2` will no longer be updated.
- Package `@playwright/experimental-ct-solid` will no longer be updated.

### Try new Chromium headless

You can opt into the new headless mode by using `'chromium'` channel. As [official Chrome documentation puts it](https://developer.chrome.com/blog/chrome-headless-shell):

> New Headless on the other hand is the real Chrome browser, and is thus more authentic, reliable, and offers more features. This makes it more suitable for high-accuracy end-to-end web app testing or browser extension testing.

See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for the list of possible breakages you could encounter and more details on Chromium headless. Please file an issue if you see any problems after opting in.

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
});
```

### Miscellaneous

- `<canvas>` elements inside a snapshot now draw a preview.
- New method [`method: Tracing.group`] to visually group actions in the trace.
- Playwright docker images switched from Node.js v20 to Node.js v22 LTS.

### Browser Versions

- Chromium 131.0.6778.33
- Mozilla Firefox 132.0
- WebKit 18.2

This version was also tested against the following stable channels:

- Google Chrome 130
- Microsoft Edge 130


## Version 1.48

<LiteYouTube
  id="VGlkSBkMVCQ"
  title="Playwright 1.48"
/>

### WebSocket routing

New methods [`method: Page.routeWebSocket`] and [`method: BrowserContext.routeWebSocket`] allow to intercept, modify and mock WebSocket connections initiated in the page. Below is a simple example that mocks WebSocket communication by responding to a `"request"` with a `"response"`.

```js
await page.routeWebSocket('/ws', ws => {
  ws.onMessage(message => {
    if (message === 'request')
      ws.send('response');
  });
});
```

See [WebSocketRoute] for more details.

### UI updates

- New "copy" buttons for annotations and test location in the HTML report.
- Route method calls like [`method: Route.fulfill`] are not shown in the report and trace viewer anymore. You can see which network requests were routed in the network tab instead.
- New "Copy as cURL" and "Copy as fetch" buttons for requests in the network tab.

### Miscellaneous

- Option [`option: APIRequestContext.fetch.form`] and similar ones now accept [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData).
- New method [`method: Page.requestGC`] may help detect memory leaks.
- New option [`option: Test.step.location`] to pass custom step location.
- Requests made by [APIRequestContext] now record detailed timing and security information in the HAR.

### Browser Versions

- Chromium 130.0.6723.19
- Mozilla Firefox 130.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 129
- Microsoft Edge 129


## Version 1.47

### Network Tab improvements

The Network tab in the UI mode and trace viewer has several nice improvements:

- filtering by asset type and URL
- better display of query string parameters
- preview of font assets

![Network tab now has filters](https://github.com/user-attachments/assets/4bd1b67d-90bd-438b-a227-00b9e86872e2)


### `--tsconfig` CLI option

By default, Playwright will look up the closest tsconfig for each imported file using a heuristic. You can now specify a single tsconfig file in the command line, and Playwright will use it for all imported files, not only test files:

```sh
# Pass a specific tsconfig
npx playwright test --tsconfig tsconfig.test.json
```

### [APIRequestContext] now accepts [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) and `string` as query parameters

You can now pass [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) and `string` as query parameters to [APIRequestContext]:

```js
test('query params', async ({ request }) => {
  const searchParams = new URLSearchParams();
  searchParams.set('userId', 1);
  const response = await request.get(
      'https://jsonplaceholder.typicode.com/posts',
      {
        params: searchParams // or as a string: 'userId=1'
      }
  );
  // ...
});
```

### Miscellaneous

- The `mcr.microsoft.com/playwright:v1.47.0` now serves a Playwright image based on Ubuntu 24.04 Noble.
  To use the 22.04 jammy-based image, please use `mcr.microsoft.com/playwright:v1.47.0-jammy` instead.
- New options [`option: Page.removeAllListeners.behavior`], [`option: Browser.removeAllListeners.behavior`] and [`option: BrowserContext.removeAllListeners.behavior`] to wait for ongoing listeners to complete.
- TLS client certificates can now be passed from memory by passing [`option: Browser.newContext.clientCertificates.cert`] and [`option: Browser.newContext.clientCertificates.key`] as buffers instead of file paths.
- Attachments with a `text/html` content type can now be opened in a new tab in the HTML report. This is useful for including third-party reports or other HTML content in the Playwright test report and distributing it to your team.
- [`option: Locator.selectOption.noWaitAfter`] option in [`method: Locator.selectOption`] was deprecated.
- We've seen reports of WebGL in Webkit misbehaving on GitHub Actions `macos-13`. We recommend upgrading GitHub Actions to `macos-14`.

### Browser Versions

- Chromium 129.0.6668.29
- Mozilla Firefox 130.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 128
- Microsoft Edge 128

## Version 1.46

<LiteYouTube
  id="tQo7w-QQBsI"
  title="Playwright 1.46"
/>


### TLS Client Certificates

Playwright now allows you to supply client-side certificates, so that server can verify them, as specified by TLS Client Authentication.

The following snippet sets up a client certificate for `https://example.com`:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // ...
  use: {
    clientCertificates: [{
      origin: 'https://example.com',
      certPath: './cert.pem',
      keyPath: './key.pem',
      passphrase: 'mysecretpassword',
    }],
  },
  // ...
});
```

You can also provide client certificates to a particular [test project](./api/class-testproject#test-project-use) or as a parameter of [`method: Browser.newContext`] and [`method: APIRequest.newContext`].

### `--only-changed` cli option

New CLI option `--only-changed` will only run test files that have been changed since the last git commit or from a specific git "ref". This will also run all test files that import any changed files.

```sh
# Only run test files with uncommitted changes
npx playwright test --only-changed

# Only run test files changed relative to the "main" branch
npx playwright test --only-changed=main
```

### Component Testing: New `router` fixture

This release introduces an experimental `router` fixture to intercept and handle network requests in component testing.
There are two ways to use the router fixture:

- Call `router.route(url, handler)` that behaves similarly to [`method: Page.route`].
- Call `router.use(handlers)` and pass [MSW library](https://mswjs.io) request handlers to it.

Here is an example of reusing your existing MSW handlers in the test.

```js
import { handlers } from '@src/mocks/handlers';

test.beforeEach(async ({ router }) => {
  // install common handlers before each test
  await router.use(...handlers);
});

test('example test', async ({ mount }) => {
  // test as usual, your handlers are active
  // ...
});
```

This fixture is only available in [component tests](./test-components#handling-network-requests).

### UI Mode / Trace Viewer Updates

- Test annotations are now shown in UI mode.
- Content of text attachments is now rendered inline in the attachments pane.
- New setting to show/hide routing actions like [`method: Route.continue`].
- Request method and status are shown in the network details tab.
- New button to copy source file location to clipboard.
- Metadata pane now displays the `baseURL`.

### Miscellaneous

- New `maxRetries` option in [`method: APIRequestContext.fetch`] which retries on the `ECONNRESET` network error.
- New option to [box a fixture](./test-fixtures#box-fixtures) to minimize the fixture exposure in test reports and error messages.
- New option to provide a [custom fixture title](./test-fixtures#custom-fixture-title) to be used in test reports and error messages.

### Browser Versions

- Chromium 128.0.6613.18
- Mozilla Firefox 128.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 127
- Microsoft Edge 127

## Version 1.45

<LiteYouTube
  id="54_aC-rVKHg"
  title="Playwright 1.45"
/>

### Clock

Utilizing the new [Clock] API allows to manipulate and control time within tests to verify time-related behavior. This API covers many common scenarios, including:
* testing with predefined time;
* keeping consistent time and timers;
* monitoring inactivity;
* ticking through time manually.

```js
// Initialize clock and let the page load naturally.
await page.clock.install({ time: new Date('2024-02-02T08:00:00') });
await page.goto('http://localhost:3333');

// Pretend that the user closed the laptop lid and opened it again at 10am,
// Pause the time once reached that point.
await page.clock.pauseAt(new Date('2024-02-02T10:00:00'));

// Assert the page state.
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:00:00 AM');

// Close the laptop lid again and open it at 10:30am.
await page.clock.fastForward('30:00');
await expect(page.getByTestId('current-time')).toHaveText('2/2/2024, 10:30:00 AM');
```

See [the clock guide](./clock.md) for more details.

### Test runner

- New CLI option `--fail-on-flaky-tests` that sets exit code to `1` upon any flaky tests. Note that by default, the test runner exits with code `0` when all failed tests recovered upon a retry. With this option, the test run will fail in such case.

- New environment variable `PLAYWRIGHT_FORCE_TTY` controls whether built-in `list`, `line` and `dot` reporters assume a live terminal. For example, this could be useful to disable tty behavior when your CI environment does not handle ANSI control sequences well. Alternatively, you can enable tty behavior even when to live terminal is present, if you plan to post-process the output and handle control sequences.

  ```sh
  # Avoid TTY features that output ANSI control sequences
  PLAYWRIGHT_FORCE_TTY=0 npx playwright test

  # Enable TTY features, assuming a terminal width 80
  PLAYWRIGHT_FORCE_TTY=80 npx playwright test
  ```

- New options [`property: TestConfig.respectGitIgnore`] and [`property: TestProject.respectGitIgnore`] control whether files matching `.gitignore` patterns are excluded when searching for tests.

- New property `timeout` is now available for custom expect matchers. This property takes into account `playwright.config.ts` and `expect.configure()`.
  ```js
  import { expect as baseExpect } from '@playwright/test';

  export const expect = baseExpect.extend({
    async toHaveAmount(locator: Locator, expected: number, options?: { timeout?: number }) {
      // When no timeout option is specified, use the config timeout.
      const timeout = options?.timeout ?? this.timeout;
      // ... implement the assertion ...
    },
  });
  ```

### Miscellaneous

- Method [`method: Locator.setInputFiles`] now supports uploading a directory for `<input type=file webkitdirectory>` elements.
  ```js
  await page.getByLabel('Upload directory').setInputFiles(path.join(__dirname, 'mydir'));
  ```

- Multiple methods like [`method: Locator.click`] or [`method: Locator.press`] now support a `ControlOrMeta` modifier key. This key maps to `Meta` on macOS and maps to `Control` on Windows and Linux.
  ```js
  // Press the common keyboard shortcut Control+S or Meta+S to trigger a "Save" operation.
  await page.keyboard.press('ControlOrMeta+S');
  ```

- New property `httpCredentials.send` in [`method: APIRequest.newContext`] that allows to either always send the `Authorization` header or only send it in response to `401 Unauthorized`.

- New option `reason` in [`method: APIRequestContext.dispose`] that will be included in the error message of ongoing operations interrupted by the context disposal.

- New option `host` in [`method: BrowserType.launchServer`] allows to accept websocket connections on a specific address instead of unspecified `0.0.0.0`.

- Playwright now supports Chromium, Firefox and WebKit on Ubuntu 24.04.

- v1.45 is the last release to receive WebKit update for macOS 12 Monterey. Please update macOS to keep using the latest WebKit.

### Browser Versions

* Chromium 127.0.6533.5
* Mozilla Firefox 127.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 126
* Microsoft Edge 126

## Version 1.44

<LiteYouTube
  id="avjSahFWdCI"
  title="Playwright 1.44"
/>

### New APIs

**Accessibility assertions**

- [`method: LocatorAssertions.toHaveAccessibleName`] checks if the element has the specified accessible name:
  ```js
  const locator = page.getByRole('button');
  await expect(locator).toHaveAccessibleName('Submit');
  ```

- [`method: LocatorAssertions.toHaveAccessibleDescription`] checks if the element has the specified accessible description:
  ```js
  const locator = page.getByRole('button');
  await expect(locator).toHaveAccessibleDescription('Upload a photo');
  ```

- [`method: LocatorAssertions.toHaveRole`] checks if the element has the specified ARIA role:
  ```js
  const locator = page.getByTestId('save-button');
  await expect(locator).toHaveRole('button');
  ```

**Locator handler**

- After executing the handler added with [`method: Page.addLocatorHandler`], Playwright will now wait until the overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with the new `noWaitAfter` option.
- You can use new `times` option in [`method: Page.addLocatorHandler`] to specify maximum number of times the handler should be run.
- The handler in [`method: Page.addLocatorHandler`] now accepts the locator as argument.
- New [`method: Page.removeLocatorHandler`] method for removing previously added locator handlers.

```js
const locator = page.getByText('This interstitial covers the button');
await page.addLocatorHandler(locator, async overlay => {
  await overlay.locator('#close').click();
}, { times: 3, noWaitAfter: true });
// Run your tests that can be interrupted by the overlay.
// ...
await page.removeLocatorHandler(locator);
```

**Miscellaneous options**

- [`multipart`](./api/class-apirequestcontext#api-request-context-fetch-option-multipart) option in `apiRequestContext.fetch()` now accepts [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and supports repeating fields with the same name.
  ```js
  const formData = new FormData();
  formData.append('file', new File(['let x = 2024;'], 'f1.js', { type: 'text/javascript' }));
  formData.append('file', new File(['hello'], 'f2.txt', { type: 'text/plain' }));
  context.request.post('https://example.com/uploadFiles', {
    multipart: formData
  });
  ```

- `expect(callback).toPass({ intervals })` can now be configured by `expect.toPass.intervals` option globally in [`property: TestConfig.expect`] or per project in [`property: TestProject.expect`].
- `expect(page).toHaveURL(url)` now supports `ignoreCase` [option](./api/class-pageassertions#page-assertions-to-have-url-option-ignore-case).
- [`property: TestProject.ignoreSnapshots`](./api/class-testproject#test-project-ignore-snapshots) allows to configure  per project whether to skip screenshot expectations.

**Reporter API**

- New method [`method: Suite.entries`] returns child test suites and test cases in their declaration order. [`property: Suite.type`] and [`property: TestCase.type`] can be used to tell apart test cases and suites in the list.
- [Blob](./test-reporters#blob-reporter) reporter now allows overriding report file path with a single option `outputFile`. The same option can also be specified as `PLAYWRIGHT_BLOB_OUTPUT_FILE` environment variable that might be more convenient on CI/CD.
- [JUnit](./test-reporters#junit-reporter) reporter now supports `includeProjectInTestName` option.

**Command line**

- `--last-failed` CLI option to for running only tests that failed in the previous run.

  First run all tests:
  ```sh
  $ npx playwright test

  Running 103 tests using 5 workers
  ...
  2 failed
    [chromium] › my-test.spec.ts:8:5 › two ─────────────────────────────────────────────────────────
    [chromium] › my-test.spec.ts:13:5 › three ──────────────────────────────────────────────────────
  101 passed (30.0s)
  ```

  Now fix the failing tests and run Playwright again with `--last-failed` option:
  ```sh
  $ npx playwright test --last-failed

  Running 2 tests using 2 workers
    2 passed (1.2s)
  ```

### Browser Versions

* Chromium 125.0.6422.14
* Mozilla Firefox 125.0.1
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 124
* Microsoft Edge 124

## Version 1.43

### New APIs

- Method [`method: BrowserContext.clearCookies`] now supports filters to remove only some cookies.

  ```js
  // Clear all cookies.
  await context.clearCookies();
  // New: clear cookies with a particular name.
  await context.clearCookies({ name: 'session-id' });
  // New: clear cookies for a particular domain.
  await context.clearCookies({ domain: 'my-origin.com' });
  ```

- New mode `retain-on-first-failure` for [`property: TestOptions.trace`]. In this mode, trace is recorded for the first run of each test, but not for retires. When test run fails, the trace file is retained, otherwise it is removed.

  ```js title=playwright.config.ts
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    use: {
      trace: 'retain-on-first-failure',
    },
  });
  ```

- New property [`property: TestInfo.tags`] exposes test tags during test execution.

  ```js
  test('example', async ({ page }) => {
    console.log(test.info().tags);
  });
  ```

- New method [`method: Locator.contentFrame`] converts a [Locator] object to a [FrameLocator]. This can be useful when you have a [Locator] object obtained somewhere, and later on would like to interact with the content inside the frame.

  ```js
  const locator = page.locator('iframe[name="embedded"]');
  // ...
  const frameLocator = locator.contentFrame();
  await frameLocator.getByRole('button').click();
  ```

- New method [`method: FrameLocator.owner`] converts a [FrameLocator] object to a [Locator]. This can be useful when you have a [FrameLocator] object obtained somewhere, and later on would like to interact with the `iframe` element.

  ```js
  const frameLocator = page.frameLocator('iframe[name="embedded"]');
  // ...
  const locator = frameLocator.owner();
  await expect(locator).toBeVisible();
  ```

### UI Mode Updates

![Playwright UI Mode](https://github.com/microsoft/playwright/assets/9881434/61ca7cfc-eb7a-4305-8b62-b6c9f098f300)

* See tags in the test list.
* Filter by tags by typing `@fast` or clicking on the tag itself.
* New shortcuts:
  - "F5" to run tests.
  - "Shift F5" to stop running tests.
  - "Ctrl `" to toggle test output.

### Browser Versions

* Chromium 124.0.6367.8
* Mozilla Firefox 124.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 123
* Microsoft Edge 123

## Version 1.42

<LiteYouTube
  id="KjSaIQLlgns"
  title="Playwright 1.41 & 1.42"
/>

### New APIs

- New method [`method: Page.addLocatorHandler`] registers a callback that will be invoked when specified element becomes visible and may block Playwright actions. The callback can get rid of the overlay. Here is an example that closes a cookie dialog when it appears:
```js
// Setup the handler.
await page.addLocatorHandler(
    page.getByRole('heading', { name: 'Hej! You are in control of your cookies.' }),
    async () => {
      await page.getByRole('button', { name: 'Accept all' }).click();
    });
// Write the test as usual.
await page.goto('https://www.ikea.com/');
await page.getByRole('link', { name: 'Collection of blue and white' }).click();
await expect(page.getByRole('heading', { name: 'Light and easy' })).toBeVisible();
```

- `expect(callback).toPass()` timeout can now be configured by `expect.toPass.timeout` option [globally](./api/class-testconfig#test-config-expect) or in [project config](./api/class-testproject#test-project-expect)

- [`event: ElectronApplication.console`] event is emitted when Electron main process calls console API methods.
```js
electronApp.on('console', async msg => {
  const values = [];
  for (const arg of msg.args())
    values.push(await arg.jsonValue());
  console.log(...values);
});
await electronApp.evaluate(() => console.log('hello', 5, { foo: 'bar' }));
```

- [New syntax](./test-annotations#tag-tests) for adding tags to the tests (@-tokens in the test title are still supported):
```js
test('test customer login', {
  tag: ['@fast', '@login'],
}, async ({ page }) => {
  // ...
});
```
 Use `--grep` command line option to run only tests with certain tags.
```sh
npx playwright test --grep @fast
```

- `--project` command line [flag](./test-cli#all-options) now supports '*' wildcard:
```sh
npx playwright test --project='*mobile*'
```

- [New syntax](./test-annotations#annotate-tests) for test annotations:
```js
test('test full report', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23180' },
    { type: 'docs', description: 'https://playwright.dev/docs/test-annotations#tag-tests' },
  ],
}, async ({ page }) => {
  // ...
});
```

- [`method: Page.pdf`] accepts two new options [`tagged`](./api/class-page#page-pdf-option-tagged) and [`outline`](./api/class-page#page-pdf-option-outline).

### Announcements

* ⚠️ Ubuntu 18 is not supported anymore.

### Browser Versions

* Chromium 123.0.6312.4
* Mozilla Firefox 123.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 122
* Microsoft Edge 123

## Version 1.41

### New APIs

- New method [`method: Page.unrouteAll`] removes all routes registered by [`method: Page.route`] and [`method: Page.routeFromHAR`]. Optionally allows to wait for ongoing routes to finish, or ignore any errors from them.
- New method [`method: BrowserContext.unrouteAll`] removes all routes registered by [`method: BrowserContext.route`] and [`method: BrowserContext.routeFromHAR`]. Optionally allows to wait for ongoing routes to finish, or ignore any errors from them.
- New options [`option: Page.screenshot.style`] in [`method: Page.screenshot`] and [`option: Locator.screenshot.style`] in [`method: Locator.screenshot`] to add custom CSS to the page before taking a screenshot.
- New option `stylePath` for methods [`method: PageAssertions.toHaveScreenshot#1`] and [`method: LocatorAssertions.toHaveScreenshot#1`] to apply a custom stylesheet while making the screenshot.
- New `fileName` option for [Blob reporter](./test-reporters#blob-reporter), to specify the name of the report to be created.

### Browser Versions

* Chromium 121.0.6167.57
* Mozilla Firefox 121.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 120
* Microsoft Edge 120

## Version 1.40

<LiteYouTube
  id="mn892dV81_8"
  title="Playwright 1.40"
/>

### Test Generator Update

![Playwright Test Generator](https://github.com/microsoft/playwright/assets/9881434/e8d67e2e-f36d-4301-8631-023948d3e190)

New tools to generate assertions:
- "Assert visibility" tool generates [`method: LocatorAssertions.toBeVisible`].
- "Assert value" tool generates [`method: LocatorAssertions.toHaveValue`].
- "Assert text" tool generates [`method: LocatorAssertions.toContainText`].

Here is an example of a generated test with assertions:

```js
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page.getByLabel('Breadcrumbs').getByRole('list')).toContainText('Installation');
  await expect(page.getByLabel('Search')).toBeVisible();
  await page.getByLabel('Search').click();
  await page.getByPlaceholder('Search docs').fill('locator');
  await expect(page.getByPlaceholder('Search docs')).toHaveValue('locator');
});
```

### New APIs

- Options [`option: Page.close.reason`] in [`method: Page.close`], [`option: BrowserContext.close.reason`] in [`method: BrowserContext.close`] and [`option: Browser.close.reason`] in [`method: Browser.close`]. Close reason is reported for all operations interrupted by the closure.
- Option [`option: BrowserType.launchPersistentContext.firefoxUserPrefs`] in [`method: BrowserType.launchPersistentContext`].

### Other Changes

- Methods [`method: Download.path`] and [`method: Download.createReadStream`] throw an error for failed and cancelled downloads.
- Playwright [docker image](./docker.md) now comes with Node.js v20.

### Browser Versions

* Chromium 120.0.6099.28
* Mozilla Firefox 119.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 119
* Microsoft Edge 119

## Version 1.39

<LiteYouTube
  id="KqVuRAlOkm0"
  title="Playwright 1.39"
/>

### Add custom matchers to your expect

You can extend Playwright assertions by providing custom matchers. These matchers will be available on the expect object.

```js title="test.spec.ts"
import { expect as baseExpect } from '@playwright/test';
export const expect = baseExpect.extend({
  async toHaveAmount(locator: Locator, expected: number, options?: { timeout?: number }) {
    // ... see documentation for how to write matchers.
  },
});

test('pass', async ({ page }) => {
  await expect(page.getByTestId('cart')).toHaveAmount(5);
});
```

See the documentation [for a full example](./test-assertions#add-custom-matchers-using-expectextend).

### Merge test fixtures

You can now merge test fixtures from multiple files or modules:

```js title="fixtures.ts"
import { mergeTests } from '@playwright/test';
import { test as dbTest } from 'database-test-utils';
import { test as a11yTest } from 'a11y-test-utils';

export const test = mergeTests(dbTest, a11yTest);
```

```js title="test.spec.ts"
import { test } from './fixtures';

test('passes', async ({ database, page, a11y }) => {
  // use database and a11y fixtures.
});
```

### Merge custom expect matchers

You can now merge custom expect matchers from multiple files or modules:

```js title="fixtures.ts"
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as dbTest, expect as dbExpect } from 'database-test-utils';
import { test as a11yTest, expect as a11yExpect } from 'a11y-test-utils';

export const test = mergeTests(dbTest, a11yTest);
export const expect = mergeExpects(dbExpect, a11yExpect);
```

```js title="test.spec.ts"
import { test, expect } from './fixtures';

test('passes', async ({ page, database }) => {
  await expect(database).toHaveDatabaseUser('admin');
  await expect(page).toPassA11yAudit();
});
```

### Hide implementation details: box test steps

You can mark a [`method: Test.step`] as "boxed" so that errors inside it point to the step call site.

```js
async function login(page) {
  await test.step('login', async () => {
    // ...
  }, { box: true });  // Note the "box" option here.
}
```

```txt
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  ... error details omitted ...

  14 |   await page.goto('https://github.com/login');
> 15 |   await login(page);
     |         ^
  16 | });
```

See [`method: Test.step`] documentation for a full example.

### New APIs

- [`method: LocatorAssertions.toHaveAttribute#2`]

### Browser Versions

* Chromium 119.0.6045.9
* Mozilla Firefox 118.0.1
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 118
* Microsoft Edge 118

## Version 1.38

<LiteYouTube
  id="YGJTeXaZDTM"
  title="Playwright 1.38"
/>

### UI Mode Updates

![Playwright UI Mode](https://github.com/microsoft/playwright/assets/746130/8ba27be0-58fd-4f62-8561-950480610369)

1. Zoom into time range.
1. Network panel redesign.

### New APIs

- [`event: BrowserContext.webError`]
- [`method: Locator.pressSequentially`]
- The [`method: Reporter.onEnd`] now reports `startTime` and total run `duration`.

### Deprecations

* The following methods were deprecated: [`method: Page.type`], [`method: Frame.type`],
  [`method: Locator.type`] and [`method: ElementHandle.type`].
  Please use [`method: Locator.fill`] instead which is much faster. Use
  [`method: Locator.pressSequentially`] only if there is a special keyboard
  handling on the page, and you need to press keys one-by-one.

### Breaking Changes: Playwright no longer downloads browsers automatically

> **Note**: If you are using `@playwright/test` package, this change does not affect you.

Playwright recommends to use `@playwright/test` package and download browsers via `npx playwright install` command. If you are following this recommendation, nothing has changed for you.

However, up to v1.38, installing the `playwright` package instead of `@playwright/test` did automatically download browsers. This is no longer the case, and we recommend to explicitly download browsers via `npx playwright install` command.

**v1.37 and earlier**

`playwright` package was downloading browsers during `npm install`, while `@playwright/test` was not.

**v1.38 and later**

`playwright` and `@playwright/test` packages do not download browsers during `npm install`.

**Recommended migration**

Run `npx playwright install` to download browsers after `npm install`. For example, in your CI configuration:

```yml
- run: npm ci
- run: npx playwright install --with-deps
```

**Alternative migration option - not recommended**

Add `@playwright/browser-chromium`, `@playwright/browser-firefox` and `@playwright/browser-webkit` as a dependency. These packages download respective browsers during `npm install`. Make sure you keep the version of all playwright packages in sync:

```json
// package.json
{
  "devDependencies": {
    "playwright": "1.38.0",
    "@playwright/browser-chromium": "1.38.0",
    "@playwright/browser-firefox": "1.38.0",
    "@playwright/browser-webkit": "1.38.0"
  }
}
```

### Browser Versions

* Chromium 117.0.5938.62
* Mozilla Firefox 117.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 116
* Microsoft Edge 116

## Version 1.37

<LiteYouTube
  id="cEd4SH_Xf5U"
  title="Playwright 1.36 & 1.37"
/>

### New `npx playwright merge-reports` tool

If you run tests on multiple shards, you can now merge all reports in a single HTML report (or any other report)
using the new `merge-reports` CLI tool.

Using `merge-reports` tool requires the following steps:

1. Adding a new "blob" reporter to the config when running on CI:

  ```js title="playwright.config.ts"
  export default defineConfig({
    testDir: './tests',
    reporter: process.env.CI ? 'blob' : 'html',
  });
  ```

  The "blob" reporter will produce ".zip" files that contain all the information
  about the test run.

2. Copying all "blob" reports in a single shared location and running `npx playwright merge-reports`:

  ```bash
  npx playwright merge-reports --reporter html ./all-blob-reports
  ```

  Read more in [our documentation](./test-sharding.md).

### 📚 Debian 12 Bookworm Support

Playwright now supports Debian 12 Bookworm on both x86_64 and arm64 for Chromium, Firefox and WebKit.
Let us know if you encounter any issues!

Linux support looks like this:

|          | Ubuntu 20.04 | Ubuntu 22.04 | Debian 11 | Debian 12 |
| :--- | :---: | :---: | :---: | :---: |
| Chromium | ✅ | ✅ | ✅ | ✅ |
| WebKit | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ |

### UI Mode Updates

- UI Mode now respects project dependencies. You can control which dependencies to respect by checking/unchecking them in a projects list.
- Console logs from the test are now displayed in the Console tab.

### Browser Versions

* Chromium 116.0.5845.82
* Mozilla Firefox 115.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 115
* Microsoft Edge 115

## Version 1.36

🏝️ Summer maintenance release.

### Browser Versions

* Chromium 115.0.5790.75
* Mozilla Firefox 115.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 114
* Microsoft Edge 114

## Version 1.35

<LiteYouTube
  id="pJiirfyJwcA"
  title="Playwright 1.35"
/>

### Highlights

* UI mode is now available in VSCode Playwright extension via a new "Show trace viewer" button:

  ![Playwright UI Mode](https://github.com/microsoft/playwright/assets/746130/13094128-259b-477a-8bbb-c1181178e8a2)

* UI mode and trace viewer mark network requests handled with [`method: Page.route`] and [`method: BrowserContext.route`] handlers, as well as those issued via the [API testing](./api-testing):

  ![Trace Viewer](https://github.com/microsoft/playwright/assets/746130/0df2d4b6-faa3-465c-aff3-c435b430bfe1)

* New option `maskColor` for methods [`method: Page.screenshot`], [`method: Locator.screenshot`], [`method: PageAssertions.toHaveScreenshot#1`] and [`method: LocatorAssertions.toHaveScreenshot#1`] to change default masking color:
  ```js
  await page.goto('https://playwright.dev');
  await expect(page).toHaveScreenshot({
    mask: [page.locator('img')],
    maskColor: '#00FF00', // green
  });
  ```

* New `uninstall` CLI command to uninstall browser binaries:
  ```bash
  $ npx playwright uninstall # remove browsers installed by this installation
  $ npx playwright uninstall --all # remove all ever-install Playwright browsers
  ```

* Both UI mode and trace viewer now could be opened in a browser tab:
  ```bash
  $ npx playwright test --ui-port 0 # open UI mode in a tab on a random port
  $ npx playwright show-trace --port 0 # open trace viewer in tab on a random port
  ```

### ⚠️ Breaking changes

* `playwright-core` binary got renamed from `playwright` to `playwright-core`. So if you use `playwright-core` CLI, make sure to update the name:
  ```bash
  $ npx playwright-core install # the new way to install browsers when using playwright-core
  ```

  This change **does not** affect `@playwright/test` and `playwright` package users.

### Browser Versions

* Chromium 115.0.5790.13
* Mozilla Firefox 113.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 114
* Microsoft Edge 114

## Version 1.34

<LiteYouTube
  id="JeFD6rqDbBo"
  title="Playwright 1.34"
/>

### Highlights

* UI Mode now shows steps, fixtures and attachments:
  ![UI Mode attachments](https://github.com/microsoft/playwright/assets/746130/1d280419-d79a-4a56-b2dc-54d631281d56)
* New property [`property: TestProject.teardown`] to specify a project that needs to run after this
  and all dependent projects have finished. Teardown is useful to cleanup any resources acquired by this project.

  A common pattern would be a `setup` dependency with a corresponding `teardown`:
  ```js title="playwright.config.ts"
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    projects: [
      {
        name: 'setup',
        testMatch: /global.setup\.ts/,
        teardown: 'teardown',
      },
      {
        name: 'teardown',
        testMatch: /global.teardown\.ts/,
      },
      {
        name: 'chromium',
        use: devices['Desktop Chrome'],
        dependencies: ['setup'],
      },
      {
        name: 'firefox',
        use: devices['Desktop Firefox'],
        dependencies: ['setup'],
      },
      {
        name: 'webkit',
        use: devices['Desktop Safari'],
        dependencies: ['setup'],
      },
    ],
  });
  ```
* New method [`expect.configure`](./test-assertions.md#expectconfigure) to
  create pre-configured expect instance with its own defaults such as `timeout`
  and `soft`.

  ```js
  const slowExpect = expect.configure({ timeout: 10000 });
  await slowExpect(locator).toHaveText('Submit');

  // Always do soft assertions.
  const softExpect = expect.configure({ soft: true });
  ```

* New options `stderr` and `stdout`  in [`property: TestConfig.webServer`] to configure output handling:

  ```js title="playwright.config.ts"
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    // Run your local dev server before starting the tests
    webServer: {
      command: 'npm run start',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  });
  ```
* New [`method: Locator.and`] to create a locator that matches both locators.

    ```js
    const button = page.getByRole('button').and(page.getByTitle('Subscribe'));
    ```

* New events [`event: BrowserContext.console`] and [`event: BrowserContext.dialog`] to subscribe to any dialogs
  and console messages from any page from the given browser context. Use the new methods [`method: ConsoleMessage.page`]
  and [`method: Dialog.page`] to pin-point event source.

### ⚠️ Breaking changes

* `npx playwright test` no longer works if you install both `playwright` and `@playwright/test`. There's no need
  to install both, since you can always import browser automation APIs from `@playwright/test` directly:

  ```js title="automation.ts"
  import { chromium, firefox, webkit } from '@playwright/test';
  /* ... */
  ```
* Node.js 14 is no longer supported since it [reached its end-of-life](https://nodejs.dev/en/about/releases/) on April 30, 2023.

### Browser Versions

* Chromium 114.0.5735.26
* Mozilla Firefox 113.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 113
* Microsoft Edge 113

## Version 1.33

<LiteYouTube
  id="JeFD6rqDbBo"
  title="Playwright 1.33"
/>

### Locators Update

* Use [`method: Locator.or`] to create a locator that matches either of the two locators.
  Consider a scenario where you'd like to click on a "New email" button, but sometimes a security settings dialog shows up instead.
  In this case, you can wait for either a "New email" button, or a dialog and act accordingly:

    ```js
    const newEmail = page.getByRole('button', { name: 'New email' });
    const dialog = page.getByText('Confirm security settings');
    await expect(newEmail.or(dialog)).toBeVisible();
    if (await dialog.isVisible())
      await page.getByRole('button', { name: 'Dismiss' }).click();
    await newEmail.click();
    ```
* Use new options [`option: Locator.filter.hasNot`] and [`option: Locator.filter.hasNotText`] in [`method: Locator.filter`]
  to find elements that **do not match** certain conditions.

    ```js
    const rowLocator = page.locator('tr');
    await rowLocator
        .filter({ hasNotText: 'text in column 1' })
        .filter({ hasNot: page.getByRole('button', { name: 'column 2 button' }) })
        .screenshot();
    ```
* Use new web-first assertion [`method: LocatorAssertions.toBeAttached`] to ensure that the element
  is present in the page's DOM. Do not confuse with the [`method: LocatorAssertions.toBeVisible`] that ensures that
  element is both attached & visible.

### New APIs

- [`method: Locator.or`]
- New option [`option: Locator.filter.hasNot`] in [`method: Locator.filter`]
- New option [`option: Locator.filter.hasNotText`] in [`method: Locator.filter`]
- [`method: LocatorAssertions.toBeAttached`]
- New option [`option: Route.fetch.timeout`] in [`method: Route.fetch`]
- [`method: Reporter.onExit`]

### ⚠️ Breaking change

* The `mcr.microsoft.com/playwright:v1.33.0` now serves a Playwright image based on Ubuntu Jammy.
  To use the focal-based image, please use `mcr.microsoft.com/playwright:v1.33.0-focal` instead.

### Browser Versions

* Chromium 113.0.5672.53
* Mozilla Firefox 112.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 112
* Microsoft Edge 112

## Version 1.32

<LiteYouTube
  id="jF0yA-JLQW0"
  title="Playwright 1.32"
/>

### Introducing UI Mode (preview)

New [UI Mode](./test-ui-mode.md) lets you explore, run and debug tests. Comes with a built-in watch mode.

![Playwright UI Mode](https://user-images.githubusercontent.com/746130/227004851-3901a691-4f8e-43d6-8d6b-cbfeafaeb999.png)

Engage with a new flag `--ui`:

```sh
npx playwright test --ui
```

### New APIs

- New options [`option: Page.routeFromHAR.updateMode`] and [`option: Page.routeFromHAR.updateContent`] in [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`].
- Chaining existing locator objects, see [locator docs](./locators.md#matching-inside-a-locator) for details.
- New property [`property: TestInfo.testId`].
- New option [`option: Tracing.startChunk.name`] in method [`method: Tracing.startChunk`].


### ⚠️ Breaking change in component tests

Note: **component tests only**, does not affect end-to-end tests.

* `@playwright/experimental-ct-react` now supports **React 18 only**.
* If you're running component tests with React 16 or 17, please replace
  `@playwright/experimental-ct-react` with `@playwright/experimental-ct-react17`.

### Browser Versions

* Chromium 112.0.5615.29
* Mozilla Firefox 111.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 111
* Microsoft Edge 111

## Version 1.31

<LiteYouTube
  id="PI50YAPTAs4"
  title="Playwright 1.31"
/>

### New APIs

- New property [`property: TestProject.dependencies`] to configure dependencies between projects.

  Using dependencies allows global setup to produce traces and other artifacts,
  see the setup steps in the test report and more.

  ```js title="playwright.config.ts"
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    projects: [
      {
        name: 'setup',
        testMatch: /global.setup\.ts/,
      },
      {
        name: 'chromium',
        use: devices['Desktop Chrome'],
        dependencies: ['setup'],
      },
      {
        name: 'firefox',
        use: devices['Desktop Firefox'],
        dependencies: ['setup'],
      },
      {
        name: 'webkit',
        use: devices['Desktop Safari'],
        dependencies: ['setup'],
      },
    ],
  });
  ```

- New assertion [`method: LocatorAssertions.toBeInViewport`] ensures that locator points to an element that intersects viewport, according to the [intersection observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

  ```js
  const button = page.getByRole('button');

  // Make sure at least some part of element intersects viewport.
  await expect(button).toBeInViewport();

  // Make sure element is fully outside of viewport.
  await expect(button).not.toBeInViewport();

  // Make sure that at least half of the element intersects viewport.
  await expect(button).toBeInViewport({ ratio: 0.5 });
  ```


### Miscellaneous

- DOM snapshots in trace viewer can be now opened in a separate window.
- New method `defineConfig` to be used in `playwright.config`.
- New option [`option: Route.fetch.maxRedirects`] for method [`method: Route.fetch`].
- Playwright now supports Debian 11 arm64.
- Official [docker images](./docker.md) now include Node 18 instead of Node 16.


### ⚠️ Breaking change in component tests

Note: **component tests only**, does not affect end-to-end tests.

`playwright-ct.config` configuration file for [component testing](./test-components.md) now requires calling `defineConfig`.

```js
// Before

import { type PlaywrightTestConfig, devices } from '@playwright/experimental-ct-react';
const config: PlaywrightTestConfig = {
  // ... config goes here ...
};
export default config;
```

Replace `config` variable definition with `defineConfig` call:

```js
// After

import { defineConfig, devices } from '@playwright/experimental-ct-react';
export default defineConfig({
  // ... config goes here ...
});
```

### Browser Versions

* Chromium 111.0.5563.19
* Mozilla Firefox 109.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 110
* Microsoft Edge 110


## Version 1.30

### Browser Versions

* Chromium 110.0.5481.38
* Mozilla Firefox 108.0.2
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 109
* Microsoft Edge 109


## Version 1.29

<LiteYouTube
  id="VbVlz61VtNo"
  title="Playwright 1.29"
/>

### New APIs

- New method [`method: Route.fetch`] and new option `json` for [`method: Route.fulfill`]:

    ```js
    await page.route('**/api/settings', async route => {
      // Fetch original settings.
      const response = await route.fetch();

      // Force settings theme to a predefined value.
      const json = await response.json();
      json.theme = 'Solorized';

      // Fulfill with modified data.
      await route.fulfill({ json });
    });
    ```

- New method [`method: Locator.all`] to iterate over all matching elements:

    ```js
    // Check all checkboxes!
    const checkboxes = page.getByRole('checkbox');
    for (const checkbox of await checkboxes.all())
      await checkbox.check();
    ```

- [`method: Locator.selectOption`] matches now by value or label:

  ```html
  <select multiple>
    <option value="red">Red</option>
    <option value="green">Green</option>
    <option value="blue">Blue</option>
  </select>
  ```

  ```js
  await element.selectOption('Red');
  ```

- Retry blocks of code until all assertions pass:

    ```js
    await expect(async () => {
      const response = await page.request.get('https://api.example.com');
      await expect(response).toBeOK();
    }).toPass();
    ```

  Read more in [our documentation](./test-assertions.md#expecttopass).

- Automatically capture **full page screenshot** on test failure:
    ```js title="playwright.config.ts"
    import { defineConfig } from '@playwright/test';
    export default defineConfig({
      use: {
        screenshot: {
          mode: 'only-on-failure',
          fullPage: true,
        }
      }
    });
    ```

### Miscellaneous

- Playwright Test now respects [`jsconfig.json`](https://code.visualstudio.com/docs/languages/jsconfig).
- New options `args` and `proxy` for [`method: AndroidDevice.launchBrowser`].
- Option `postData` in method [`method: Route.continue`] now supports [Serializable] values.

### Browser Versions

* Chromium 109.0.5414.46
* Mozilla Firefox 107.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 108
* Microsoft Edge 108

## Version 1.28

<LiteYouTube
  id="tVSq-0n-TY4"
  title="Playwright 1.28"
/>

### Playwright Tools

* **Record at Cursor in VSCode.** You can run the test, position the cursor at the end of the test and continue generating the test.

![New VSCode Extension](https://user-images.githubusercontent.com/746130/202005839-aba2eeba-217b-424d-8496-8b4f5fa72f41.png)

* **Live Locators in VSCode.** You can hover and edit locators in VSCode to get them  highlighted in the opened browser.
* **Live Locators in CodeGen.** Generate a locator for any element on the page using "Explore" tool.

![Locator Explorer](https://user-images.githubusercontent.com/746130/201796876-01567a0b-ca61-4a9d-b12b-04786c471671.png)

* **Codegen and Trace Viewer Dark Theme.** Automatically picked up from operating system settings.

![Dark Theme](https://user-images.githubusercontent.com/746130/201797969-603f74df-d7cf-4c56-befd-798dbd269796.png)


### Test Runner

* Configure retries and test timeout for a file or a test with [`method: Test.describe.configure`].

    ```js
    // Each test in the file will be retried twice and have a timeout of 20 seconds.
    test.describe.configure({ retries: 2, timeout: 20_000 });
    test('runs first', async ({ page }) => {});
    test('runs second', async ({ page }) => {});
    ```

* Use [`property: TestProject.snapshotPathTemplate`] and [`property: TestConfig.snapshotPathTemplate`] to configure a template controlling location of snapshots generated by [`method: PageAssertions.toHaveScreenshot#1`] and [`method: SnapshotAssertions.toMatchSnapshot#1`].

    ```js title="playwright.config.ts"
    import { defineConfig } from '@playwright/test';
    export default defineConfig({
      testDir: './tests',
      snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
    });
    ```

### New APIs

- [`method: Locator.blur`]
- [`method: Locator.clear`]
- [`method: Android.launchServer`] and  [`method: Android.connect`]
- [`event: AndroidDevice.close`]

### Browser Versions

* Chromium 108.0.5359.29
* Mozilla Firefox 106.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 107
* Microsoft Edge 107


## Version 1.27

<LiteYouTube
  id="b84eqab3kwc"
  title="Playwright 1.27"
/>


### Locators

With these new APIs writing locators is a joy:
- [`method: Page.getByText`] to locate by text content.
- [`method: Page.getByRole`] to locate by [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
- [`method: Page.getByLabel`] to locate a form control by associated label's text.
- [`method: Page.getByTestId`] to locate an element based on its `data-testid` attribute (other attribute can be configured).
- [`method: Page.getByPlaceholder`] to locate an input by placeholder.
- [`method: Page.getByAltText`] to locate an element, usually image, by its text alternative.
- [`method: Page.getByTitle`] to locate an element by its title.

```js
await page.getByLabel('User Name').fill('John');

await page.getByLabel('Password').fill('secret-password');

await page.getByRole('button', { name: 'Sign in' }).click();

await expect(page.getByText('Welcome, John!')).toBeVisible();
```

All the same methods are also available on [Locator], [FrameLocator] and [Frame] classes.

### Other highlights

- `workers` option in the `playwright.config.ts` now accepts a percentage string to use some of the available CPUs. You can also pass it in the command line:
  ```bash
  npx playwright test --workers=20%
  ```

- New options `host` and `port` for the html reporter.
  ```js
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    reporter: [['html', { host: 'localhost', port: '9223' }]],
  });
  ```

- New field `FullConfig.configFile` is available to test reporters, specifying the path to the config file if any.

- As announced in v1.25, Ubuntu 18 will not be supported as of Dec 2022. In addition to that, there will be no WebKit updates on Ubuntu 18 starting from the next Playwright release.

### Behavior Changes

- [`method: LocatorAssertions.toHaveAttribute`] with an empty value does not match missing attribute anymore. For example, the following snippet will succeed when `button` **does not** have a `disabled` attribute.

   ```js
   await expect(page.getByRole('button')).toHaveAttribute('disabled', '');
   ```

- Command line options `--grep` and `--grep-invert` previously incorrectly ignored `grep` and `grepInvert` options specified in the config. Now all of them are applied together.

### Browser Versions

* Chromium 107.0.5304.18
* Mozilla Firefox 105.0.1
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 106
* Microsoft Edge 106


## Version 1.26

<LiteYouTube
  id="b84eqab3kwc"
  title="Playwright 1.26"
/>

### Assertions

- New option `enabled` for [`method: LocatorAssertions.toBeEnabled`].
- [`method: LocatorAssertions.toHaveText`] now pierces open shadow roots.
- New option `editable` for [`method: LocatorAssertions.toBeEditable`].
- New option `visible` for [`method: LocatorAssertions.toBeVisible`].

### Other highlights

- New option `maxRedirects` for [`method: APIRequestContext.get`] and others to limit redirect count.
- New command-line flag `--pass-with-no-tests` that allows the test suite to pass when no files are found.
- New command-line flag `--ignore-snapshots` to skip snapshot expectations, such as `expect(value).toMatchSnapshot()` and `expect(page).toHaveScreenshot()`.

### Behavior Change

A bunch of Playwright APIs already support the `waitUntil: 'domcontentloaded'` option.
For example:

```js
await page.goto('https://playwright.dev', {
  waitUntil: 'domcontentloaded',
});
```

Prior to 1.26, this would wait for all iframes to fire the `DOMContentLoaded`
event.

To align with web specification, the `'domcontentloaded'` value only waits for
the target frame to fire the `'DOMContentLoaded'` event. Use `waitUntil: 'load'` to wait for all iframes.

### Browser Versions

* Chromium 106.0.5249.30
* Mozilla Firefox 104.0
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 105
* Microsoft Edge 105

## Version 1.25

<LiteYouTube
  id="NFLHA57a-so"
  title="Playwright 1.25"
/>

### VSCode Extension

* Watch your tests running live & keep devtools open.
* Pick selector.
* Record new test from current page state.

![vscode extension screenshot](https://user-images.githubusercontent.com/746130/183781999-1b9fdbc5-cfae-47d6-b4f7-5d4ae89716a8.jpg)

### Test Runner

* [`method: Test.step`] now returns the value of the step function:

    ```js
    test('should work', async ({ page }) => {
      const pageTitle = await test.step('get title', async () => {
        await page.goto('https://playwright.dev');
        return await page.title();
      });
      console.log(pageTitle);
    });
    ```

* Added [`method: Test.describe.fixme`].
* New `'interrupted'` test status.
* Enable tracing via CLI flag: `npx playwright test --trace=on`.

### Announcements

* 🎁 We now ship Ubuntu 22.04 Jammy Jellyfish docker image: `mcr.microsoft.com/playwright:v1.34.0-jammy`.
* 🪦 This is the last release with macOS 10.15 support (deprecated as of 1.21).
* 🪦 This is the last release with Node.js 12 support, we recommend upgrading to Node.js LTS (16).
* ⚠️ Ubuntu 18 is now deprecated and will not be supported as of Dec 2022.

### Browser Versions

* Chromium 105.0.5195.19
* Mozilla Firefox 103.0
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 104
* Microsoft Edge 104


## Version 1.24

<LiteYouTube
  id="9F05o1shxcY"
  title="Playwright 1.24"
/>

### 🌍 Multiple Web Servers in `playwright.config.ts`

Launch multiple web servers, databases, or other processes by passing an array of configurations:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: [
    {
      command: 'npm run start',
      url: 'http://127.0.0.1:3000',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run backend',
      url: 'http://127.0.0.1:3333',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ],
  use: {
    baseURL: 'http://localhost:3000/',
  },
});
```

### 🐂 Debian 11 Bullseye Support

Playwright now supports Debian 11 Bullseye on x86_64 for Chromium, Firefox and WebKit. Let us know
if you encounter any issues!

Linux support looks like this:

|          | Ubuntu 20.04 | Ubuntu 22.04 | Debian 11
| :--- | :---: | :---: | :---: | :---: |
| Chromium | ✅ | ✅ | ✅ |
| WebKit | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |

### 🕵️ Anonymous Describe

It is now possible to call [`method: Test.describe`] to create suites without a title. This is useful for giving a group of tests a common option with [`method: Test.use`].

```js
test.describe(() => {
  test.use({ colorScheme: 'dark' });

  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

### 🧩 Component Tests Update

Playwright 1.24 Component Tests introduce `beforeMount` and `afterMount` hooks.
Use these to configure your app for tests.

For example, this could be used to setup App router in Vue.js:

```js title="src/component.spec.ts"
import { test } from '@playwright/experimental-ct-vue';
import { Component } from './mycomponent';

test('should work', async ({ mount }) => {
  const component = await mount(Component, {
    hooksConfig: {
      /* anything to configure your app */
    }
  });
});
```

```js title="playwright/index.ts"
import { router } from '../router';
import { beforeMount } from '@playwright/experimental-ct-vue/hooks';

beforeMount(async ({ app, hooksConfig }) => {
  app.use(router);
});
```

A similar configuration in Next.js would look like this:

```js title="src/component.spec.jsx"
import { test } from '@playwright/experimental-ct-react';
import { Component } from './mycomponent';

test('should work', async ({ mount }) => {
  const component = await mount(<Component></Component>, {
    // Pass mock value from test into `beforeMount`.
    hooksConfig: {
      router: {
        query: { page: 1, per_page: 10 },
        asPath: '/posts'
      }
    }
  });
});
```

```js title="playwright/index.js"
import router from 'next/router';
import { beforeMount } from '@playwright/experimental-ct-react/hooks';

beforeMount(async ({ hooksConfig }) => {
  // Before mount, redefine useRouter to return mock value from test.
  router.useRouter = () => hooksConfig.router;
});
```

## Version 1.23

<LiteYouTube
  id="NRGOV46P3kU"
  title="Playwright 1.23"
/>

### Network Replay

Now you can record network traffic into a HAR file and re-use this traffic in your tests.

To record network into HAR file:

```bash
npx playwright open --save-har=github.har.zip https://github.com/microsoft
```

Alternatively, you can record HAR programmatically:

```js
const context = await browser.newContext({
  recordHar: { path: 'github.har.zip' }
});
// ... do stuff ...
await context.close();
```

Use the new methods [`method: Page.routeFromHAR`] or [`method: BrowserContext.routeFromHAR`] to serve matching responses from the [HAR](http://www.softwareishard.com/blog/har-12-spec/) file:


```js
await context.routeFromHAR('github.har.zip');
```

Read more in [our documentation](./mock.md#mocking-with-har-files).


### Advanced Routing

You can now use [`method: Route.fallback`] to defer routing to other handlers.

Consider the following example:

```js
// Remove a header from all requests.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const headers = await route.request().allHeaders();
    delete headers['if-none-match'];
    await route.fallback({ headers });
  });
});

test('should work', async ({ page }) => {
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image')
      await route.abort();
    else
      await route.fallback();
  });
});
```

Note that the new methods [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`] also participate in routing and could be deferred to.

### Web-First Assertions Update

* New method [`method: LocatorAssertions.toHaveValues`] that asserts all selected values of `<select multiple>` element.
* Methods [`method: LocatorAssertions.toContainText`] and [`method: LocatorAssertions.toHaveText`] now accept `ignoreCase` option.

### Component Tests Update

* Support for Vue2 via the [`@playwright/experimental-ct-vue2`](https://www.npmjs.com/package/@playwright/experimental-ct-vue2) package.
* Support for component tests for [create-react-app](https://www.npmjs.com/package/create-react-app) with components in `.js` files.

Read more about [component testing with Playwright](./test-components).

### Miscellaneous

* If there's a service worker that's in your way, you can now easily disable it with a new context option `serviceWorkers`:
  ```js title="playwright.config.ts"
  export default {
    use: {
      serviceWorkers: 'block',
    }
  };
  ```
* Using `.zip` path for `recordHar` context option automatically zips the resulting HAR:
  ```js
  const context = await browser.newContext({
    recordHar: {
      path: 'github.har.zip',
    }
  });
  ```
* If you intend to edit HAR by hand, consider using the `"minimal"` HAR recording mode
  that only records information that is essential for replaying:
  ```js
  const context = await browser.newContext({
    recordHar: {
      path: 'github.har',
      mode: 'minimal',
    }
  });
  ```
* Playwright now runs on Ubuntu 22 amd64 and Ubuntu 22 arm64. We also publish new docker image `mcr.microsoft.com/playwright:v1.34.0-jammy`.

### ⚠️ Breaking Changes ⚠️

WebServer is now considered "ready" if request to the specified url has any of the following HTTP status codes:

* `200-299`
* `300-399` (new)
* `400`, `401`, `402`, `403` (new)


## Version 1.22

<LiteYouTube
  id="keV2CIgtBlg"
  title="Playwright 1.22"
/>

### Highlights

- Components Testing (preview)

  Playwright Test can now test your [React](https://reactjs.org/),
  [Vue.js](https://vuejs.org/) or [Svelte](https://svelte.dev/) components.
  You can use all the features
  of Playwright Test (such as parallelization, emulation & debugging) while running components
  in real browsers.

  Here is what a typical component test looks like:

  ```js title="App.spec.tsx"
  import { test, expect } from '@playwright/experimental-ct-react';
  import App from './App';

  // Let's test component in a dark scheme!
  test.use({ colorScheme: 'dark' });

  test('should render', async ({ mount }) => {
    const component = await mount(<App></App>);

    // As with any Playwright test, assert locator text.
    await expect(component).toContainText('React');
    // Or do a screenshot 🚀
    await expect(component).toHaveScreenshot();
    // Or use any Playwright method
    await component.click();
  });
  ```

  Read more in [our documentation](./test-components).

- Role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```js
  // Click a button with accessible name "log in"
  await page.locator('role=button[name="log in"]').click();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).

- New [`method: Locator.filter`] API to filter an existing locator

  ```js
  const buttons = page.locator('role=button');
  // ...
  const submitButton = buttons.filter({ hasText: 'Submit' });
  await submitButton.click();
  ```

- New web-first assertions [`method: PageAssertions.toHaveScreenshot#1`] and [`method: LocatorAssertions.toHaveScreenshot#1`] that
  wait for screenshot stabilization and enhances test reliability.

  The new assertions has screenshot-specific defaults, such as:
  * disables animations
  * uses CSS scale option

  ```js
  await page.goto('https://playwright.dev');
  await expect(page).toHaveScreenshot();
  ```

  The new [`method: PageAssertions.toHaveScreenshot#1`] saves screenshots at the same
  location as [`method: SnapshotAssertions.toMatchSnapshot#1`].


## Version 1.21

<LiteYouTube
  id="45HZdbmgEw8"
  title="Playwright 1.21"
/>

### Highlights

- New role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```js
  // Click a button with accessible name "log in"
  await page.locator('role=button[name="log in"]').click();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).
- New `scale` option in [`method: Page.screenshot`] for smaller sized screenshots.
- New `caret` option in [`method: Page.screenshot`] to control text caret. Defaults to `"hide"`.

- New method `expect.poll` to wait for an arbitrary condition:

  ```js
  // Poll the method until it returns an expected result.
  await expect.poll(async () => {
    const response = await page.request.get('https://api.example.com');
    return response.status();
  }).toBe(200);
  ```

  `expect.poll` supports most synchronous matchers, like `.toBe()`, `.toContain()`, etc.
  Read more in [our documentation](./test-assertions.md#expectpoll).

### Behavior Changes

- ESM support when running TypeScript tests is now enabled by default. The `PLAYWRIGHT_EXPERIMENTAL_TS_ESM` env variable is
  no longer required.
- The `mcr.microsoft.com/playwright` docker image no longer contains Python. Please use `mcr.microsoft.com/playwright/python`
  as a Playwright-ready docker image with pre-installed Python.
- Playwright now supports large file uploads (100s of MBs) via [`method: Locator.setInputFiles`] API.

### Browser Versions

- Chromium 101.0.4951.26
- Mozilla Firefox 98.0.2
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 100
- Microsoft Edge 100


## Version 1.20

<LiteYouTube
  id="6vV-XXKsrbA"
  title="Playwright 1.20"
/>

### Highlights

- New options for methods [`method: Page.screenshot`], [`method: Locator.screenshot`] and [`method: ElementHandle.screenshot`]:
  * Option `animations: "disabled"` rewinds all CSS animations and transitions to a consistent state
  * Option `mask: Locator[]` masks given elements, overlaying them with pink `#FF00FF` boxes.
- `expect().toMatchSnapshot()` now supports anonymous snapshots: when snapshot name is missing, Playwright Test will generate one
  automatically:

  ```js
  expect('Web is Awesome <3').toMatchSnapshot();
  ```
- New `maxDiffPixels` and `maxDiffPixelRatio` options for fine-grained screenshot comparison using `expect().toMatchSnapshot()`:

  ```js
  expect(await page.screenshot()).toMatchSnapshot({
    maxDiffPixels: 27, // allow no more than 27 different pixels.
  });
  ```

  It is most convenient to specify `maxDiffPixels` or `maxDiffPixelRatio` once in [`property: TestConfig.expect`].

- Playwright Test now adds [`property: TestConfig.fullyParallel`] mode. By default, Playwright Test parallelizes between files. In fully parallel mode, tests inside a single file are also run in parallel. You can also use `--fully-parallel` command line flag.

  ```js title="playwright.config.ts"
  export default {
    fullyParallel: true,
  };
  ```

- [`property: TestProject.grep`] and [`property: TestProject.grepInvert`] are now configurable per project. For example, you can now
  configure smoke tests project using `grep`:
  ```js title="playwright.config.ts"
  export default {
    projects: [
      {
        name: 'smoke tests',
        grep: /@smoke/,
      },
    ],
  };
  ```

- [Trace Viewer](./trace-viewer) now shows [API testing requests](./api-testing).
- [`method: Locator.highlight`] visually reveals element(s) for easier debugging.

### Announcements

- We now ship a designated Python docker image `mcr.microsoft.com/playwright/python`. Please switch over to it if you use
  Python. This is the last release that includes Python inside our javascript `mcr.microsoft.com/playwright` docker image.
- v1.20 is the last release to receive WebKit update for macOS 10.15 Catalina. Please update macOS to keep using latest & greatest WebKit!

### Browser Versions

- Chromium 101.0.4921.0
- Mozilla Firefox 97.0.1
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 99
- Microsoft Edge 99

## Version 1.19

<LiteYouTube
  id="z0EOFvlf14U"
  title="Playwright 1.19"
/>

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

- You can now specify a **custom expect message** as a second argument to the `expect` and `expect.soft` functions, for example:

  ```js
  await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
  ```

  The error would look like this:

  ```bash
      Error: should be logged in

      Call log:
        - expect.toBeVisible with timeout 5000ms
        - waiting for "getByText('Name')"


        2 |
        3 | test('example test', async({ page }) => {
      > 4 |   await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
          |                                                                  ^
        5 | });
        6 |
  ```

  Read more in [our documentation](./test-assertions#custom-expect-message)
- By default, tests in a single file are run in order. If you have many independent tests in a single file, you can now
  run them in parallel with [`method: Test.describe.configure`].

### Other Updates

- Locator now supports a `has` option that makes sure it contains another locator inside:

  ```js
  await page.locator('article', {
    has: page.locator('.highlight'),
  }).click();
  ```

  Read more in [locator documentation](./api/class-locator#locator-locator)

- New [`method: Locator.page`]
- [`method: Page.screenshot`] and [`method: Locator.screenshot`] now automatically hide blinking caret
- Playwright Codegen now generates locators and frame locators
- New option `url`  in [`property: TestConfig.webServer`] to ensure your web server is ready before running the tests
- New [`property: TestInfo.errors`] and [`property: TestResult.errors`] that contain all failed assertions and soft assertions.


### Potentially breaking change in Playwright Test Global Setup

It is unlikely that this change will affect you, no action is required if your tests keep running as they did.

We've noticed that in rare cases, the set of tests to be executed was configured in the global setup by means of the environment variables. We also noticed some applications that were post processing the reporters' output in the global teardown. If you are doing one of the two, [learn more](https://github.com/microsoft/playwright/issues/12018)

### Browser Versions

- Chromium 100.0.4863.0
- Mozilla Firefox 96.0.1
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 98
- Microsoft Edge 98


## Version 1.18

<LiteYouTube
  id="ABLYpw2BN_g"
  title="Playwright 1.18"
/>

### Locator Improvements

- [`method: Locator.dragTo`]
- [`expect(locator).toBeChecked({ checked })`](./api/class-locatorassertions#locator-assertions-to-be-checked)
- Each locator can now be optionally filtered by the text it contains:
    ```js
    await page.locator('li', { hasText: 'my item' }).locator('button').click();
    ```
    Read more in [locator documentation](./api/class-locator#locator-locator)


### Testing API improvements

- [`expect(response).toBeOK()`](./test-assertions)
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
npm init playwright@latest
# Or create a new project
npm init playwright@latest new-project
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

<LiteYouTube
  id="7iyIdeoAP04"
  title="Playwright 1.17"
/>

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
- [`expect.toMatchSnapshot`](./api/class-genericassertions.md) supports subdirectories
- [`reporter.printsToStdio()`](./api/class-reporter#reporter-prints-to-stdio)


## Version 1.16

<LiteYouTube
  id="OQKwFDmY64g"
  title="Playwright 1.16"
/>

### 🎭 Playwright Test

#### API Testing

Playwright 1.16 introduces new [API Testing](./api/class-apirequestcontext) that lets you send requests to the server directly from Node.js!
Now you can:

- test your server API
- prepare server side state before visiting the web application in a test
- validate server side post-conditions after running some actions in the browser

To do a request on behalf of Playwright's Page, use **new [`property: Page.request`] API**:

```js
import { test, expect } from '@playwright/test';

test('context fetch', async ({ page }) => {
  // Do a GET request on behalf of page
  const response = await page.request.get('http://example.com/foo.json');
  // ...
});
```

To do a stand-alone request from node.js to an API endpoint, use **new [`request` fixture](./api/class-fixtures#fixtures-request)**:

```js
import { test, expect } from '@playwright/test';

test('context fetch', async ({ request }) => {
  // Do a GET request on behalf of page
  const response = await request.get('http://example.com/foo.json');
  // ...
});
```

Read more about it in our [API testing guide](./api-testing).

#### Response Interception

It is now possible to do response interception by combining [API Testing](./api-testing) with [request interception](./network#modify-requests).

For example, we can blur all the images on the page:

```js
import { test, expect } from '@playwright/test';
import jimp from 'jimp'; // image processing library

test('response interception', async ({ page }) => {
  await page.route('**/*.jpeg', async route => {
    const response = await page._request.fetch(route.request());
    const image = await jimp.read(await response.body());
    await image.blur(5);
    await route.fulfill({
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

Read more about [our reporters](./test-reporters#html-reporter).

### 🎭 Playwright Library

#### locator.waitFor

Wait for a locator to resolve to a single element with a given state.
Defaults to the `state: 'visible'`.

Comes especially handy when working with lists:

```js
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

<LiteYouTube
  id="6RwzsDeEj7Y"
  title="Playwright 1.15"
/>

### 🎭 Playwright Library

#### 🖱️ Mouse Wheel

By using [`method: Mouse.wheel`] you are now able to scroll vertically or horizontally.

#### 📜 New Headers API

Previously it was not possible to get multiple header values of a response. This is now  possible and additional helper functions are available:

- [`method: Request.allHeaders`]
- [`method: Request.headersArray`]
- [`method: Request.headerValue`]
- [`method: Response.allHeaders`]
- [`method: Response.headersArray`]
- [`method: Response.headerValue`]
- [`method: Response.headerValues`]

#### 🌈 Forced-Colors emulation

Its now possible to emulate the `forced-colors` CSS media feature by passing it in the [`method: Browser.newContext`] or calling [`method: Page.emulateMedia`].

#### New APIs

- [`method: Page.route`] accepts new `times` option to specify how many times this route should be matched.
- [`method: Page.setChecked`] and [`method: Locator.setChecked`] were introduced to set the checked state of a checkbox.
- [`method: Request.sizes`] Returns resource size information for given http request.
- [`method: Tracing.startChunk`] - Start a new trace chunk.
- [`method: Tracing.stopChunk`] - Stops a new trace chunk.

### 🎭 Playwright Test

#### 🤝 `test.parallel()` run tests in the same file in parallel

```js
test.describe.parallel('group', () => {
  test('runs in parallel 1', async ({ page }) => {
  });
  test('runs in parallel 2', async ({ page }) => {
  });
});
```

By default, tests in a single file are run in order. If you have many independent tests in a single file, you can now run them in parallel with [test.describe.parallel(title, callback)](./api/class-test#test-describe-parallel).

#### 🛠 Add `--debug` CLI flag

By using `npx playwright test --debug` it will enable the [Playwright Inspector](./debug#playwright-inspector) for you to debug your tests.

### Browser Versions

- Chromium 96.0.4641.0
- Mozilla Firefox 92.0
- WebKit 15.0

## Version 1.14

<LiteYouTube
  id="LczBDR0gOhk"
  title="Playwright 1.14"
/>

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

#### 🧩 Experimental [**React**](./other-locators.md#react-locator) and [**Vue**](./other-locators.md#vue-locator) selector engines

React and Vue selectors allow selecting elements by its component name and/or property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

```js
await page.locator('_react=SubmitButton[enabled=true]').click();
await page.locator('_vue=submit-button[enabled=true]').click();
```

Learn more in the [react selectors documentation](./other-locators.md#react-locator) and the [vue selectors documentation](./other-locators.md#vue-locator).

#### ✨ New [**`nth`**](./other-locators.md#n-th-element-locator) and [**`visible`**](./other-locators.md#css-matching-only-visible-elements) selector engines

- [`nth`](./other-locators.md#n-th-element-locator) selector engine is equivalent to the `:nth-match` pseudo class, but could be combined with other selector engines.
- [`visible`](./other-locators.md#css-matching-only-visible-elements) selector engine is equivalent to the `:visible` pseudo class, but could be combined with other selector engines.

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

Playwright Test will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"` text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is reached. You can either pass this timeout or configure it once via the [`testProject.expect`](./api/class-testproject#test-project-expect) value in test config.

By default, the timeout for assertions is not set, so it'll wait forever, until the whole test times out.

List of all new assertions:

- [`expect(locator).toBeChecked()`](./api/class-locatorassertions#locator-assertions-to-be-checked)
- [`expect(locator).toBeDisabled()`](./api/class-locatorassertions#locator-assertions-to-be-disabled)
- [`expect(locator).toBeEditable()`](./api/class-locatorassertions#locator-assertions-to-be-editable)
- [`expect(locator).toBeEmpty()`](./api/class-locatorassertions#locator-assertions-to-be-empty)
- [`expect(locator).toBeEnabled()`](./api/class-locatorassertions#locator-assertions-to-be-enabled)
- [`expect(locator).toBeFocused()`](./api/class-locatorassertions#locator-assertions-to-be-focused)
- [`expect(locator).toBeHidden()`](./api/class-locatorassertions#locator-assertions-to-be-hidden)
- [`expect(locator).toBeVisible()`](./api/class-locatorassertions#locator-assertions-to-be-visible)
- [`expect(locator).toContainText(text, options?)`](./api/class-locatorassertions#locator-assertions-to-contain-text)
- [`expect(locator).toHaveAttribute(name, value)`](./api/class-locatorassertions#locator-assertions-to-have-attribute)
- [`expect(locator).toHaveClass(expected)`](./api/class-locatorassertions#locator-assertions-to-have-class)
- [`expect(locator).toHaveCount(count)`](./api/class-locatorassertions#locator-assertions-to-have-count)
- [`expect(locator).toHaveCSS(name, value)`](./api/class-locatorassertions#locator-assertions-to-have-css)
- [`expect(locator).toHaveId(id)`](./api/class-locatorassertions#locator-assertions-to-have-id)
- [`expect(locator).toHaveJSProperty(name, value)`](./api/class-locatorassertions#locator-assertions-to-have-js-property)
- [`expect(locator).toHaveText(expected, options)`](./api/class-locatorassertions#locator-assertions-to-have-text)
- [`expect(page).toHaveTitle(title)`](./api/class-pageassertions#page-assertions-to-have-title)
- [`expect(page).toHaveURL(url)`](./api/class-pageassertions#page-assertions-to-have-url)
- [`expect(locator).toHaveValue(value)`](./api/class-locatorassertions#locator-assertions-to-have-value)

#### ⛓ Serial mode with [`describe.serial`](./api/class-test#test-describe-serial)

Declares a group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together.

```js
test.describe.serial('group', () => {
  test('runs first', async ({ page }) => { /* ... */ });
  test('runs second', async ({ page }) => { /* ... */ });
});
```

Learn more in the [documentation](./api/class-test#test-describe-serial).

#### 🐾 Steps API with [`test.step`](./api/class-test#test-step)

Split long tests into multiple steps using `test.step()` API:

```js
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

To launch a server during the tests, use the [`webServer`](./test-webserver) option in the configuration file. The server will wait for a given url to be available before running the tests, and the url will be passed over to Playwright as a [`baseURL`](./api/class-testoptions#test-options-base-url) when creating a context.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run start', // command to launch
    url: 'http://127.0.0.1:3000', // url to await for
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
```

Learn more in the [documentation](./test-webserver).

### Browser Versions

- Chromium 94.0.4595.0
- Mozilla Firefox 91.0
- WebKit 15.0


## Version 1.13


#### Playwright Test

- **⚡️ Introducing [Reporter API](https://github.com/microsoft/playwright/blob/65a9037461ffc15d70cdc2055832a0c5512b227c/packages/playwright-test/types/testReporter.d.ts)** which is already used to create an [Allure Playwright reporter](https://github.com/allure-framework/allure-js/pull/297).
- **⛺️ New [`baseURL` fixture](./test-configuration#basic-configuration)** to support relative paths in tests.


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

```js
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

```js
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

- [`method: BrowserType.launch`] now accepts the new `'channel'` option. Read more in [our documentation](./browsers).


## Version 1.9

- [Playwright Inspector](./debug.md) is a **new GUI tool** to author and debug your tests.
  - **Line-by-line debugging** of your Playwright scripts, with play, pause and step-through.
  - Author new scripts by **recording user actions**.
  - **Generate element selectors** for your script by hovering over elements.
  - Set the `PWDEBUG=1` environment variable to launch the Inspector

- **Pause script execution** with [`method: Page.pause`] in headed mode. Pausing the page launches [Playwright Inspector](./debug.md) for debugging.

- **New has-text pseudo-class** for CSS selectors. `:has-text("example")` matches any element containing `"example"` somewhere inside, possibly in a child or a descendant element. See [more examples](./other-locators.md#css-matching-by-text).

- **Page dialogs are now auto-dismissed** during execution, unless a listener for `dialog` event is configured. [Learn more](./dialogs.md) about this.

- [Playwright for Python](https://github.com/microsoft/playwright-python) is **now stable** with an idiomatic snake case API and pre-built [Docker image](./docker.md) to run tests in CI/CD.

#### Browser Versions

- Chromium 90.0.4421.0
- Mozilla Firefox 86.0b10
- WebKit 14.1

#### New APIs
- [`method: Page.pause`].


## Version 1.8

- [Selecting elements based on layout](./other-locators.md#css-matching-elements-based-on-layout) with `:left-of()`, `:right-of()`, `:above()` and `:below()`.
- Playwright now includes [command line interface](./test-cli.md), former playwright-cli.
  ```bash js
  npx playwright --help
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
- **New CSS selectors**: We heard your feedback for more flexible selectors and have revamped the selectors implementation. Playwright 1.7 introduces [new CSS extensions](./other-locators.md#css-locator) and there's more coming soon.
- **New website**: The docs website at [playwright.dev](https://playwright.dev/) has been updated and is now built with [Docusaurus](https://v2.docusaurus.io/).
- **Support for Apple Silicon**: Playwright browser binaries for WebKit and Chromium are now built for Apple Silicon.

#### New APIs

- [`method: BrowserContext.storageState`] to get current state for later reuse.
- `storageState` option in [`method: Browser.newContext`] and [`method: Browser.newPage`] to setup browser context state.

#### Browser Versions

- Chromium 89.0.4344.0
- Mozilla Firefox 84.0b9
- WebKit 14.1
