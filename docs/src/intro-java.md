---
id: intro
title: "Getting Started"
---

<!-- TOC -->
- [Release notes](./release-notes.md)

## Installation

Playwright is distributed as a set of [Maven](https://maven.apache.org/what-is-maven.html) modules. The easiest way to use it is to add one dependency to your project's `pom.xml` as described below. If you're not familiar with Maven please refer to its [documentation](https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html).

```xml
<dependency>
  <groupId>com.microsoft.playwright</groupId>
  <artifactId>playwright</artifactId>
  <version>0.180.0</version>
</dependency>
```

These commands download the Playwright package and install browser binaries for Chromium, Firefox and WebKit. To modify this behavior see [installation parameters](./installation.md).

## Usage

Once installed, you can `import` Playwright in a Java file, and launch any of the 3 browsers (`chromium`, `firefox` and `webkit`).

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.chromium().launch();
      Page page = browser.newPage();
      page.navigate("http://playwright.dev");
      System.out.println(page.title());
    }
  }
}
```

## First script

In our first script, we will navigate to `whatsmyuseragent.org` and take a screenshot in WebKit.

```java
import com.microsoft.playwright.*;
import java.nio.file.Paths;

public class WebKitScreenshot {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.webkit().launch();
      Page page = browser.newPage();
      page.navigate("http://whatsmyuseragent.org/");
      page.screenshot(new Page.ScreenshotOptions().withPath(Paths.get("example.png")));
    }
  }
}
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `headless=false` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```java
playwright.firefox().launch(new BrowserType.LaunchOptions().withHeadless(false).withSlowMo(50));
```

## System requirements

Playwright requires **Java 8** or newer. The browser binaries for Chromium,
Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

* **Windows**: Works with Windows and Windows Subsystem for Linux (WSL).
* **macOS**: Requires 10.14 or above.
* **Linux**: Depending on your Linux distribution, you might need to install additional
  dependencies to run the browsers.
  * Firefox requires Ubuntu 18.04+
  * For Ubuntu 18.04, the additional dependencies are defined in [our Docker image](https://github.com/microsoft/playwright/blob/master/utils/docker/Dockerfile.bionic),
    which is based on Ubuntu.
