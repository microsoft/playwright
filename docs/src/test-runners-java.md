---
id: test-runners
title: "Test Runners"
---

With a few lines of code, you can hook up Playwright to your favorite Java test runner.

Playwright and Browser instances can be reused between tests for better performance. We
recommend running each test case in a new BrowserContext, this way browser state will be
isolated between the tests.

<!-- TOC -->

## JUnit

Playwright provides base classes to write tests with JUnit via the `com.microsoft.playwright.junit` package.

```java
package org.example;

import com.microsoft.playwright.junit.PageTest;
import org.junit.jupiter.api.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class TestExample extends PageTest {
  @Test
  void shouldClickButton() {
    page.navigate("data:text/html,<script>var result;</script><button onclick='result=\"Clicked\"'>Go</button>");
    page.locator("button").click();
    assertEquals("Clicked", page.evaluate("result"));
  }

  @Test
  void shouldCheckTheBox() {
    page.setContent("<input id='checkbox' type='checkbox'></input>");
    page.locator("input").check();
    assertTrue((Boolean) page.evaluate("() => window['checkbox'].checked"));
  }

  @Test
  void shouldSearchWiki() {
    page.navigate("https://www.wikipedia.org/");
    page.locator("input[name=\"search\"]").click();
    page.locator("input[name=\"search\"]").fill("playwright");
    page.locator("input[name=\"search\"]").press("Enter");
    assertEquals("https://en.wikipedia.org/wiki/Playwright", page.url());
  }
}
```

Run your tests against Chromium

```bash
mvn test
```

Run your tests against WebKit

```bash tab=bash-bash
BROWSER=webkit mvn test
```

```batch tab=bash-batch
set BROWSER=webkit
mvn test
```

```powershell tab=bash-powershell
$env:BROWSER="webkit"
mvn test
```

Run your tests with GUI

```bash tab=bash-bash
HEADED=1 mvn test
```

```batch tab=bash-batch
set HEADED=1
mvn test
```

```powershell tab=bash-powershell
$env:HEADED="1"
mvn test
```

You can also choose specifically which tests to run:

```bash
mvn test -Dtest="Name#Slogan"
```

### Running Tests in Parallel

