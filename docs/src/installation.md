---
id: installation
title: "Installation"
---

<!-- TOC -->

## Managing browser binaries

Each version of Playwright needs specific versions of browser binaries to operate. By default Playwright downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

```sh js
npm i -D playwright
```

```sh python
pip install playwright
playwright install
```

These browsers will take few hundreds of megabytes of the disk space when installed:

```sh
du -hs ./Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When installing Playwright, ask it to download browsers into a specific location:

```sh js
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers python -m playwright install

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
pip install playwright
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
pip install playwright
playwright install
```

```sh java
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers mvn test
```

When running Playwright scripts, ask it to search for browsers in a shared location.

```sh js
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers node playwright-script.js

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
node playwright-script.js

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
node playwright-script.js
```

```sh python
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers python playwright_script.js

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
python playwright_script.py

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
python playwright_script.py
```

```sh java
# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
mvn test
```

Or you can opt into the hermetic install and place binaries in the local folder:

```sh js
# Linux/macOS
# Places binaries to node_modules/playwright
PLAYWRIGHT_BROWSERS_PATH=0 npm i -D playwright

# Windows with cmd.exe
# Places binaries to node_modules\playwright
set PLAYWRIGHT_BROWSERS_PATH=0
npm i -D playwright

# Windows with PowerShell
# Places binaries to node_modules\playwright
$env:PLAYWRIGHT_BROWSERS_PATH=0
npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
PLAYWRIGHT_BROWSERS_PATH=0 playwright install

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=0
pip install playwright
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH=0
pip install playwright
playwright install
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

:::note
Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.
:::

## Install behind the firewall or proxy

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```sh js
# Linux/macOS
HTTPS_PROXY=https://192.168.1.78 npm i -D playwright

# Windows with cmd.exe
set HTTPS_PROXY=https://192.168.1.78
npm i -D playwright

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.168.1.78"
npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
HTTPS_PROXY=https://192.168.1.78 playwright install

# Windows with cmd.exe
set HTTPS_PROXY=https://192.168.1.78
pip install playwright
playwright install

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.168.1.78"
pip install playwright
playwright install
```

```sh java
# Linux/macOS
HTTPS_PROXY=https://192.168.1.78 mvn test

# Windows with cmd.exe
set HTTPS_PROXY=https://192.168.1.78
mvn test

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.168.1.78"
mvn test
```

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```sh js
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.168.1.78"
npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 playwright install

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78
pip install playwright
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.168.1.78"
pip install playwright
playwright install
```

```sh java
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 mvn test

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.168.1.78"
mvn test
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```sh js
# Linux/macOS
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=192.168.1.1 PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=192.168.1.1 PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 python -m playwright install
```

```sh java
# Linux/macOS
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=192.168.1.1 PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 mvn test
```

## Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```sh js
# Linux/macOS
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm i -D playwright

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm i -D playwright
```

```sh python
# Linux/macOS
pip install playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 python -m playwright install

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pip install playwright
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
pip install playwright
playwright install
```

```sh java
# Linux/macOS
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 mvn test

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test
```

## Download single browser binary
* langs: js

Playwright ships three packages that bundle only a single browser:
- [`playwright-chromium`](https://www.npmjs.com/package/playwright-chromium)
- [`playwright-webkit`](https://www.npmjs.com/package/playwright-webkit)
- [`playwright-firefox`](https://www.npmjs.com/package/playwright-firefox)

:::note
All configuration environment variables also apply to these packages.
:::

Using these packages is as easy as using a regular Playwright:

Install a specific package

```sh
npm i -D playwright-webkit
```

Require package

```js
// Notice a proper package name in require
const { webkit } = require('playwright-webkit');

(async () => {
  const browser = await webkit.launch();
  // ...
})();
```

## Download single browser binary
* langs: python

Playwright downloads Chromium, Firefox and WebKit browsers by default. To install a specific browser, pass it as an argument during installation.

```sh
pip install playwright
playwright install firefox
```

## Stale browser removal

Playwright keeps track of the clients that use its browsers. When there are no more clients that require particular
version of the browser, that version is deleted from the system. That way you can safely use Playwright instances of
different versions and at the same time, you don't waste disk space for the browsers that are no longer in use.

To opt-out from the unused browser removal, you can set the `PLAYWRIGHT_SKIP_BROWSER_GC=1` environment variable.
