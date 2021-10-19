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

## method: PlaywrightAssertions.assertThat
* langs: java
- returns: <[PageAssertions]>

Creates [PageAssertions] object for given [Page].

```java
PlaywrightAssertions.assertThat(page).hasTitle("News");
```

### param: PlaywrightAssertions.assertThat.page
- `page` <[Page]>

[Page] object to use for assertions.

