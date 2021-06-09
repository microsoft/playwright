---
id: browsers
title: "Browsers"
---

Each version of Playwright needs specific versions of browser binaries to operate. Depending on the language you use, Playwright will either download these browsers at package install time for you or will require you to use [Playwright CLI](./cli.md) to install the browsers. Please refer to the [getting started](./intro.md) to see what your platform port does.

With every release, Playwright updates the versions of the browsers it supports, so that the latest Playwright would support the latest browsers at any moment. It means that every time you update playwright, you might need to re-run the `install` CLI command.

<!-- TOC -->

## Chromium

For Google Chrome, Microsoft Edge and other Chromium-based browsers, by default, Playwright uses open source Chromium builds.
 Since Chromium project is ahead of the branded browsers,
when the world is on Google Chrome 89, Playwright already supports Chromium 91 that will hit Google Chrome and Microsoft Edge
if a few weeks.

There is also a way to opt into using Google Chrome's or Microsoft Edge's branded builds for testing. For details
on when to opt into stable channels, refer to the [Google Chrome & Microsoft Edge](#google-chrome--microsoft-edge) section below.

## Firefox

Playwright's Firefox version matches the recent [Firefox Stable](https://www.mozilla.org/en-US/firefox/new/)
build.

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
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var chromium = playwright.Chromium;
        // Can be "msedge", "chrome-beta", "msedge-beta", "msedge-dev", etc.
        var browser = await chromium.LaunchAsync(new BrowserTypeLaunchOptions { Channel = "chrome" });
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
