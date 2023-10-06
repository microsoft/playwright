---
id: multithreading
title: "Multithreading"
---

## Introduction

Playwright Java is not thread safe, i.e. all its methods as well as methods on all objects created by it (such as [BrowserContext], [Browser], [Page] etc.) are expected to be called on the same thread where the Playwright object was created or proper synchronization should be implemented to ensure only one thread calls Playwright methods at any given time. Having said that it's okay to create multiple Playwright instances each on its own thread.

Here is an example where three playwright instances are created each on its own thread. Each instance launches its own browser process and runs the test against it.

```java
package org.example;

import com.microsoft.playwright.*;

import java.nio.file.Paths;

import static java.util.Arrays.asList;

public class PlaywrightThread extends Thread {
  private final String browserName;

  private PlaywrightThread(String browserName) {
    this.browserName = browserName;
  }

  public static void main(String[] args) throws InterruptedException {
    // Create separate playwright thread for each browser.
    for (String browserName: asList("chromium", "webkit", "firefox")) {
      Thread thread = new PlaywrightThread(browserName);
      thread.start();
    }
  }

  @Override
  public void run() {
    try (Playwright playwright = Playwright.create()) {
      BrowserType browserType = getBrowserType(playwright, browserName);
      Browser browser = browserType.launch();
      Page page = browser.newPage();
      page.navigate("https://playwright.dev/");
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("user-agent-" + browserName + ".png")));
    }
  }

  private static BrowserType getBrowserType(Playwright playwright, String browserName) {
    switch (browserName) {
      case "chromium":
        return playwright.chromium();
      case "webkit":
        return playwright.webkit();
      case "firefox":
        return playwright.firefox();
      default:
        throw new IllegalArgumentException();
    }
  }
}
```

## Synchronous API and event dispatching

In the synchronous Playwright API all events are dispatched only when Playwright is running its message loop.
This happens automatically when you call any of the API methods and doesn't happen if there are no active
Playwright calls on the stack. If you need to wait for an event the best way to do this is via one of the
`waitFor*` methods.

### Page.waitForTimeout() vs. Thread.sleep()

One consequence of the synchronous API is that if you for whatever reason call `Thread.sleep()` no events will
be fired while the thread is sleeping. If you want events from the browser to be dispatched while the program
execution is paused use [`method: Page.waitForTimeout`] or [`method: Frame.waitForTimeout`]:

```java
page.onResponse(response -> System.out.println(response.url()));
page.navigate("https://playwright.dev");
System.out.println("-- did navigate --");
// Block current thread for 60s and ensure the events are dispatched.
page.waitForTimeout(60_000);
```
