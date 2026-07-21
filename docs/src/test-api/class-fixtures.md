# class: Fixtures
* since: v1.10
* langs: js

Playwright Test is based on the concept of the [test fixtures](../test-fixtures.md). Test fixtures are used to establish environment for each test, giving the test everything it needs and nothing else.

Playwright Test looks at each test declaration, analyses the set of fixtures the test needs and prepares those fixtures specifically for the test. Values prepared by the fixtures are merged into a single object that is available to the `test`, hooks, annotations and other fixtures as a first parameter.

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  // ...
});
```

Given the test above, Playwright Test will set up the `page` fixture before running the test, and tear it down after the test has finished. `page` fixture provides a [Page] object that is available to the test.

Playwright Test comes with builtin fixtures listed below, and you can add your own fixtures as well. Playwright Test also [provides options][TestOptions] to  configure [`property: Fixtures.browser`], [`property: Fixtures.context`] and [`property: Fixtures.page`].

## property: Fixtures.browser
* since: v1.10
- type: <[Browser]>

[Browser] instance is shared between all tests in the [same worker](../test-parallel.md) - this makes testing efficient. However, each test runs in an isolated [BrowserContext]  and gets a fresh environment.

Learn how to [configure browser](../test-configuration.md) and see [available options][TestOptions].

**Usage**

```js
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // ...
});
```

## property: Fixtures.browserName
* since: v1.10
- type: <[BrowserName]<"chromium"|"firefox"|"webkit">>

Name of the browser that runs tests. Defaults to `'chromium'`. Useful to [annotate tests](../test-annotations.md) based on the browser.

**Usage**

```js
test('skip this test in Firefox', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Still working on it');
  // ...
});
```

## property: Fixtures.context
* since: v1.10
- type: <[BrowserContext]>

Isolated [BrowserContext] instance, created for each test. Since contexts are isolated between each other, every test gets a fresh environment, even when multiple tests run in a single [Browser] for maximum efficiency.

Learn how to [configure context](../test-configuration.md) and see [available options][TestOptions].

Default [`property: Fixtures.page`] belongs to this context.

**Usage**

```js
test('example test', async ({ page, context }) => {
  await context.route('*external.com/*', route => route.abort());
  // ...
});
```

## method: Fixtures.mount
* since: v1.62
- returns: <[Locator]>

Mounts a component story and returns a [Locator] pointing to the root element the story was rendered into. Scope your queries from the returned locator: `component.getByRole('button')`, not `page.getByRole('button')`.

A **story** is a small wrapper component that embeds the component under test in one specific scenario: hard-coded props, mock data, providers, recorded callbacks. Stories are rendered by a **gallery** page that you implement and serve at [`property: TestOptions.baseURL`]. The gallery exposes `window.mount(params)` and `window.unmount()` functions that render a story into its root element. Each call to [`method: Fixtures.mount`] navigates to [`property: TestOptions.baseURL`] and calls `window.mount()` with the story id and props, so tests are fully isolated from each other.

**Usage**

```js
test('click should expand', async ({ mount }) => {
  const component = await mount('components/Expandable/Stateful');
  await component.getByRole('button').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
});
```

Pass the story type as a template argument to type-check the props:

```js
import type { WithTitle } from './Button.story';

test('renders the title', async ({ mount }) => {
  const component = await mount<typeof WithTitle>('Button/WithTitle', { title: 'Hello' });
  await expect(component).toContainText('Hello');
});
```

The returned locator is augmented with two methods:
* `update(props)` - re-renders the same story with new props without remounting, preserving component state;
* `unmount()` - unmounts the story.

### param: Fixtures.mount.storyId
* since: v1.62
- `storyId` <[string]>

Identifier of the story to mount, as resolved by the gallery page. Conventionally, the story file path plus the exported story name, for example `'components/Button/Primary'`.

### param: Fixtures.mount.props
* since: v1.62
- `props` ?<[Object]>

Optional plain, serializable props passed to the story.

## property: Fixtures.page
* since: v1.10
- type: <[Page]>

Isolated [Page] instance, created for each test. Pages are isolated between tests due to [`property: Fixtures.context`] isolation.

This is the most common fixture used in a test.

**Usage**

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
  // ...
});
```

## property: Fixtures.request
* since: v1.10
- type: <[APIRequestContext]>

Isolated [APIRequestContext] instance for each test.

**Usage**

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ request }) => {
  await request.post('/signin', {
    data: {
      username: 'user',
      password: 'password'
    }
  });
  // ...
});
```
