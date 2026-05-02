---
id: best-practices
title: "Best Practices"
---

## Introduction

This guide should help you to make sure you are following our best practices and writing tests that are more resilient.

## Testing philosophy

### Test user-visible behavior

Automated tests should verify that the application code works for the end users, and avoid relying on implementation details such as things which users will not typically use, see, or even know about such as the name of a function, whether something is an array, or the CSS class of some element. The end user will see or interact with what is rendered on the page, so your test should typically only see/interact with the same rendered output.

### Make tests as isolated as possible

Each test should be completely isolated from another test and should run independently with its own local storage, session storage, data, cookies etc. [Test isolation](./browser-contexts.md) improves reproducibility, makes debugging easier and prevents cascading test failures.

In order to avoid repetition for a particular part of your test you can use [before and after hooks](./junit.md). Within your test file add a before hook to run a part of your test before each test such as going to a particular URL or logging in to a part of your app. This keeps your tests isolated as no test relies on another. However it is also ok to have a little duplication when tests are simple enough especially if it keeps your tests clearer and easier to read and maintain.

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class TestExample {
  Playwright playwright;
  Browser browser;
  Page page;

  @BeforeEach
  void setUp() {
    // Runs before each test and signs in each page.
    playwright = Playwright.create();
    browser = playwright.chromium().launch();
    page = browser.newPage();
    page.navigate("https://github.com/login");
    page.getByLabel("Username or email address").fill("username");
    page.getByLabel("Password").fill("password");
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in")).click();
  }

  @AfterEach
  void tearDown() {
    playwright.close();
  }

  @Test
  void first() {
    // page is signed in.
  }

  @Test
  void second() {
    // page is signed in.
  }
}
```

You can also reuse the signed-in state in the tests with [setup via `@BeforeAll`](./auth.md#basic-shared-account-in-all-tests). That way you can log in only once and then skip the log in step for all of the tests.

### Avoid testing third-party dependencies

Only test what you control. Don't try to test links to external sites or third party servers that you do not control. Not only is it time consuming and can slow down your tests but also you cannot control the content of the page you are linking to, or if there are cookie banners or overlay pages or anything else that might cause your test to fail.

Instead, use the [Playwright Network API](/network.md#handle-requests) and guarantee the response needed.

```java
import com.microsoft.playwright.*;

page.route("**/api/fetch_data_third_party_dependency", route -> route.fulfill(
    new Route.FulfillOptions().setStatus(200).setBody(testData)));
page.navigate("https://example.com");
```

### Testing with a database

If working with a database then make sure you control the data. Test against a staging environment and make sure it doesn't change. For visual regression tests make sure the operating system and browser versions are the same.

## Best Practices

### Use locators

In order to write end to end tests we need to first find elements on the webpage. We can do this by using Playwright's built in [locators](./locators.md). Locators come with auto waiting and retry-ability. Auto waiting means that Playwright performs a range of actionability checks on the elements, such as ensuring the element is visible and enabled before it performs the click. To make tests resilient, we recommend prioritizing user-facing attributes and explicit contracts.

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;

// 👍
page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("submit"));
```

#### Use chaining and filtering

