---
id: installation
title: "Installation"
---

<!-- TOC -->

### Prerequisites for .NET
* langs: csharp

All examples require the `Microsoft.Playwright.CLI` to be installed. You only have to do this once:

```bash
dotnet tool install -g Microsoft.Playwright.CLI
```

## Managing browser binaries

Each version of Playwright needs specific versions of browser binaries to operate. By default, Playwright downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

```bash python
pip install playwright
playwright install
```

```bash csharp
# In your solution/project folder...
playwright install
```

These browsers will take a few hundred megabytes of disk space when installed:

```bash
du -hs ~/Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When installing Playwright, ask it to download browsers into a specific location:

```bash python
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

```bash java
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers mvn test

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
mvn test
```

```bash csharp
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers 
playwright install

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
playwright install
```

When running Playwright scripts, ask it to search for browsers in a shared location.

```bash python
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers python playwright_script.js

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
python playwright_script.py

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
python playwright_script.py
```

```bash java
# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
mvn test
```

```bash csharp
# Linux/macOS
PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers dotnet test

# Windows with cmd.exe
set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
dotnet test

# Windows with PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH="$env:USERPROFILE\pw-browsers"
dotnet test
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

:::note
Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.
:::

## Install behind a firewall or a proxy

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```bash python
# Linux/macOS
pip install playwright
HTTPS_PROXY=https://192.0.2.1 playwright install

# Windows with cmd.exe
set HTTPS_PROXY=https://192.0.2.1
pip install playwright
playwright install

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.0.2.1"
pip install playwright
playwright install
```

```bash java
# Linux/macOS
HTTPS_PROXY=https://192.0.2.1 mvn test

# Windows with cmd.exe
set HTTPS_PROXY=https://192.0.2.1
mvn test

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.0.2.1"
mvn test
```

```bash csharp
# Linux/macOS
HTTPS_PROXY=https://192.0.2.1 playwright install

# Windows with cmd.exe
set HTTPS_PROXY=https://192.0.2.1
playwright install

# Windows with PowerShell
$env:HTTPS_PROXY="https://192.0.2.1"
playwright install
```

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft CDN.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```bash python
# Linux/macOS
pip install playwright
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 playwright install

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
pip install playwright
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
pip install playwright
playwright install
```

```bash java
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 mvn test

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
mvn test
```

```bash csharp
# Linux/macOS
PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 playwright install

# Windows with cmd.exe
set PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_DOWNLOAD_HOST="192.0.2.1"
playwright install
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```bash python
# Linux/macOS
pip install playwright
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 python -m playwright install
```

```bash java
# Linux/macOS
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 mvn test
```

```bash csharp
# Linux/macOS
PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=203.0.113.3 PLAYWRIGHT_DOWNLOAD_HOST=192.0.2.1 playwright install
```

## Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```bash python
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

```bash java
# Linux/macOS
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 mvn test

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
mvn test
```

```bash csharp
# Linux/macOS
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 playwright install

# Windows with cmd.exe
set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
playwright install

# Windows with PowerShell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
playwright install
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
