---
id: writing-tests
title: "Writing Tests"
---

Playwright assertions are created specifically for the dynamic web. Checks are automatically retried until the necessary conditions are met. Playwright comes with [auto-wait](./actionability.md) built in meaning it waits for elements to be actionable prior to performing actions. Playwright provides an [expect](./test-assertions.md) function to write assertions.

Take a look at the example test below to see how to write a test using [locators](/locators.md) and web first assertions.

```python
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

    # Expects the URL to contain intro.
    expect(page).to_have_url(re.compile(".*intro"))
```


### Assertions

Playwright provides the [`expect`](./test-assertions.md) function which will wait until the expected condition is met.

```python
import re
from playwright.sync_api import expect

expect(page).to_have_title(re.compile("Playwright"))
```


### Locators

[Locators](./locators.md) are the central piece of Playwright's auto-waiting and retry-ability. Locators represent a way to find element(s) on the page at any moment and are used to perform actions on elements such as `.click` `.fill` etc.

```python
from playwright.sync_api import expect

get_started = page.get_by_role("link", name="Get started")

expect(get_started).to_have_attribute("href", "/docs/installation")
get_started.click()
```

### Test Isolation

The Playwright Pytest plugin is based on the concept of test fixtures such as the [built in page fixture](./test-runners.md), which is passed into your test. Pages are isolated between tests due to the Browser Context, which is equivalent to a brand new browser profile, where every test gets a fresh environment, even when multiple tests run in a single Browser.

```python
from playwright.sync_api import Page

def test_basic_test(page: Page):
  # ...
```

### Using Test Hooks

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
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)