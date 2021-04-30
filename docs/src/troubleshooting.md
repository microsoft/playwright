---
id: troubleshooting
title: "Troubleshooting"
---

<!-- TOC -->

## Browser dependencies

Playwright does self-inspection every time it runs to make sure the browsers can be launched successfully. If there are missing
dependencies, playwright will print instructions to acquire them.

We also provide [Ubuntu 18.04 dockerfile](https://github.com/microsoft/playwright/blob/master/utils/docker/Dockerfile.bionic) and [Ubuntu 20.04 dockerfile](https://github.com/microsoft/playwright/blob/master/utils/docker/Dockerfile.focal) with the list of Debian dependencies.

## Code transpilation issues

If you are using a JavaScript transpiler like babel or TypeScript, calling `evaluate()` with an async function might not work. This is because while `playwright` uses `Function.prototype.toString()` to serialize functions while transpilers could be changing the output code in such a way it's incompatible with `playwright`.

Some workarounds to this problem would be to instruct the transpiler not to mess up with the code, for example, configure TypeScript to use latest ECMAScript version (`"target": "es2018"`). Another workaround could be using string templates instead of functions:

```js
await page.evaluate(`(async() => {
   console.log('1');
})()`);
```

## Node.js requirements

### ReferenceError: URL is not defined

Playwright requires Node.js 12 or higher. Node.js 8 is not supported, and will cause you to receive this error.

# Please file an issue

Playwright is a new project, and we are watching the issues very closely. As we solve common issues, this document will grow to include the common answers.
