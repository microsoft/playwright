---
id: writing-tests
title: "Writing tests"
---

Playwright tests are simple, they

- **perform actions**, and
- **assert the state** against expectations.

There is no need to wait for anything prior to performing an action: Playwright
automatically waits for the wide range of [actionability](./actionability.md)
checks to pass prior to performing each action.

There is also no need to deal with the race conditions when performing the checks -
Playwright assertions are designed in a way that they describe the expectations
that need to be eventually met.

That's it! These design choices allow Playwright users to forget about flaky
timeouts and racy checks in their tests altogether.

**You will learn**

- [How to write the first test](/writing-tests.md#first-test)
- [How to perform actions](/writing-tests.md#actions)
- [How to use assertions](/writing-tests.md#assertions)
- [How tests run in isolation](/writing-tests.md#test-isolation)
- [How to use test hooks](/writing-tests.md#using-test-hooks)

## First test

Take a look at the following example to see how to write a test.

```js title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
```

```python title="test_example.py"
import re
from playwright.sync_api import Page, expect


def test_homepage_has_Playwright_in_title_and_get_started_link_linking_to_the_intro_page(page: Page):
    page.goto("https://playwright.dev/")

    # Expect a title "to contain" a substring.
    expect(page).to_have_title(re.compile("Playwright"))

    # create a locator
    get_started = page.get_by_role("link", name="Get started")

    # Expect an attribute "to be strictly equal" to the value.
    expect(get_started).to_have_attribute("href", "/docs/intro")

    # Click the get started link.
    get_started.click()

    # Expects page to have a heading with the name of Installation.
    expect(page.get_by_role("heading", name="Installation")).to_be_visible()
```

######
* langs: js
  
:::note
Add `// @ts-check` at the start of each test file when using JavaScript in VS Code to get automatic type checking.
:::


## Actions

### Navigation

Most of the tests will start with navigating page to the URL. After that, test
will be able to interact with the page elements.

```js
await page.goto('https://playwright.dev/');
```

```python
page.goto("https://playwright.dev/")
```

Playwright will wait for page to reach the load state prior to moving forward.
Learn more about the [`method: Page.goto`] options.

### Interactions

Performing actions starts with locating the elements. Playwright uses [Locators API](./locators.md) for that. Locators represent a way to find element(s) on the page at any moment, learn more about the [different types](./locators.md) of locators available. Playwright will wait for the element to be [actionable](./actionability.md) prior to performing the action, so there is no need to wait for it to become available.


```js
// Create a locator.
const getStarted = page.getByRole('link', { name: 'Get started' });
// Click it.
await getStarted.click();
```

In most cases, it'll be written in one line:

```js
await page.getByRole('link', { name: 'Get started' }).click();
```

```python
# Create a locator.
get_started = page.get_by_role("link", name="Get started")
# Click it.
get_started.click()
```

In most cases, it'll be written in one line:

```python
page.get_by_role("link", name="Get started").click()
```


### Basic actions

This is the list of the most popular Playwright actions. Note that there are many more, so make sure to check the [Locator API](./api/class-locator.md) section to
learn more about them.

| Action | Description |
| :- | :- |
| [`method: Locator.check`] | Check the input checkbox |
| [`method: Locator.click`] | Click the element |
| [`method: Locator.uncheck`] | Uncheck the input checkbox |
| [`method: Locator.hover`] | Hover mouse over the element |
| [`method: Locator.fill`] | Fill the form field, input text |
| [`method: Locator.focus`] | Focus the element |
| [`method: Locator.press`] | Press single key |
| [`method: Locator.setInputFiles`] | Pick files to upload |
| [`method: Locator.selectOption`] | Select option in the drop down |

## Assertions
* langs: js
  
Playwright includes [test assertions](./test-assertions.md) in the form of `expect` function. To make an assertion, call `expect(value)` and choose a matcher that reflects the expectation.

There are many generic matchers like `toEqual`, `toContain`, `toBeTruthy` that can be used to assert any conditions.

```js
expect(success).toBeTruthy();
```

Playwright also includes async matchers that will wait until the expected condition is met. Using these matchers allows making the tests non-flaky and resilient. For example, this code will wait until the page gets the title containing "Playwright":

```js
await expect(page).toHaveTitle(/Playwright/);
```

## Assertions
* langs: python

Playwright includes [assertions](./test-assertions.md) that will wait until the expected condition is met. Using these assertions allows making the tests non-flaky and resilient. For example, this code will wait until the page gets the title containing "Playwright":

```python
import re
from playwright.sync_api import expect

expect(page).to_have_title(re.compile("Playwright"))
```
######
* langs: js, python
  
Here is the list of the most popular async assertions. Note that there are [many more](./test-assertions.md) to get familiar with:

| Assertion | Description |
| :- | :- |
| [`method: LocatorAssertions.toBeChecked`] | Checkbox is checked |
| [`method: LocatorAssertions.toBeEnabled`] | Control is enabled |
| [`method: LocatorAssertions.toBeVisible`] | Element is visible |
| [`method: LocatorAssertions.toContainText`] | Element contains text |
| [`method: LocatorAssertions.toHaveAttribute`] | Element has attribute |
| [`method: LocatorAssertions.toHaveCount`] | List of elements has given length |
| [`method: LocatorAssertions.toHaveText`] | Element matches text |
| [`method: LocatorAssertions.toHaveValue`] | Input element has value |
| [`method: PageAssertions.toHaveTitle`] | Page has title |
| [`method: PageAssertions.toHaveURL`] | Page has URL |

### Test Isolation
* langs: js
  
Playwright Test is based on the concept of [test fixtures](./test-fixtures.md) such as the [built in page fixture](./test-fixtures#built-in-fixtures), which is passed into your test. Pages are isolated between tests due to the Browser Context, which is equivalent to a brand new browser profile, where every test gets a fresh environment, even when multiple tests run in a single Browser.

```js title="tests/example.spec.ts"
test('basic test', async ({ page }) => {
  // ...
});
```

### Test Isolation
* langs: python
  
The Playwright Pytest plugin is based on the concept of test fixtures such as the [built in page fixture](./test-runners.md), which is passed into your test. Pages are isolated between tests due to the Browser Context, which is equivalent to a brand new browser profile, where every test gets a fresh environment, even when multiple tests run in a single Browser.

```python
from playwright.sync_api import Page

def test_basic_test(page: Page):
  pass
  # ...
```

### Using Test Hooks
* langs: js

You can use various [test hooks](./api/class-test.md) such as `test.describe` to declare a group of tests and `test.beforeEach` and `test.afterEach` which are executed before/after each test. Other hooks include the `test.beforeAll` and `test.afterAll` which are executed once per worker before/after all tests.

```js title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('https://playwright.dev/');
  });

  test('main navigation', async ({ page }) => {
    // Assertions use the expect API.
    await expect(page).toHaveURL('https://playwright.dev/');
  });
});
```

### Using Test Hooks
* langs: python

You can use various [fixtures](https://docs.pytest.org/en/6.2.x/fixture.html#autouse-fixtures-fixtures-you-don-t-have-to-request) to execute code before or after your tests and to share objects between them. A `function` scoped fixture e.g. with autouse behaves like a beforeEach/afterEach. And a `module` scoped fixture with autouse behaves like a beforeAll/afterAll which runs before all and after all the tests.

```python
import pytest
from playwright.sync_api import Page


@pytest.fixture(scope="function", autouse=True)
def before_each_after_each(page: Page):
    print("beforeEach")
    # Go to the starting url before each test.
    page.goto("https://playwright.dev/")
    yield
    print("afterEach")

def test_main_navigation(page: Page):
    # Assertions use the expect API.
    expect(page).to_have_url("https://playwright.dev/")
```

## What's Next

- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen-intro.md)
- [See a trace of your tests](./trace-viewer-intro.md)
