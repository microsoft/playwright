---
id: multithreading
title: "Multithreading"
---

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
      page.navigate("http://whatsmyuseragent.org/");
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