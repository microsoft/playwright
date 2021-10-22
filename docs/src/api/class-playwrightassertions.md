# class: PlaywrightAssertions
* langs: java

The [PlaywrightAssertions] class provides convenience methods for creating assertions that will wait until the expected condition is met.

Consider the following example:

```java
assertThat(page.locator('.status')).hasText('Submitted');
```

Playwright will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"`
text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is
reached. You can pass this timeout as an option.

By default, the timeout for assertions is set to 5 seconds.

## method: PlaywrightAssertions.assertThatPage
* langs: java
- returns: <[PageAssertions]>

Creates a [PageAssertions] object for the given [Page].

```java
PlaywrightAssertions.assertThat(page).hasTitle("News");
```

### param: PlaywrightAssertions.assertThatPage.page
- `page` <[Page]>

[Page] object to use for assertions.

## method: PlaywrightAssertions.assertThatLocator
* langs: java
- returns: <[LocatorAssertions]>

Creates a [LocatorAssertions] object for the given [Locator].

```java
PlaywrightAssertions.assertThat(locator).isVisible();
```

### param: PlaywrightAssertions.assertThatLocator.locator
- `locator` <[Locator]>

[Locator] object to use for assertions.

