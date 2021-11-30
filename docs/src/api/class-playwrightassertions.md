# class: PlaywrightAssertions
* langs: java, python, js

The [PlaywrightAssertions] class provides convenience methods for creating assertions that will wait until the expected condition is met.

Consider the following example:

```js
import { test, expect } from '@playwright/test';

test('status becomes submitted', async ({ page }) => {
  // ...
  await page.click('#submit-button')
  await expect(page.locator('.status')).toHaveText('Submitted');
});
```

```python async
from playwright.async_api import Page, expect

async def test_status_becomes_submitted(page: Page) -> None:
    # ..
    await page.click("#submit-button")
    await expect(page.locator(".status")).to_have_text("Submitted")
```

```python sync
from playwright.sync_api import Page, expect

def test_status_becomes_submitted(page: Page) -> None:
    # ..
    page.click("#submit-button")
    expect(page.locator(".status")).to_have_text("Submitted")
```

```java
...
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class TestExample {
  ...
  @Test
  void statusBecomesSubmitted() {
    ...
    page.click("#submit-button");
    assertThat(page.locator(".status")).hasText("Submitted");
  }
}
```

Playwright will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"`
text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is
reached. You can pass this timeout as an option.

By default, the timeout for assertions is set to 5 seconds.

**langs: java**To use Playwright assertions add the following dependency into the `pom.xml` of your Maven project:

```xml java
<dependency>
  <groupId>com.microsoft.playwright</groupId>
  <artifactId>assertions</artifactId>
  <version>1.17.0</version>
</dependency>
```

## method: PlaywrightAssertions.expectLocator
* langs: java, python, js
  - alias-java: assertThat
  - alias-python: expect
  - alias-js: expect
- returns: <[LocatorAssertions]>

Creates a [LocatorAssertions] object for the given [Locator].

```java
PlaywrightAssertions.assertThat(locator).isVisible();
```

### param: PlaywrightAssertions.expectLocator.locator
- `locator` <[Locator]>

[Locator] object to use for assertions.

## method: PlaywrightAssertions.expectPage
* langs: java, python, js
  - alias-java: assertThat
  - alias-python: expect
  - alias-js: expect
- returns: <[PageAssertions]>

Creates a [PageAssertions] object for the given [Page].

```java
PlaywrightAssertions.assertThat(page).hasTitle("News");
```

### param: PlaywrightAssertions.expectPage.page
- `page` <[Page]>

[Page] object to use for assertions.
