# Managing browser binaries

Each version of Playwright needs specific versions of browser binaries to operate.

By default it downloads Chromium, WebKit and Firefox browsers into the `node_modules/` folder. This way no extra steps are needed to get playwright up and running:

```sh
npm i playwright
```

These browsers will take hundreds of megabytes of the disk space when installed:

```sh
du -hs ./node_modules/playwright/.local-browsers/*
281M	.local-browsers/chromium-XXXXXX
187M	.local-browsers/firefox-XXXX
180M	.local-browsers/webkit-XXXX
```

To mitigate that, Playwright has a rich set of options to control browser management.

## Download from artifact repository

By default, Playwright downloads browsers from Microsoft and Google public CDNs.

Sometimes companies maintain an internal artifact repository to host browser
binaries. In this case, Playwright can be configured to download from a custom
location using the `PLAYWRIGHT_DOWNLOAD_HOST` env variable.

```sh
$ PLAYWRIGHT_DOWNLOAD_HOST=192.168.1.78 npm i playwright
```

## Share browser binaries across projects

Often times, developers work with multiple NPM projects that all use Playwright.
By default, every project will have browser binaries in its own `node_modules/` folder.
To save the disk space and to speedup installation, Playwright can re-use
these binaries.

Sharing browser binaries is a two-step process:

1. When installing Playwright, ask it to download browsers into a shared location:

```sh
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers npm i playwright
```

2. When running Playwright scripts, ask it to search for browsers in a shared location:

```sh
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers node playwright-script.js
```

> **NOTE** Developers can opt-in in this mode via exporting `PLAYWRIGHT_BROWSERS_PATH=$HOME/pw-browsers` in their `.bashrc`.

## Completely avoid browser installation

In certain cases, it is desired to avoid browser installation altogether because
browser binaries are managed separately.

This can be done by setting `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` variable before installation.

```sh
$ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright
```

## Download single browser binary

Playwright ships three packages that bundle only a single browser:
- [`playwright-chromium`](https://www.npmjs.com/package/playwright-chromium)
- [`playwright-webkit`](https://www.npmjs.com/package/playwright-webkit)
- [`playwright-firefox`](https://www.npmjs.com/package/playwright-firefox)

> **NOTE** All configuration environment variables also apply to these packages.

Using these packages is as easy as using a regular Playwright:

1. Install a specific package

```sh
$ npm i playwright-webkit
```

2. Require package

```js
// Notice a proper package name in require
const {webkit} = require('playwright-webkit');

(async () => {
  const browser = await webkit.launch();
  // ....
})();
```
