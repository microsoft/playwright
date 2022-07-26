---
id: troubleshooting
title: "Troubleshooting"
---

## Browser dependencies

Playwright does self-inspection every time it runs to make sure the browsers can be launched successfully. If there are missing
dependencies, playwright will print instructions to acquire them.

See also in the [Command line tools](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.

## Code transpilation issues
* langs: js

If you are using a JavaScript transpiler like babel or TypeScript, calling `evaluate()` with an async function might not work. This is because while `playwright` uses `Function.prototype.toString()` to serialize functions while transpilers could be changing the output code in such a way it's incompatible with `playwright`.

Some workarounds to this problem would be to instruct the transpiler not to mess up with the code, for example, configure TypeScript to use latest ECMAScript version (`"target": "es2018"`). Another workaround could be using string templates instead of functions:

```js
await page.evaluate(`(async() => {
   console.log('1');
})()`);
```

## Node.js requirements
* langs: js

Playwright requires Node.js version 14 or above

### ReferenceError: URL is not defined

Playwright requires Node.js 14 or higher.

### Unknown file extension ".ts"

Running TypeScript tests in `"type": "module"` project requires Node.js 16 or higher.

## .NET requirements
* langs: csharp

Playwright is distributed as a **.NET Standard 2.0** library. We recommend .NET 6 or newer.

## Python requirements
* langs: python

Playwright requires **Python 3.7** or newer.

## Java requirements
* langs: java

Playwright requires **Java 8** or newer. 

## System requirements

The browser binaries for Chromium, Firefox and WebKit work across the 3 platforms (Windows, macOS, Linux):

### Windows

Works with Windows and Windows Subsystem for Linux (WSL).

### macOS

Requires 11 (Big Sur) or above.

### Linux

Depending on your Linux distribution, you might need to install additional
dependencies to run the browsers.

:::note
Only Ubuntu 18.04, 20.04, and 22.04 are officially supported.
:::

See also in the [Command line tools](./cli.md#install-system-dependencies)
which has a command to install all necessary dependencies automatically for Ubuntu
LTS releases.

