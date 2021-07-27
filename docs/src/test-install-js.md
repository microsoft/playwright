---
id: test-install
title: "Advanced: installing browsers"
---

<!-- TOC -->

## Installing browser binaries

Each version of Playwright Test needs specific versions of browser binaries to operate. Playwright Test includes [Command Line Interface](./cli.md) that can download these binaries. By default, Playwright Test downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

```bash
# Add dependency
npm i -D @playwright/test
# Download browser binaries
npx playwright install
```

These browsers will take a few hundred megabytes of disk space when installed:

```bash
du -hs ~/Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

## Installing a single browser binary

Playwright Test downloads Chromium, Firefox and WebKit browsers by default. To install a specific browser, pass it as an argument.

```bash
npx playwright install webkit
```

## Managing browser binaries

You can override default installation behavior using environment variables. When installing browsers, ask Playwright Test to download them into a specific location.

```bash
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright install

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npx playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npx playwright install
```

When running tests, ask it to search for browsers in a shared location.

```bash
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npx playwright test

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npx playwright test

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npx playwright test
```

Or you can opt into the hermetic install and place binaries in the local folder:

```bash
# Linux/macOS
# Places binaries to node_modules/@playwright/test
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install

# Windows with cmd.exe
# Places binaries to node_modules\@playwright\test
set PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install

# Windows with PowerShell
# Places binaries to node_modules\@playwright\test
$env:PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install
```

Playwright Test keeps track of packages that need those browsers and will garbage collect them as you update Playwright Test to the newer versions.

## Install behind a firewall or a proxy

By default, Playwright Test downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```bash
# Linux/macOS
HTTPS_PROXY=https://192.0.2.1 npx playwright install

# Windows with cmd.exe
set HTTPS_PROXY=https://192.0.2.1
npx playwright install

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.0.2.1"
npx playwright install
```

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```bash
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 npx playwright install

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
npx playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
npx playwright install
```

It is also possible to choose a per-browser download host using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

## Stale browser removal

Playwright Test keeps track of the clients that use its browsers. When there are no more clients that require particular
version of the browser, that version is deleted from the system. That way you can safely use Playwright Test instances of
different versions and at the same time, you don't waste disk space for the browsers that are no longer in use.

To opt-out from the unused browser removal, you can set the `PLAYWRIGHT_SKIP_BROWSER_GC=1` environment variable.
