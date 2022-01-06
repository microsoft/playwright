# class: APIResponseAssertions
* langs: js, java

The [APIResponseAssertions] class provides assertion methods that can be used to make assertions about the [APIResponse] in the tests. A new instance of [APIResponseAssertions] is created by calling [`method: PlaywrightAssertions.expectAPIResponse`]:

```js
import { test, expect } from '@playwright/test';

test('navigates to login', async ({ page }) => {
  // ...
  const response = await page.request.get('https://playwright.dev');
  await expect(response).toBeOK();
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
    APIResponse response = page.request().get('https://playwright.dev');
    assertThat(response).isOK();
  }
}
```

```python async
import re
from playwright.async_api import Page, expect

async def test_navigates_to_login_page(page: Page) -> None:
    # ..
    response = await page.request.get('https://playwright.dev')
    await expect(response).to_be_ok()
```

```python sync
import re
from playwright.sync_api import Page, expect

def test_navigates_to_login_page(page: Page) -> None:
    # ..
    response = page.request.get('https://playwright.dev')
    expect(response).to_be_ok()
```


## method: APIResponseAssertions.not
* langs: java, js
- returns: <[APIResponseAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the response status is not successfull:

```js
await expect(response).not.toBeOK();
```

```java
assertThat(response).not().isOK();
```

## async method: APIResponseAssertions.toBeOK
* langs:
  - alias-java: isOK

Ensures the response status code is within [200..299] range.

```js
await expect(response).toBeOK();
```

```java
assertThat(response).isOK();
```

```python async
import re
from playwright.async_api import expect

# ...
await expect(response).to_be_ok()
```

```python sync
import re
from playwright.sync_api import expect

# ...
expect(response).to_be_ok()
```
