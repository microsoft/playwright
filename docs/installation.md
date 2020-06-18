# Advanced installation

<!-- GEN:toc -->
- [Managing browser binaries](#managing-browser-binaries)
- [Download from artifact repository](#download-from-artifact-repository)
- [Skip browser downloads](#skip-browser-downloads)
- [Download single browser binary](#download-single-browser-binary)
<!-- GEN:stop -->

<br>

## Managing browser binaries

Each version of Playwright needs specific versions of browser binaries to operate. By default Playwright downloads Chromium, WebKit and Firefox browsers into the OS-specific cache folders:

- `%USERPROFILE%\AppData\Local\ms-playwright` on Windows
- `~/Library/Caches/ms-playwright` on MacOS
- `~/.cache/ms-playwright` on Linux

```sh
npm i -D playwright
```

These browsers will take few hundreds of megabytes of the disk space when installed:

```sh
du -hs ./Library/Caches/ms-playwright/*
281M  chromium-XXXXXX
187M  firefox-XXXX
180M  webkit-XXXX
```

You can override default behavior using environment variables. When installing Playwright, ask it to download browsers into a specific location:

```sh
# Linux/macOS
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npm i -D playwright

# Windows
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
$ npm i -D playwright
```

When running Playwright scripts, ask it to search for browsers in a shared location:

```sh
# Linux/macOS
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers node playwright-script.js

# Windows
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\pw-browsers
$ node playwright-script.js
```

Or you can opt into the hermetic install and place binaries under the `node_modules/` folder:

```sh
# Linux/macOS
$ PLAYWRIGHT_BROWSERS_PATH=0 npm i -D playwright

# Windows
$ set PLAYWRIGHT_BROWSERS_PATH=0
$ npm i -D playwright
```

Playwright keeps track of packages that need those browsers and will garbage collect them as you update Playwright to the newer versions.

<br>

> **NOTE** Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.

<br>

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft and Google public CDNs.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```sh
# Linux/macOS
$ PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 npm i -D playwright

# Windows
$ set PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78
$ npm i -D playwright
```

It is also possible to use a per-browser download hosts using `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` and `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` env variables that
take precedence over `PLAYWRIGHT_DOWNLOAD_HOST`.

```sh
# Linux/macOS
$ PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST=192.168.1.1 PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 npm i -D playwright
```

<br>

## Skip browser downloads

In certain cases, it is desired to avoid browser downloads altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```sh
# Linux/macOS
$ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright

# Windows
$ set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
$ npm i -D playwright
```

<br>

## Download single browser binary

Playwright ships three packages that bundle only a single browser:
- [`playwright-chromium`](https://www.npmjs.com/package/playwright-chromium)
- [`playwright-webkit`](https://www.npmjs.com/package/playwright-webkit)
- [`playwright-firefox`](https://www.npmjs.com/package/playwright-firefox)

> **NOTE** All configuration environment variables also apply to these packages.

Using these packages is as easy as using a regular Playwright:

Install a specific package

```sh
$ npm i -D playwright-webkit
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
