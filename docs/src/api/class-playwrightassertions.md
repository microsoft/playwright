# class: PlaywrightAssertions
* langs: java, python

The [PlaywrightAssertions] class provides convenience methods for creating assertions that will wait until the expected condition is met.

Consider the following example:

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

To use Playwright assertions add the following dependency into the `pom.xml` of your Maven project:

```xml
<dependency>
  <groupId>com.microsoft.playwright</groupId>
  <artifactId>assertions</artifactId>
  <version>1.17.0</version>
</dependency>
```

## method: PlaywrightAssertions.assertThatLocator
* langs: java, python
  - alias-java: assertThat
  - alias-python: expect
- returns: <[LocatorAssertions]>

Creates a [LocatorAssertions] object for the given [Locator].

```java
PlaywrightAssertions.assertThat(locator).isVisible();
```

### param: PlaywrightAssertions.assertThatLocator.locator
- `locator` <[Locator]>

[Locator] object to use for assertions.

## method: PlaywrightAssertions.assertThatPage
* langs: java, python
  - alias-java: assertThat
  - alias-python: expect
- returns: <[PageAssertions]>

Creates a [PageAssertions] object for the given [Page].

```java
PlaywrightAssertions.assertThat(page).hasTitle("News");
```

### param: PlaywrightAssertions.assertThatPage.page
- `page` <[Page]>

[Page] object to use for assertions.
