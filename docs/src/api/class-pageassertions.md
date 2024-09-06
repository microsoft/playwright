# class: PageAssertions
* since: v1.17

The [PageAssertions] class provides assertion methods that can be used to make assertions about the [Page] state in the tests.

```js
import { test, expect } from '@playwright/test';

test('navigates to login', async ({ page }) => {
  // ...
  await page.getByText('Sign in').click();
  await expect(page).toHaveURL(/.*\/login/);
});
```

```java
...
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class TestPage {
  ...
  @Test
  void navigatesToLoginPage() {
    ...
    page.getByText("Sign in").click();
    assertThat(page).hasURL(Pattern.compile(".*/login"));
  }
}
```

```python async
import re
from playwright.async_api import Page, expect

async def test_navigates_to_login_page(page: Page) -> None:
    # ..
    await page.get_by_text("Sign in").click()
    await expect(page).to_have_url(re.compile(r".*/login"))
```

```python sync
import re
from playwright.sync_api import Page, expect

def test_navigates_to_login_page(page: Page) -> None:
    # ..
    page.get_by_text("Sign in").click()
    expect(page).to_have_url(re.compile(r".*/login"))
```

```csharp
using System.Text.RegularExpressions;
using Microsoft.Playwright;
using Microsoft.Playwright.MSTest;

namespace PlaywrightTests;

[TestClass]
public class ExampleTests : PageTest
{
    [TestMethod]
    public async Task NavigateToLoginPage()
    {
        await Page.GetByRole(AriaRole.Button, new() { Name = "Sign In" }).ClickAsync();
        await Expect(Page).ToHaveURLAsync(new Regex(".*/login"));
    }
}
```

## property: PageAssertions.not
* since: v1.20
* langs: java, js, csharp
- returns: <[PageAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the page URL doesn't contain `"error"`:

```js
await expect(page).not.toHaveURL('error');
```

```java
assertThat(page).not().hasURL("error");
```

```csharp
await Expect(Page).Not.ToHaveURLAsync("error");
```

## async method: PageAssertions.NotToHaveTitle
* since: v1.20
* langs: python

The opposite of [`method: PageAssertions.toHaveTitle`].

### param: PageAssertions.NotToHaveTitle.titleOrRegExp
* since: v1.18
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.NotToHaveTitle.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: PageAssertions.NotToHaveURL
* since: v1.20
* langs: python
  - alias-java: hasURL

The opposite of [`method: PageAssertions.toHaveURL`].

### param: PageAssertions.NotToHaveURL.urlOrRegExp
* since: v1.18
- `urlOrRegExp` <[string]|[RegExp]>

Expected URL string or RegExp.

### option: PageAssertions.NotToHaveURL.ignoreCase
* since: v1.44
- `ignoreCase` <[boolean]>

Whether to perform case-insensitive match. [`option: ignoreCase`] option takes precedence over the corresponding regular expression flag if specified.

### option: PageAssertions.NotToHaveURL.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: PageAssertions.toHaveScreenshot#1
* since: v1.23
* langs: js

This function will wait until two consecutive page screenshots
yield the same result, and then compare the last screenshot with the expectation.

**Usage**

```js
await expect(page).toHaveScreenshot('image.png');
```

Note that screenshot assertions only work with Playwright test runner.

### param: PageAssertions.toHaveScreenshot#1.name
* since: v1.23
- `name` <[string]|[Array]<[string]>>

Snapshot name.

### option: PageAssertions.toHaveScreenshot#1.timeout = %%-js-assertions-timeout-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.animations = %%-screenshot-option-animations-default-disabled-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.caret = %%-screenshot-option-caret-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.clip = %%-screenshot-option-clip-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.fullPage = %%-screenshot-option-full-page-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.mask = %%-screenshot-option-mask-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.35

### option: PageAssertions.toHaveScreenshot#1.stylePath = %%-screenshot-option-style-path-%%
* since: v1.41

### option: PageAssertions.toHaveScreenshot#1.omitBackground = %%-screenshot-option-omit-background-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.scale = %%-screenshot-option-scale-default-css-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#1.threshold = %%-assertions-threshold-%%
* since: v1.23

## async method: PageAssertions.toHaveScreenshot#2
* since: v1.23
* langs: js

This function will wait until two consecutive page screenshots
yield the same result, and then compare the last screenshot with the expectation.

**Usage**

```js
await expect(page).toHaveScreenshot();
```

Note that screenshot assertions only work with Playwright test runner.

### option: PageAssertions.toHaveScreenshot#2.timeout = %%-js-assertions-timeout-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.animations = %%-screenshot-option-animations-default-disabled-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.caret = %%-screenshot-option-caret-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.clip = %%-screenshot-option-clip-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.fullPage = %%-screenshot-option-full-page-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.mask = %%-screenshot-option-mask-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.maskColor = %%-screenshot-option-mask-color-%%
* since: v1.35

### option: PageAssertions.toHaveScreenshot#2.stylePath = %%-screenshot-option-style-path-%%
* since: v1.41

### option: PageAssertions.toHaveScreenshot#2.omitBackground = %%-screenshot-option-omit-background-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.scale = %%-screenshot-option-scale-default-css-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.maxDiffPixels = %%-assertions-max-diff-pixels-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
* since: v1.23

### option: PageAssertions.toHaveScreenshot#2.threshold = %%-assertions-threshold-%%
* since: v1.23

## async method: PageAssertions.toHaveTitle
* since: v1.20
* langs:
  - alias-java: hasTitle

Ensures the page has the given title.

**Usage**

```js
await expect(page).toHaveTitle(/.*checkout/);
```

```java
assertThat(page).hasTitle("Playwright");
```

```python async
import re
from playwright.async_api import expect

# ...
await expect(page).to_have_title(re.compile(r".*checkout"))
```

```python sync
import re
from playwright.sync_api import expect

# ...
expect(page).to_have_title(re.compile(r".*checkout"))
```

```csharp
await Expect(Page).ToHaveTitleAsync("Playwright");
```

### param: PageAssertions.toHaveTitle.titleOrRegExp
* since: v1.18
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.toHaveTitle.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: PageAssertions.toHaveTitle.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18

## async method: PageAssertions.toHaveURL
* since: v1.20
* langs:
  - alias-java: hasURL

Ensures the page is navigated to the given URL.

**Usage**

```js
await expect(page).toHaveURL(/.*checkout/);
```

```java
assertThat(page).hasURL(".com");
```

```python async
import re
from playwright.async_api import expect

# ...
await expect(page).to_have_url(re.compile(".*checkout"))
```

```python sync
import re
from playwright.sync_api import expect

# ...
expect(page).to_have_url(re.compile(".*checkout"))
```

```csharp
await Expect(Page).ToHaveURLAsync(new Regex(".*checkout"));
```

### param: PageAssertions.toHaveURL.urlOrRegExp
* since: v1.18
- `urlOrRegExp` <[string]|[RegExp]>

Expected URL string or RegExp.

### option: PageAssertions.toHaveURL.ignoreCase
* since: v1.44
- `ignoreCase` <[boolean]>

Whether to perform case-insensitive match. [`option: ignoreCase`] option takes precedence over the corresponding regular expression flag if specified.

### option: PageAssertions.toHaveURL.timeout = %%-js-assertions-timeout-%%
* since: v1.18

### option: PageAssertions.toHaveURL.timeout = %%-csharp-java-python-assertions-timeout-%%
* since: v1.18
