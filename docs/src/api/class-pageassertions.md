# class: PageAssertions
* langs: java

The [PageAssertions] class provides assertion methods that can be used to make assertions about the [Page] state in the tests. A new instance of [LocatorAssertions] is created by calling [`method: PlaywrightAssertions.assertThatPage`]:

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

## method: PageAssertions.hasTitle

Ensures the page has the given title.

```java
assertThat(page).hasTitle("Playwright");
```

### param: PageAssertions.hasTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.hasTitle.timeout = %%-assertions-timeout-%%

## method: PageAssertions.hasURL

Ensures the page is navigated to the given URL.

```java
assertThat(page).hasURL(".com");
```

### param: PageAssertions.hasURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.hasURL.timeout = %%-assertions-timeout-%%

## method: PageAssertions.not
- returns: <[PageAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the page URL doesn't contain `"error"`:

```java
assertThat(page).not().hasURL("error");
```
