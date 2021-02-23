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

Every time `Playwright.create()` is called it will check if the browsers are in the local cache and if not download them.

These browsers will take few hundreds of megabytes of the disk space when installed:

```sh
$ du -hs ./Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When running Playwright scripts, ask it to search for browsers in a shared location:

```sh
# Linux/macOS
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers mvn test

# Windows
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
$ mvn test
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

:::note
Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.
:::

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft and Google public CDNs.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```sh
# Linux/macOS
$ PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 mvn test

# Windows
$ set PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78
$ mvn test
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```sh
# Linux/macOS
$ PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=192.168.1.1 PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 mvn test
```

## Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```sh
# Linux/macOS
$ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 mvn test

# Windows
$ set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
$ mvn test
```