By default JUnit will run all tests sequentially on a single thread. Since JUnit 5.3 you can change this behavior to run tests in parallel
to speed up execution (see [this page](https://junit.org/junit5/docs/snapshot/user-guide/index.html#writing-tests-parallel-execution)).
Since it is not safe to use same Playwright objects from multiple threads without extra synchronization we recommend you create Playwright
instance per thread and use it on that thread exclusively. Here is an example how to run multiple test classes in parallel.

Use [`@TestInstance(TestInstance.Lifecycle.PER_CLASS)`](https://junit.org/junit5/docs/current/api/org.junit.jupiter.api/org/junit/jupiter/api/TestInstance.html)
annotation to make JUnit create one instance of a class for all test methods within that class (by default each JUnit will create a new instance of the class
for each test method). Store [Playwright] and [Browser] objects in instance fields. They will be shared between tests. Each instance of the class will use its
own copy of Playwright. This is done automatically if you use the base classes from the `com.microsoft.playwright.junit` package.

Configure JUnit to run tests in each class sequentially and run multiple classes on parallel threads (with max
number of thread equal to 1/2 of the number of CPU cores):

```bash
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = same_thread
junit.jupiter.execution.parallel.mode.classes.default = concurrent
junit.jupiter.execution.parallel.config.strategy=dynamic
junit.jupiter.execution.parallel.config.dynamic.factor=0.5
```

### Customizing [BrowserContext] options

To customize context options, you can override the `contextOptions` method of your test class derived from `com.microsoft.playwright.junit.PageTest` or `com.microsoft.playwright.junit.ContextTest`. See the following example:

```java
import com.microsoft.playwright.junit.PageTest;
import com.microsoft.playwright.Browser.NewContextOptions;
import com.microsoft.playwright.options.ColorScheme;

import org.junit.jupiter.api.*;

public class MyTest extends PageTest {
  @Test
  void TestWithCustomContextOptions() {
    // The following Page (and BrowserContext) instance has the custom colorScheme,
    // viewport and baseURL set:
    page.navigate("/login");
  }

  @Override
  public NewContextOptions contextOptions() {
    return new Browser.NewContextOptions()
        .setColorScheme(ColorScheme.LIGHT)
        .setViewportSize(1920, 1080)
        .setBaseURL("https://github.com");
  }
}
```

### Base JUnit classes for Playwright

There are a few base classes available to you in `com.microsoft.playwright.junit` package:

|Test          |Description|
|--------------|-----------|
|PageTest      |Each test gets a fresh copy of a web [Page] created in its own unique [BrowserContext]. Extending this class is the simplest way of writing a fully-functional Playwright test.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|ContextTest   |Each test will get a fresh copy of a [BrowserContext]. You can create as many pages in this context as you'd like. Using this test is the easiest way to test multi-page scenarios where you need more than one tab.<br></br><br></br>Note: You can override the `ContextOptions` method in each test file to control context options, the ones typically passed into the [`method: Browser.newContext`] method. That way you can specify all kinds of emulation options for your test file individually.|
|BrowserTest   |Each test will get a browser and can create as many contexts as it likes. Each test is responsible for cleaning up all the contexts it created.|
|PlaywrightTest|This gives each test a Playwright object so that the test could start and stop as many browsers as it likes.|

### Using Gradle

You can use a Gradle build configuration script, written in Groovy or Kotlin.

<Tabs
  defaultValue="gradle"
  values={[
    {label: 'build.gradle', value: 'gradle'},
    {label: 'build.gradle.kts', value: 'gradle-kotlin'}
  ]
}>
<TabItem value="gradle">

```java
plugins {
  application
  id 'java'
}

repositories {
  mavenCentral()
}

dependencies {
  implementation 'com.microsoft.playwright:playwright:%%VERSION%%'
}

application {
  mainClass = 'org.example.App'
}

// Usage: ./gradlew playwright --args="help"
task playwright(type: JavaExec) {
  classpath sourceSets.test.runtimeClasspath
  mainClass = 'com.microsoft.playwright.CLI'
}

test {
  useJUnitPlatform()
}
```

</TabItem>
<TabItem value="gradle-kotlin">

```java
plugins {
  application
  id("java")
}

repositories {
  mavenCentral()
}

dependencies {
  implementation("com.microsoft.playwright:playwright:%%VERSION%%")
}

application {
  mainClass.set("org.example.App")
}

// Usage: ./gradlew playwright --args="help"
tasks.register<JavaExec>("playwright") {
  classpath(sourceSets["test"].runtimeClasspath)
  mainClass.set("com.microsoft.playwright.CLI")
}

tasks.test {
  useJUnitPlatform()
  testLogging {
    events("passed", "skipped", "failed")
  }
}
```

</TabItem>
</Tabs>

Tests can then be launched as follows:

```bash
./gradlew run
```

Also, Playwright command line tools can be run with :

```bash
./gradlew playwright --args="help"
```

## TestNG

In [TestNG](https://testng.org/) you can initialize [Playwright] and [Browser] in [@BeforeClass](https://javadoc.io/doc/org.testng/testng/latest/org/testng/annotations/BeforeClass.html) method and
destroy them in [@AfterClass](https://javadoc.io/doc/org.testng/testng/latest/org/testng/annotations/AfterClass.html). In the example below all three test methods use the same
[Browser]. Each test uses its own [BrowserContext] and [Page].

```java
package org.example;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import org.testng.annotations.*;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

public class TestExample {
  // Shared between all tests in this class.
  Playwright playwright;
  Browser browser;

  // New instance for each test method.
  BrowserContext context;
  Page page;

  @BeforeClass
  void launchBrowser() {
    playwright = Playwright.create();
    browser = playwright.chromium().launch();
  }

  @AfterClass
  void closeBrowser() {
    playwright.close();
  }

  @BeforeMethod
  void createContextAndPage() {
    context = browser.newContext();
    page = context.newPage();
  }

  @AfterMethod
  void closeContext() {
    context.close();
  }

  @Test
  void shouldClickButton() {
    page.navigate("data:text/html,<script>var result;</script><button onclick='result=\"Clicked\"'>Go</button>");
    page.locator("button").click();
    assertEquals("Clicked", page.evaluate("result"));
  }

  @Test
  void shouldCheckTheBox() {
    page.setContent("<input id='checkbox' type='checkbox'></input>");
    page.locator("input").check();
    assertTrue((Boolean) page.evaluate("() => window['checkbox'].checked"));
  }

  @Test
  void shouldSearchWiki() {
    page.navigate("https://www.wikipedia.org/");
    page.locator("input[name=\"search\"]").click();
    page.locator("input[name=\"search\"]").fill("playwright");
    page.locator("input[name=\"search\"]").press("Enter");
    assertEquals("https://en.wikipedia.org/wiki/Playwright", page.url());
  }
}
```
