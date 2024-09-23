---
id: accessibility-testing
title: "Accessibility testing"
---

## Introduction

Playwright can be used to test your application for many types of accessibility issues.

A few examples of problems this can catch include:
- Text that would be hard to read for users with vision impairments due to poor color contrast with the background behind it
- UI controls and form elements without labels that a screen reader could identify
- Interactive elements with duplicate IDs which can confuse assistive technologies

The following examples rely on the [`com.deque.html.axe-core/playwright`](https://mvnrepository.com/artifact/com.deque.html.axe-core/playwright) Maven package which adds support for running the [axe accessibility testing engine](https://www.deque.com/axe/) as part of your Playwright tests.

## Disclaimer

Automated accessibility tests can detect some common accessibility problems such as missing or invalid properties. But many accessibility problems can only be discovered through manual testing. We recommend using a combination of automated testing, manual accessibility assessments, and inclusive user testing.

For manual assessments, we recommend [Accessibility Insights for Web](https://accessibilityinsights.io/docs/web/overview/?referrer=playwright-accessibility-testing-java), a free and open source dev tool that walks you through assessing a website for [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/?currentsidebar=%23col_customize&levels=aaa) coverage.

## Example accessibility tests

Accessibility tests work just like any other Playwright test. You can either create separate test cases for them, or integrate accessibility scans and assertions into your existing test cases.

The following examples demonstrate a few basic accessibility testing scenarios.

### Example 1: Scanning an entire page

This example demonstrates how to test an entire page for automatically detectable accessibility violations. The test:
1. Imports the [`com.deque.html.axe-core/playwright`](https://mvnrepository.com/artifact/com.deque.html.axe-core/playwright) package
1. Uses normal JUnit 5 `@Test` syntax to define a test case
1. Uses normal Playwright syntax to open a browser and navigate to the page under test
1. Invokes `AxeBuilder.analyze()` to run the accessibility scan against the page
1. Uses normal JUnit 5 test assertions to verify that there are no violations in the returned scan results

```java
import com.deque.html.axecore.playwright.*; // 1
import com.deque.html.axecore.utilities.axeresults.*;

import org.junit.jupiter.api.*;
import com.microsoft.playwright.*;

import static org.junit.jupiter.api.Assertions.*;

public class HomepageTests {
  @Test // 2
  void shouldNotHaveAutomaticallyDetectableAccessibilityIssues() throws Exception {
    Playwright playwright = Playwright.create();
    Browser browser = playwright.chromium().launch();
    BrowserContext context = browser.newContext();
    Page page = context.newPage();

    page.navigate("https://your-site.com/"); // 3

    AxeResults accessibilityScanResults = new AxeBuilder(page).analyze(); // 4

    assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations()); // 5
  }
}
```

### Example 2: Configuring axe to scan a specific part of a page

`com.deque.html.axe-core/playwright` supports many configuration options for axe. You can specify these options by using a Builder pattern with the `AxeBuilder` class.

For example, you can use [`AxeBuilder.include()`](https://github.com/dequelabs/axe-core-maven-html/blob/develop/playwright/README.md#axebuilderincludeliststring-selector) to constrain an accessibility scan to only run against one specific part of a page.

`AxeBuilder.analyze()` will scan the page *in its current state* when you call it. To scan parts of a page that are revealed based on UI interactions, use [Locators](./locators.md) to interact with the page before invoking `analyze()`:

```java
@Test
void navigationMenuFlyoutShouldNotHaveAutomaticallyDetectableAccessibilityViolations() throws Exception {
  page.navigate("https://your-site.com/");

  page.locator("button[aria-label=\"Navigation Menu\"]").click();

  // It is important to waitFor() the page to be in the desired
  // state *before* running analyze(). Otherwise, axe might not
  // find all the elements your test expects it to scan.
  page.locator("#navigation-menu-flyout").waitFor();

  AxeResults accessibilityScanResults = new AxeBuilder(page)
    .include(Arrays.asList("#navigation-menu-flyout"))
    .analyze();

  assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations());
}
```

### Example 3: Scanning for WCAG violations

By default, axe checks against a wide variety of accessibility rules. Some of these rules correspond to specific success criteria from the [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/TR/WCAG21/), and others are "best practice" rules that are not specifically required by any WCAG criterion.

You can constrain an accessibility scan to only run those rules which are "tagged" as corresponding to specific WCAG success criteria by using [`AxeBuilder.withTags()`](https://github.com/dequelabs/axe-core-maven-html/blob/develop/playwright/README.md#axebuilderwithtagsliststring-rules). For example, [Accessibility Insights for Web's Automated Checks](https://accessibilityinsights.io/docs/web/getstarted/fastpass/?referrer=playwright-accessibility-testing-java) only include axe rules that test for violations of WCAG A and AA success criteria; to match that behavior, you would use the tags `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa`.

Note that [automated testing cannot detect all types of WCAG violations](#disclaimer).

```java
AxeResults accessibilityScanResults = new AxeBuilder(page)
  .withTags(Arrays.asList("wcag2a", "wcag2aa", "wcag21a", "wcag21aa"))
  .analyze();

assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations());
```

You can find a complete listing of the rule tags axe-core supports in [the "Axe-core Tags" section of the axe API documentation](https://www.deque.com/axe/core-documentation/api-documentation/#axe-core-tags).

## Handling known issues

A common question when adding accessibility tests to an application is "how do I suppress known violations?" The following examples demonstrate a few techniques you can use.

### Excluding individual elements from a scan

If your application contains a few specific elements with known issues, you can use [`AxeBuilder.exclude()`](https://github.com/dequelabs/axe-core-maven-html/blob/develop/playwright/README.md#axebuilderexcludeliststring-selector) to exclude them from being scanned until you're able to fix the issues.

This is usually the simplest option, but it has some important downsides:
* `exclude()` will exclude the specified elements *and all of their descendants*. Avoid using it with components that contain many children.
* `exclude()` will prevent *all* rules from running against the specified elements, not just the rules corresponding to known issues.

Here is an example of excluding one element from being scanned in one specific test:

```java
AxeResults accessibilityScanResults = new AxeBuilder(page)
  .exclude(Arrays.asList("#element-with-known-issue"))
  .analyze();

assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations());
```

If the element in question is used repeatedly in many pages, consider [using a test fixture](#using-a-test-fixture-for-common-axe-configuration) to reuse the same `AxeBuilder` configuration across multiple tests.

### Disabling individual scan rules

If your application contains many different preexisting violations of a specific rule, you can use [`AxeBuilder.disableRules()`](https://github.com/dequelabs/axe-core-maven-html/blob/develop/playwright/README.md#axebuilderdisablerulesliststring-rules) to temporarily disable individual rules until you're able to fix the issues.

You can find the rule IDs to pass to `disableRules()` in the `id` property of the violations you want to suppress. A [complete list of axe's rules](https://github.com/dequelabs/axe-core/blob/master/doc/rule-descriptions.md) can be found in `axe-core`'s documentation.

```java
AxeResults accessibilityScanResults = new AxeBuilder(page)
  .disableRules(Arrays.asList("duplicate-id"))
  .analyze();

assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations());
```

### Using violation fingerprints to specific known issues

If you would like to allow for a more granular set of known issues, you can use the following pattern:

1. Perform an accessibility scan which is expected to find some known violations
1. Convert the violations into "violation fingerprint" objects
1. Assert that the set of fingerprints is equivalent to the expected ones

This approach avoids the downsides of using `AxeBuilder.exclude()` at the cost of slightly more complexity and fragility.

Here is an example of using fingerprints based on only rule IDs and "target" selectors pointing to each violation:

```java
@Test
shouldOnlyHaveAccessibilityViolationsMatchingKnownFingerprints() throws Exception {
  page.navigate("https://your-site.com/");

  AxeResults accessibilityScanResults = new AxeBuilder(page).analyze();

  List<ViolationFingerprint> violationFingerprints = fingerprintsFromScanResults(accessibilityScanResults);

  assertEquals(Arrays.asList(
    new ViolationFingerprint("aria-roles", "[span[role=\"invalid\"]]"),
    new ViolationFingerprint("color-contrast", "[li:nth-child(2) > span]"),
    new ViolationFingerprint("label", "[input]")
  ), violationFingerprints);
}

// You can make your "fingerprint" as specific as you like. This one considers a violation to be
// "the same" if it corresponds the same Axe rule on the same element.
//
// Using a record type makes it easy to compare fingerprints with assertEquals
public record ViolationFingerprint(String ruleId, String target) { }

public List<ViolationFingerprint> fingerprintsFromScanResults(AxeResults results) {
  return results.getViolations().stream()
    // Each violation refers to one rule and multiple "nodes" which violate it
    .flatMap(violation -> violation.getNodes().stream()
      .map(node -> new ViolationFingerprint(
        violation.getId(),
        // Each node contains a "target", which is a CSS selector that uniquely identifies it
        // If the page involves iframes or shadow DOMs, it may be a chain of CSS selectors
        node.getTarget().toString()
      )))
    .collect(Collectors.toList());
}
```

## Using a test fixture for common axe configuration

A [`TestFixtures` class](./test-runners#running-tests-in-parallel) is a good way to share common `AxeBuilder` configuration across many tests. Some scenarios where this might be useful include:
* Using a common set of rules among all of your tests
* Suppressing a known violation in a common element which appears in many different pages
* Attaching standalone accessibility reports consistently for many scans

The following example demonstrates extending the `TestFixtures` class from the [Test Runners example](./test-runners#running-tests-in-parallel) with a new fixture that contains some common `AxeBuilder` configuration.

### Creating a fixture

This example fixture creates an `AxeBuilder` object which is pre-configured with shared `withTags()` and `exclude()` configuration.

```java
class AxeTestFixtures extends TestFixtures {
  AxeBuilder makeAxeBuilder() {
    return new AxeBuilder(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('#commonly-reused-element-with-known-issue');
  }
}
```

### Using a fixture

To use the fixture, replace the earlier examples' `new AxeBuilder(page)` with the newly defined `makeAxeBuilder` fixture:

```java
public class HomepageTests extends AxeTestFixtures {
  @Test
  void exampleUsingCustomFixture() throws Exception {
    page.navigate("https://your-site.com/");

    AxeResults accessibilityScanResults = makeAxeBuilder()
      // Automatically uses the shared AxeBuilder configuration,
      // but supports additional test-specific configuration too
      .include('#specific-element-under-test')
      .analyze();

    assertEquals(Collections.emptyList(), accessibilityScanResults.getViolations());
  }
}
```

See experimental [JUnit integration](./junit.md) to automatically initialize Playwright objects and more.
