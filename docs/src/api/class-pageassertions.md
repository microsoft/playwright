# class: PageAssertions

The [PageAssertions] class provides assertion methods that can be used to make assertions about the [Page] state in the tests. A new instance of [PageAssertions] is created by calling [`method: PlaywrightAssertions.expectPage`]:

```js
import { test, expect } from '@playwright/test';

test('navigates to login', async ({ page }) => {
  // ...
  await page.click('#login');
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
    page.click("#login");
    assertThat(page).hasURL(Pattern.compile(".*/login"));
  }
}
```

```python async
import re
from playwright.async_api import Page, expect

async def test_navigates_to_login_page(page: Page) -> None:
    # ..
    await page.click("#login")
    await expect(page).to_have_url(re.compile(r".*/login"))
```

```python sync
import re
from playwright.sync_api import Page, expect

def test_navigates_to_login_page(page: Page) -> None:
    # ..
    page.click("#login")
    expect(page).to_have_url(re.compile(r".*/login"))
```

```csharp
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

public class ExampleTests : PageTest
{
    [Test]
    public async Task NavigatetoLoginPage()
    {
        // ..
        await Page.ClickAsync("#login");
        await Expect(Page.Locator("div#foobar")).ToHaveURL(new Regex(".*/login"));
    }
}
```

## property: PageAssertions.not
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
await Expect(page).Not.ToHaveURL("error");
```

## async method: PageAssertions.NotToHaveTitle
* langs: python

The opposite of [`method: PageAssertions.toHaveTitle`].


### param: PageAssertions.NotToHaveTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.NotToHaveTitle.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.NotToHaveTitle.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: PageAssertions.NotToHaveURL
* langs: python
  - alias-java: hasURL

The opposite of [`method: PageAssertions.toHaveURL`].

### param: PageAssertions.NotToHaveURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.NotToHaveURL.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.NotToHaveURL.timeout = %%-csharp-java-python-assertions-timeout-%%


## async method: PageAssertions.toHaveScreenshot#2
* langs: js

This funciton will wait until two consecutive page screenshots
yield the same result, and then compare the last screenshot with the expectation.

```js
await expect(page).toHaveScreenshot('image.png');
```

### param: PageAssertions.toHaveScreenshot#1.name
- `name` <[string]|[Array]<[string]>>

Snapshot name.

### option: PageAssertions.toHaveScreenshot#1.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.toHaveScreenshot#1.animations = %%-screenshot-option-animations-default-disabled-%%
### option: PageAssertions.toHaveScreenshot#1.caret = %%-screenshot-option-caret-%%
### option: PageAssertions.toHaveScreenshot#1.clip = %%-screenshot-option-clip-%%
### option: PageAssertions.toHaveScreenshot#1.fullPage = %%-screenshot-option-full-page-%%
### option: PageAssertions.toHaveScreenshot#1.mask = %%-screenshot-option-mask-%%
### option: PageAssertions.toHaveScreenshot#1.omitBackground = %%-screenshot-option-omit-background-%%
### option: PageAssertions.toHaveScreenshot#1.scale = %%-screenshot-option-scale-default-css-%%
### option: PageAssertions.toHaveScreenshot#1.maxDiffPixels = %%-assertions-max-diff-pixels-%%
### option: PageAssertions.toHaveScreenshot#1.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
### option: PageAssertions.toHaveScreenshot#1.threshold = %%-assertions-threshold-%%


## async method: PageAssertions.toHaveScreenshot#2
* langs: js

This funciton will wait until two consecutive page screenshots
yield the same result, and then compare the last screenshot with the expectation.

```js
await expect(page).toHaveScreenshot();
```

### option: PageAssertions.toHaveScreenshot#2.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.toHaveScreenshot#2.animations = %%-screenshot-option-animations-default-disabled-%%
### option: PageAssertions.toHaveScreenshot#2.caret = %%-screenshot-option-caret-%%
### option: PageAssertions.toHaveScreenshot#2.clip = %%-screenshot-option-clip-%%
### option: PageAssertions.toHaveScreenshot#2.fullPage = %%-screenshot-option-full-page-%%
### option: PageAssertions.toHaveScreenshot#2.mask = %%-screenshot-option-mask-%%
### option: PageAssertions.toHaveScreenshot#2.omitBackground = %%-screenshot-option-omit-background-%%
### option: PageAssertions.toHaveScreenshot#2.scale = %%-screenshot-option-scale-default-css-%%
### option: PageAssertions.toHaveScreenshot#2.maxDiffPixels = %%-assertions-max-diff-pixels-%%
### option: PageAssertions.toHaveScreenshot#2.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%
### option: PageAssertions.toHaveScreenshot#2.threshold = %%-assertions-threshold-%%


## async method: PageAssertions.toHaveTitle
* langs:
  - alias-java: hasTitle

Ensures the page has the given title.

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
await Expect(page).ToHaveTitle("Playwright");
```

### param: PageAssertions.toHaveTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.toHaveTitle.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.toHaveTitle.timeout = %%-csharp-java-python-assertions-timeout-%%

## async method: PageAssertions.toHaveURL
* langs:
  - alias-java: hasURL

Ensures the page is navigated to the given URL.

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
await Expect(page).ToHaveURL(new Regex(".*checkout"));
```

### param: PageAssertions.toHaveURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.toHaveURL.timeout = %%-js-assertions-timeout-%%
### option: PageAssertions.toHaveURL.timeout = %%-csharp-java-python-assertions-timeout-%%
