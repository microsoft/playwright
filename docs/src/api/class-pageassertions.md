# class: PageAssertions
* langs: java

The [PageAssertions] class provides assertion methods that can be used to make assertions about [Page] state in the tests.

## method: PageAssertions.hasTitle

Ensures page has a given title.

```java
assertThat(page).hasTitle("Playwright");
```

### param: PageAssertions.hasTitle.titleOrRegExp
- `titleOrRegExp` <[string]|[RegExp]>

Expected title or RegExp.

### option: PageAssertions.hasTitle.timeout
- `timeout` <[float]>

Time to retry assertion for.

## method: PageAssertions.hasURL

Ensures the page is navigated to the given URL.

```java
assertThat(page).hasURL('.com');
```

### param: PageAssertions.hasURL.urlOrRegExp
- `urlOrRegExp` <[string]|[RegExp]>

Expected substring or RegExp.

### option: PageAssertions.hasURL.timeout
- `timeout` <[float]>

Time to retry assertion for.

## method: PageAssertions.not
- returns: <[PageAssertions]>

Makes the assertion check for the opposite condition. For example, this code tests that the page URL doesn't contain `"error"`:

```java
assertThat(page).not().hasURL('error');
```
