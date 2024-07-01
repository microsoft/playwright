---
id: intro
title: "Installation"
---

## Introduction

Playwright was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation.

Playwright is distributed as a set of [Maven](https://maven.apache.org/what-is-maven.html) modules. The easiest way to use it is to add one dependency to your project's `pom.xml` as described below. If you're not familiar with Maven please refer to its [documentation](https://maven.apache.org/guides/getting-started/maven-in-five-minutes.html).

## Usage

Get started by installing Playwright and running the example file to see it in action.

<Tabs
  defaultValue="java"
  values={[
    {label: 'App.java', value: 'java'},
    {label: 'pom.xml', value: 'pom'}
  ]
}>
<TabItem value="java">

```java title="src/main/java/org/example/App.java"
package org.example;

import com.microsoft.playwright.*;

public class App {
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

</TabItem>
<TabItem value="pom">

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>org.example</groupId>
  <artifactId>examples</artifactId>
  <version>0.1-SNAPSHOT</version>
  <name>Playwright Client Examples</name>
  <properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
    <dependency>
      <groupId>com.microsoft.playwright</groupId>
      <artifactId>playwright</artifactId>
      <version>%%VERSION%%</version>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.10.1</version>
        <!-- References to interface static methods are allowed only at source level 1.8 or above -->
        <configuration>
          <source>1.8</source>
          <target>1.8</target>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
```

</TabItem>
</Tabs>

With the Example.java and pom.xml above, compile and execute your new program as follows:

```bash
mvn compile exec:java -D exec.mainClass="org.example.App"
```

Running it downloads the Playwright package and installs browser binaries for Chromium, Firefox and WebKit. To modify this behavior see [installation parameters](./browsers.md#install-browsers).

## First script

In our first script, we will navigate to `playwright.dev` and take a screenshot in WebKit.

```java
package org.example;

import com.microsoft.playwright.*;
import java.nio.file.Paths;

public class App {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      Browser browser = playwright.webkit().launch();
      Page page = browser.newPage();
      page.navigate("https://playwright.dev/");
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("example.png")));
    }
  }
}
```

By default, Playwright runs the browsers in headless mode. To see the browser UI, pass the `setHeadless(false)` flag while launching the browser. You can also use [`option: slowMo`] to slow down execution. Learn more in the debugging tools [section](./debug.md).

```java
playwright.firefox().launch(new BrowserType.LaunchOptions().setHeadless(false).setSlowMo(50));
```

## Running the Example script

```bash
mvn compile exec:java -D exec.mainClass="org.example.App"
```

By default browsers launched with Playwright run headless, meaning no browser UI will open up when running the script. To change that you can pass `new BrowserType.LaunchOptions().setHeadless(false)` when launching the browser.

## System requirements

- Java 8 or higher.
- Windows 10+, Windows Server 2016+ or Windows Subsystem for Linux (WSL).
- macOS 13 Ventura, or macOS 14 Sonoma.
- Debian 11, Debian 12, Ubuntu 20.04 or Ubuntu 22.04, Ubuntu 24.04, on x86-64 and arm64 architecture.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run single test, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)