Locators can be [chained](./locators.md#matching-inside-a-locator) to narrow down the search to a particular part of the page.

```java
import com.microsoft.playwright.*;

Locator product = page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasText("Product 2"));
```

You can also [filter locators](./locators.md#filtering-locators) by text or by another locator.

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;

page.getByRole(AriaRole.LISTITEM)
    .filter(new Locator.FilterOptions().setHasText("Product 2"))
    .getByRole(AriaRole.BUTTON, new Locator.GetByRoleOptions().setName("Add to cart"))
    .click();
```

#### Prefer user-facing attributes to XPath or CSS selectors

Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests. For example consider selecting this button by its CSS classes. Should the designer change something then the class might change, thus breaking your test.

```java
import com.microsoft.playwright.*;

// 👎
page.locator("button.buttonIcon.episode-actions-later");
```

Use locators that are resilient to changes in the DOM.

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;

// 👍
page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("submit"));
```

### Generate locators

Playwright has a [test generator](./codegen.md) that can generate tests and pick locators for you. It will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

#### Use `codegen` to generate locators

To pick a locator run the `codegen` command followed by the URL that you would like to pick a locator from.

```bash
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen playwright.dev"
```

This will open a new browser window as well as the Playwright inspector. To pick a locator first click on the 'Record' button to stop the recording. By default when you run the `codegen` command it will start a new recording. Once you stop the recording the 'Pick Locator' button will be available to click.

You can then hover over any element on your page in the browser window and see the locator highlighted below your cursor. Clicking on an element will add the locator into the Playwright inspector. You can either copy the locator and paste into your test file or continue to explore the locator by editing it in the Playwright Inspector, for example by modifying the text, and seeing the results in the browser window.

<img height="1274" width="2788" alt="generating locators with codegen" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212103268-e7d8ee8b-d307-4cba-be13-831f3fbb1f40.png" />

#### Use your IDE to pick locators

You can also use the Playwright Inspector launched via `page.pause()` in your test to explore and pick locators interactively while running a test in your IDE with a debugger attached. The inspector shows all matching elements and lets you edit the locator expression live.

### Use web first assertions

Assertions are a way to verify that the expected result and the actual result matched or not. By using [web first assertions](./test-assertions.md) Playwright will wait until the expected condition is met. For example, when testing an alert message, a test would click a button that makes a message appear and check that the alert message is there. If the alert message takes half a second to appear, assertions such as `isVisible()` will wait and retry if needed.

```java
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

// 👍
assertThat(page.getByText("welcome")).isVisible();

// 👎
assertTrue(page.getByText("welcome").isVisible());
```

#### Don't use manual assertions

Don't use manual assertions that are not using web-first assertions. In the code below `isVisible()` will just check the locator is there and return immediately without waiting.

```java
import static org.junit.jupiter.api.Assertions.assertTrue;

// 👎
assertTrue(page.getByText("welcome").isVisible());
```

Use web first assertions such as `isVisible()` instead.

```java
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

// 👍
assertThat(page.getByText("welcome")).isVisible();
```

### Configure debugging

#### Local debugging

For local debugging we recommend you [debug your tests using the Playwright Inspector](./debug.md). You can run tests with `PWDEBUG=1` set which will open the Playwright Inspector, allowing you to step through the test, view actionability logs, and edit locators live.

```bash
PWDEBUG=1 mvn test
```

You can also insert `page.pause()` directly in your test code to pause execution at a specific point and open the Playwright Inspector:

```java
import com.microsoft.playwright.*;

// Pauses test and opens Playwright Inspector
page.pause();
```

You can also debug your tests with your IDE's built-in debugger (IntelliJ IDEA, Eclipse, etc.) by setting breakpoints and running the test in debug mode.

#### Debugging on CI

For CI failures, use the Playwright [trace viewer](./trace-viewer.md) instead of videos and screenshots. The trace viewer gives you a full trace of your tests as a local Progressive Web App (PWA) that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action using dev tools, view network requests and more.

<img height="1920" width="3032" alt="playwrights trace viewer" loading="lazy" src="https://user-images.githubusercontent.com/13063165/212277895-c63d94c2-bd06-4881-864e-62790a072ca3.png" />

Traces can be configured in code and are typically enabled on the first retry of a failed test. We don't recommend recording a trace for every test as it's very performance heavy. You can enable tracing in your test setup:

```java
import com.microsoft.playwright.*;

BrowserContext context = browser.newContext();
context.tracing().start(new Tracing.StartOptions()
    .setScreenshots(true)
    .setSnapshots(true));

Page page = context.newPage();
// ... run your test ...

context.tracing().stop(new Tracing.StopOptions()
    .setPath(Paths.get("trace.zip")));
```

Once you have a trace file, open it with:

```bash
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace trace.zip"
```

### Use Playwright's Tooling

Playwright comes with a range of tooling to help you write tests.
- The [test generator](./codegen.md) can generate tests and pick locators for you.
- The [trace viewer](./trace-viewer.md) gives you a full trace of your tests as a local PWA that can easily be shared. With the trace viewer you can view the timeline, inspect DOM snapshots for each action, view network requests and more.
- The [Playwright Inspector](./debug.md) lets you step through tests, view actionability logs, and edit locators interactively.

### Test across all browsers

Playwright makes it easy to test your site across all [browsers](./browsers.md) no matter what platform you are on. Testing across all browsers ensures your app works for all users. You can run your tests against Chromium, Firefox, and WebKit by launching the appropriate browser type:

```java
import com.microsoft.playwright.*;

try (Playwright playwright = Playwright.create()) {
    // Run against Chromium
    Browser chromium = playwright.chromium().launch();

    // Run against Firefox
    Browser firefox = playwright.firefox().launch();

    // Run against WebKit
    Browser webkit = playwright.webkit().launch();
}
```

To test across all browsers in a parameterized test suite with JUnit 5:

```java
import com.microsoft.playwright.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class CrossBrowserTest {
  @ParameterizedTest
  @ValueSource(strings = {"chromium", "firefox", "webkit"})
  void testAcrossBrowsers(String browserType) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = switch (browserType) {
        case "firefox" -> playwright.firefox().launch();
        case "webkit" -> playwright.webkit().launch();
        default -> playwright.chromium().launch();
      };
      Page page = browser.newPage();
      // ... your test code ...
    }
  }
}
```

### Keep your Playwright dependency up to date

By keeping your Playwright version up to date you will be able to test your app on the latest browser versions and catch failures before the latest browser version is released to the public.

Update the Playwright dependency version in your `pom.xml`:

```xml
<dependency>
    <groupId>com.microsoft.playwright</groupId>
    <artifactId>playwright</artifactId>
    <version><!-- check https://mvnrepository.com/artifact/com.microsoft.playwright/playwright --></version>
</dependency>
```

You can also use the Maven Versions plugin to update to the latest release:

```bash
mvn versions:use-latest-releases -Dincludes=com.microsoft.playwright:playwright
```

Check the [release notes](./release-notes.md) to see what the latest version is and what changes have been released.

### Run tests on CI

Setup CI/CD and run your tests frequently. The more often you run your tests the better. Ideally you should run your tests on each commit and pull request. Playwright can be setup on the [CI environment](/ci.md) of your choice.

Use Linux when running your tests on CI as it is cheaper. Developers can use whatever environment when running locally but use linux on CI.

```bash
mvn test
```

#### Optimize browser downloads on CI

Only install the browsers that you actually need, especially on CI. For example, if you're only testing with Chromium, install just Chromium.

```bash
# Instead of installing all browsers
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps"

# Install only Chromium
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install chromium --with-deps"
```

This saves both download time and disk space on your CI machines.

### Use parallelism and sharding

Playwright supports running tests in parallel. To run tests in parallel with JUnit 5, enable parallel execution in your `junit-platform.properties` file:

```ini
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
```

You can also annotate individual test classes to run their tests concurrently:

```java
import com.microsoft.playwright.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

@Execution(ExecutionMode.CONCURRENT)
public class ParallelTests {
  @Test
  void runsInParallel1() { /* ... */ }

  @Test
  void runsInParallel2() { /* ... */ }
}
```

You can use the Maven Surefire plugin to run tests in parallel across multiple forks:

```bash
mvn test -Dsurefire.forkCount=3 -Dsurefire.reuseForks=false
```

## Productivity tips

### Use Soft assertions

If your test fails, Playwright will give you an error message showing what part of the test failed which you can see either in the terminal, the trace viewer, or your CI output. However, you can also use soft assertions to not immediately terminate the test execution, but rather compile and display a list of failed assertions once the test ended.

Java Playwright does not have a built-in `expect.soft()` equivalent. You can achieve the same behavior using JUnit 5's `assertAll()`, which runs all supplied assertions and reports all failures together:

```java
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;
import org.junit.jupiter.api.Test;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;

@Test
void softAssertionsExample() {
    // Make a few checks that will not stop the test when failed...
    assertAll(
        () -> assertThat(page.getByTestId("status")).hasText("Success")
    );

    // ... and continue the test to check more things.
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("next page")).click();
}
```
