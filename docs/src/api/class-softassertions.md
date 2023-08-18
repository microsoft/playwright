# class: SoftAssertions
* since: v1.38
* langs: java

The [SoftAssertions] class provides assertion methods that can be used to make multiple assertions without failing the test immediately.

```java
...
import com.microsoft.playwright.assertions.SoftAssertions;

public class TestPage {
  ...
  @Test
  void hasUrlTextPass() {
    SoftAssertions softly = SoftAssertions.create();
    page.getByText("Sign in").click();
    softly.assertThat(page).hasURL(Pattern.compile(".*/login"));
    softly.assertAll();
  }
}
```

## method: SoftAssertions.create
* since: v1.38
* langs: java
- returns: <[SoftAssertions]>

Creates a [SoftAssertions] object.

**Usage**

```java
SoftAssertions softly = SoftAssertions.create();
```

## method: SoftAssertions.expectLocator
* since: v1.38
* langs:
  - alias-java: assertThat
- returns: <[LocatorAssertions]>

Creates a [LocatorAssertions] object for the given [Locator].

**Usage**

```java
SoftAssertions softly = SoftAssertions.create();
...
softly.assertThat(locator).isVisible();
```

### param: SoftAssertions.expectLocator.locator
* since: v1.38
- `locator` <[Locator]>

[Locator] object to use for assertions.

## method: SoftAssertions.expectPage
* since: v1.38
* langs:
  - alias-java: assertThat
- returns: <[PageAssertions]>

Creates a [PageAssertions] object for the given [Page].

**Usage**

```java
SoftAssertions softly = SoftAssertions.create();
...
softly.assertThat(page).hasTitle("News");
```

### param: SoftAssertions.expectPage.page
* since: v1.38
- `page` <[Page]>

[Page] object to use for assertions.

## method: SoftAssertions.expectAPIResponse
* since: v1.38
* langs:
  - alias-java: assertThat

- returns: <[APIResponseAssertions]>

Creates a [APIResponseAssertions] object for the given [APIResponse].

**Usage**

```java
SoftAssertions softly = SoftAssertions.create();
...
softly.assertThat(response).isOK();
```

### param: SoftAssertions.expectAPIResponse.response
* since: v1.38
- `response` <[APIResponse]>

[APIResponse] object to use for assertions.

## method: SoftAssertions.assertAll
* since: v1.38
* langs: java

Runs all the assertions have been executed for this [SoftAssertions] object.  If any assertions fail, this method throws an AssertionFailedError with the details of all the failed assertions.

**Usage**

```java
SoftAssertions softly = SoftAssertions.create();
...
softly.assertAll();
```