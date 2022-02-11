---
id: browsers
title: "Browsers"
---

Each version of Playwright needs specific versions of browser binaries to operate. Depending on the language you use, Playwright will either download these browsers at package install time for you, or you will need to use [Playwright CLI](./cli.md) to install these browsers.

With every release, Playwright updates the versions of the browsers it supports, so that the latest Playwright would support the latest browsers at any moment. It means that every time you update playwright, you might need to re-run the `install` CLI command.

<!-- TOC -->

## Chromium

For Google Chrome, Microsoft Edge and other Chromium-based browsers, by default, Playwright uses open source Chromium builds.
Since Chromium project is ahead of the branded browsers, when the world is on Google Chrome N, Playwright already supports
Chromium N+1 that will be released in Google Chrome and Microsoft Edge in a few weeks.

There is also a way to opt into using Google Chrome's or Microsoft Edge's branded builds for testing. For details
on when to opt into stable channels, refer to the [Google Chrome & Microsoft Edge](#google-chrome--microsoft-edge) section below.

## Firefox

Playwright's Firefox version matches the recent [Firefox Stable](https://www.mozilla.org/en-US/firefox/new/)
build.

## WebKit

Playwright's WebKit version matches the recent WebKit trunk build, before it is used in Apple Safari and
other WebKit-based browsers. This gives a lot of lead time to react on the potential browser update issues.

## Google Chrome & Microsoft Edge

While Playwright can download and use the recent Chromium build, it can operate against the stock Google
Chrome and Microsoft Edge browsers available on the machine. In particular, current Playwright version will
support Stable and Beta channels of these browsers. Here is how you can opt into using the stock browser:

```js js-flavor=js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    channel: 'chrome',
  },
};

module.exports = config;
```

```js js-flavor=ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  use: {
    channel: 'chrome',
  },
};
export default config;
```

```js js-flavor=library
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

## Installing browsers

### Prerequisites for .NET
* langs: csharp

To invoke Playwright CLI commands, you need to invoke a PowerShell script:

```bash
pwsh bin\Debug\netX\playwright.ps1 --help
```

Playwright can install supported browsers by means of the CLI tool.

```bash csharp
# Running without arguments will install all browsers
pwsh bin\Debug\netX\playwright.ps1 install
```

You can also install specific browsers by providing an argument:

```bash csharp
# Install WebKit
pwsh bin\Debug\netX\playwright.ps1 install webkit
```

See all supported browsers:

```bash csharp
pwsh bin\Debug\netX\playwright.ps1 install --help
```

## Managing browser binaries

Playwright downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

These browsers will take a few hundred megabytes of disk space when installed:

```bash
du -hs ~/Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When installing Playwright, ask it to download browsers into a specific location:

```bash bash-flavor=bash lang=js
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright install
```

```bash bash-flavor=batch lang=js
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npx playwright install
```

```bash bash-flavor=powershell lang=js
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npx playwright install
```

```bash bash-flavor=bash lang=python
pip install playwright
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers python -m playwright install
```

```bash bash-flavor=batch lang=python
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
pip install playwright
playwright install
```

```bash bash-flavor=powershell lang=python
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
pip install playwright
playwright install
```

```bash bash-flavor=bash lang=java
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers mvn test
```

```bash bash-flavor=batch lang=java
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
mvn test
```

```bash bash-flavor=powershell lang=java
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
mvn test
```

```bash bash-flavor=bash lang=csharp
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers 
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=batch lang=csharp
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=powershell lang=csharp
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
pwsh bin\Debug\netX\playwright.ps1 install
```

When running Playwright scripts, ask it to search for browsers in a shared location.

```bash bash-flavor=bash lang=js
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright test
```

```bash bash-flavor=batch lang=js
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npx playwright test
```

```bash bash-flavor=powershell lang=js
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npx playwright test
```

```bash bash-flavor=bash lang=python
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers python playwright_script.py
```

```bash bash-flavor=batch lang=python
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
python playwright_script.py
```

```bash bash-flavor=powershell lang=python

$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
python playwright_script.py
```

```bash bash-flavor=bash lang=java
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers mvn test
```

```bash bash-flavor=batch lang=java
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
mvn test
```

```bash bash-flavor=powershell lang=java
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
mvn test
```

```bash bash-flavor=bash lang=csharp
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers dotnet test
```

```bash bash-flavor=batch lang=csharp
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
dotnet test
```

```bash bash-flavor=powershell lang=csharp
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
dotnet test
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

:::note
Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.
:::

### Managing browser binaries
* langs: js

You can opt into the hermetic install and place binaries in the local folder:

```bash bash-flavor=bash
# Places binaries to node_modules/@playwright/test
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install
```

```bash bash-flavor=batch
# Places binaries to node_modules\@playwright\test
set PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install
```

```bash bash-flavor=powershell
# Places binaries to node_modules\@playwright\test
$env:PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install
```

## Install behind a firewall or a proxy

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```bash bash-flavor=bash lang=js
# For Playwright Test
HTTPS_PROXY=https://192.0.2.1 npx playwright install

# For Playwright Library
HTTPS_PROXY=https://192.0.2.1 npm install playwright
```

```bash bash-flavor=batch lang=js
# For Playwright Test
set HTTPS_PROXY=https://192.0.2.1
npx playwright install

# For Playwright Library
set HTTPS_PROXY=https://192.0.2.1
npm install playwright
```

```bash bash-flavor=powershell lang=js
# For Playwright Test
$env:HTTPS_PROXY="https://192.0.2.1"
npx playwright install

# For Playwright Library
$env:HTTPS_PROXY="https://192.0.2.1"
npm install playwright
```

```bash bash-flavor=bash lang=python
pip install playwright
HTTPS_PROXY=https://192.0.2.1 playwright install
```

```bash bash-flavor=batch lang=python
set HTTPS_PROXY=https://192.0.2.1
pip install playwright
playwright install
```

```bash bash-flavor=powershell lang=python
$env:HTTPS_PROXY="https://192.0.2.1"
pip install playwright
playwright install
```

```bash bash-flavor=bash lang=java
HTTPS_PROXY=https://192.0.2.1 mvn test
```

```bash bash-flavor=batch lang=java
set HTTPS_PROXY=https://192.0.2.1
mvn test
```

```bash bash-flavor=powershell lang=java
$env:HTTPS_PROXY="https://192.0.2.1"
mvn test
```

```bash bash-flavor=bash lang=csharp
HTTPS_PROXY=https://192.0.2.1 pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=batch lang=csharp
set HTTPS_PROXY=https://192.0.2.1
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=powershell lang=csharp
$env:HTTPS_PROXY="https://192.0.2.1"
pwsh bin\Debug\netX\playwright.ps1 install
```

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```bash bash-flavor=bash lang=js
# For Playwright Test
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npx playwright install

# For Playwright Library
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npm install playwright
```

```bash bash-flavor=batch lang=js
# For Playwright Test
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npx playwright install

# For Playwright Library
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npm install playwright
```

```bash bash-flavor=powershell lang=js
# For Playwright Test
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npx playwright install

# For Playwright Library
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npm install playwright
```

```bash bash-flavor=bash lang=python
pip install playwright
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 playwright install
```

```bash bash-flavor=batch lang=python
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
pip install playwright
playwright install
```

```bash bash-flavor=powershell lang=python
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
pip install playwright
playwright install
```

```bash bash-flavor=bash lang=java
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 mvn test
```

```bash bash-flavor=batch lang=java
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
mvn test
```

```bash bash-flavor=powershell lang=java
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
mvn test
```

```bash bash-flavor=bash lang=csharp
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=batch lang=csharp
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=powershell lang=csharp
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
pwsh bin\Debug\netX\playwright.ps1 install
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```bash bash-flavor=bash lang=js
# For Playwright Test
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npx playwright install

# For Playwright Library
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npm install playwright
```

```bash bash-flavor=batch lang=js
# For Playwright Test
set PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npx playwright install

# For Playwright Library
set PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npm install playwright
```

```bash bash-flavor=powershell lang=js
# For Playwright Test
$env:PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST="203.0.113.3"
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npx playwright install

# For Playwright Library
$env:PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST="203.0.113.3"
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npm install playwright
```

```bash bash-flavor=bash lang=python
pip install playwright
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 playwright install
```

```bash bash-flavor=batch lang=python
set PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
pip install playwright
playwright install
```

```bash bash-flavor=powershell lang=python
$env:PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST="203.0.113.3"
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
pip install playwright
playwright install
```

```bash bash-flavor=bash lang=java
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 mvn test
```

```bash bash-flavor=batch lang=java
set PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
mvn test
```

```bash bash-flavor=powershell lang=java
$env:PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST="203.0.113.3"
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
mvn test
```

```bash bash-flavor=bash lang=csharp
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=batch lang=csharp
set PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=powershell lang=csharp
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
$env:PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST="203.0.113.3"
pwsh bin\Debug\netX\playwright.ps1 install
```

## Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```bash bash-flavor=bash lang=python
pip install playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 python -m playwright install
```

```bash bash-flavor=batch lang=python
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pip install playwright
playwright install
```

```bash bash-flavor=powershell lang=python
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pip install playwright
playwright install
```

```bash bash-flavor=bash lang=java
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 mvn test
```

```bash bash-flavor=batch lang=java
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test
```

```bash bash-flavor=powershell lang=java
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test
```

```bash bash-flavor=bash lang=csharp
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=batch lang=csharp
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pwsh bin\Debug\netX\playwright.ps1 install
```

```bash bash-flavor=powershell lang=csharp
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pwsh bin\Debug\netX\playwright.ps1 install
```

## Download single browser binary
* langs: python

Playwright downloads Chromium, Firefox and WebKit browsers by default. To install a specific browser, pass it as an argument during installation.

```bash
pip install playwright
playwright install firefox
```

## Stale browser removal

Playwright keeps track of the clients that use its browsers. When there are no more clients that require particular
version of the browser, that version is deleted from the system. That way you can safely use Playwright instances of
different versions and at the same time, you don't waste disk space for the browsers that are no longer in use.

To opt-out from the unused browser removal, you can set the `PLAYWRIGHT_SKIP_BROWSER_GC=1` environment variable.
