---
id: browsers
title: "Browsers"
---

Each version of Playwright needs specific versions of browser binaries to operate. By default Playwright downloads Chromium, WebKit and Firefox browser versions that it supports. With every release, Playwright updates the versions
of the browsers it supports, so that the latest Playwright would support the latest browsers at any moment.

<!-- TOC -->

## Chromium

For Google Chrome, Microsoft Edge and other Chromium-based browsers, by default, Playwright uses open source Chromium builds.
These builds match the current [Chrome Dev Channel](https://support.google.com/chrome/a/answer/9027636?hl=en) at the time
of each Playwright release, i.e. it is new with every Playwright update. Since Chromium project is ahead of the branded browsers,
when the world is on Google Chrome 89, Playwright already supports Chromium 91 that will hit Google Chrome and Microsoft Edge
if a few weeks.

There is also a way to opt into using Google Chrome's or Microsoft Edge's branded builds for testing. For details
on when to opt into stable channels, refer to the [Google Chrome & Microsoft Edge](#google-chrome--microsoft-edge) section below.

## Firefox

Playwright's Firefox version matches the recent [Firefox Beta](https://www.mozilla.org/en-US/firefox/channel/desktop/)
build.

### Firefox-Stable

Playwright team maintains a Playwright Firefox version that matches the latest Firefox Stable, a.k.a. `firefox-stable`.

Using `firefox-stable` is a 2-steps process:

1. Installing `firefox-stable` with Playwright CLI.
    ```sh js
    npx playwright install firefox-stable
    ```

    ```sh java
    mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install firefox-stable"
    ```

    ```sh python
    playwright install firefox-stable
    ```

2. Using `firefox-stable` channel when launching browser.
    ```js
    const { firefox } = require('playwright');
    const browser = await firefox.launch({
      channel: 'firefox-stable'
    });
    ```

    ```java
    import com.microsoft.playwright.*;

    public class Example {
      public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
          BrowserType firefox = playwright.firefox();
          Browser browser = firefox.launch(new BrowserType.LaunchOptions().setChannel("firefox-stable"));
        }
      }
    }
    ```

    ```python async
    browser = await playwright.firefox.launch(channel="firefox-stable")
    ```

    ```python sync
    browser = playwright.firefox.launch(channel="firefox-stable")
    ```

    ```csharp
    using Microsoft.Playwright;

    class Guides
    {
      public async void Main()
      {
        using var playwright = await Playwright.CreateAsync();
        var browser = playwright.Firefox.LaunchAsync(channel: BrowserChannel.FirefoxStable);
      }
    }
    ```

## WebKit

Playwright's WebKit version matches the recent WebKit trunk build, before it is used in Apple Safari and
other WebKit-based browsers. This gives a lot of lead time to react on the potential browser update issues. We are
also working on a dedicated support for builds that would match Apple Safari Technology Preview.

## Google Chrome & Microsoft Edge

While Playwright will download and use the recent Chromium build by default, it can operate against the stock Google
Chrome and Microsoft Edge browsers available on the machine. In particular, current Playwright version will support Stable and Beta channels
of these browsers. Here is how you can opt into using the stock browser:

```js
const { chromium } = require('playwright');
const browser = await chromium.launch({
  channel: 'chrome' // or 'msedge', 'chrome-beta', 'msedge-beta', 'msedge-dev', etc.
});
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      // Can be "msedge", "chrome-beta", "msedge-beta", "msedge-dev", etc.
      Browser browser = chromium.launch(new BrowserType.LaunchOptions().setChannel("chrome"));
    }
  }
}
```

```python async
# Can be "msedge", "chrome-beta", "msedge-beta", "msedge-dev", etc.
browser = await playwright.chromium.launch(channel="chrome")
```

```python sync
# Can be "msedge", "chrome-beta", "msedge-beta", "msedge-dev", etc.
browser = playwright.chromium.launch(channel="chrome")
```

```csharp
using Microsoft.Playwright;

class Guides
{
  public async void Main()
  {
      using var playwright = await Playwright.CreateAsync();
      var browser = await playwright.Chromium.LaunchAsync(channel: BrowserChannel.Chrome)
  }
}
```
:::note
Playwright bundles a recent Chromium build, but not Google Chrome or Microsoft Edge browsers - these should be installed manually before use.
:::

### When to use Google Chrome & Microsoft Edge and when not to?

**Defaults**

Using default Playwright configuration with the latest Chromium is a good idea most of the time.
Since Playwright is ahead of Stable channels for the browsers, it gives peace of mind that the
upcoming Google Chrome or Microsoft Edge releases won't break your site. You catch breakage
early and have a lot of time to fix it before the official Chrome update.

**Regression testing**

Having said that, testing policies often require regression testing to be performed against
the current publicly available browsers. In this case, you can opt into one of the stable channels,
`"chrome"` or `"msedge"`.

**Media codecs**

Another reason for testing using official binaries is to test functionality related to media codecs.
Chromium does not have all the codecs that Google Chrome or Microsoft Edge are bundling due to
various licensing considerations and agreements. If your site relies on this kind of codecs (which is
rarely the case), you also want to use official channel.

**Enterprise policy**

Google Chrome and Microsoft Edge respect enterprise policies, which include limitations to the capabilities,
network proxy, mandatory extensions that stand in the way of testing. So if you are a part of the
organization that uses such policies, it is the easiest to use bundled Chromium for your local testing,
you can still opt into stable channels on the bots that are typically free of such restrictions.
