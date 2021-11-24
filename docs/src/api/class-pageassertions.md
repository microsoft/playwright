# class: PageAssertions
* langs: java, python, js

The [PageAssertions] class provides assertion methods that can be used to make assertions about the [Page] state in the tests. A new instance of [LocatorAssertions] is created by calling [`method: PlaywrightAssertions.expectPage`]:

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


## method: PageAssertions.not
* langs: java, js
- returns: <[PageAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the page URL doesn't contain `"error"`:

```java
assertThat(page).not().hasURL("error");
```

## method: PageAssertions.NotToHaveTitle
* langs: python

The opposite of [`method: PageAssertions.toHaveTitle`].


### param: PageAssertions.NotToHaveTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.NotToHaveTitle.timeout = %%-assertions-timeout-%%

## method: PageAssertions.NotToHaveURL
* langs: python
  - alias-java: hasURL

The opposite of [`method: PageAssertions.toHaveURL`].

### param: PageAssertions.NotToHaveURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.NotToHaveURL.timeout = %%-assertions-timeout-%%

## method: PageAssertions.toHaveTitle
* langs:
  - alias-java: hasTitle

Ensures the page has the given title.

```js
await expect(page).toHaveTitle(/.*checkout/);
```

```java
assertThat(page).hasTitle("Playwright");
```

### param: PageAssertions.toHaveTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.toHaveTitle.timeout = %%-assertions-timeout-%%

## method: PageAssertions.toHaveURL
* langs:
  - alias-java: hasURL

Ensures the page is navigated to the given URL.

```js
await expect(page).toHaveURL(/.*checkout/);
```

```java
assertThat(page).hasURL(".com");
```

### param: PageAssertions.toHaveURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.toHaveURL.timeout = %%-assertions-timeout-%%