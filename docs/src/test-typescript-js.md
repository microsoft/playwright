---
id: test-typescript
title: "TypeScript"
---

Playwright Test supports TypeScript out of the box. You just write tests in TypeScript and Playwright Test will read them, transform to JavaScript and run. This works both with [CommonJS modules](https://nodejs.org/api/modules.html) and [ECMAScript modules](https://nodejs.org/api/esm.html).

## TypeScript with CommonJS

[Node.js](https://nodejs.org/en/) works with CommonJS modules **by default**. Unless you use `'.mjs'` or `'.mts'` extensions, or specify `type: "module"` in your `package.json`, Playwright Test will treat all TypeScript files as CommonJS. You can then import as usual without an extension.

Consider this helper module written in TypeScript:

```js
// helper.ts
export const username = 'John';
export const password = 'secret';
```

You can import from the helper as usual:

```js
// example.spec.ts
import { test, expect } from '@playwright/test';
import { username, password } from './helper';

test('example', async ({ page }) => {
  await page.getByLabel('User Name').fill(username);
  await page.getByLabel('Password').fill(password);
});
```

## TypeScript with ESM

You can opt into using [ECMAScript modules](https://nodejs.org/api/esm.html) by setting `type: "module"` in your `package.json` file. Playwright Test will switch to the ESM mode once it reads the `playwright.config.ts` file, so make sure you have one.

Playwright Test follows the [experimental support for ESM in TypeScript](https://www.typescriptlang.org/docs/handbook/esm-node.html) and, according to the specification, **requires a file extension** when importing from a module, either `'.js'` or `'.ts'`.

First, enable modules in your `package.json`:

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "type": "module",
}
```

Then write the helper module in TypeScript as usual:

```js
// helper.ts
export const username = 'John';
export const password = 'secret';
```

Specify the extension when importing from a module:

```js
// example.spec.ts
import { test, expect } from '@playwright/test';
import { username, password } from './helper.ts';

test('example', async ({ page }) => {
  await page.getByLabel('User Name').fill(username);
  await page.getByLabel('Password').fill(password);
});
```

:::note
TypeScript with ESM requires Node.js 16 or higher.
:::

## tsconfig.json

Playwright will pick up `tsconfig.json` for each source file it loads. Note that Playwright **only supports** the following tsconfig options: `paths` and `baseUrl`.

We recommend setting up a separate `tsconfig.json` in the tests directory so that you can change some preferences specifically for the tests. Here is an example directory structure.

```
src/
    source.ts

tests/
    tsconfig.json  # test-specific tsconfig
    example.spec.ts

tsconfig.json  # generic tsconfig for all typescript sources

playwright.config.ts
```

### tsconfig path mapping

Playwright supports [path mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping) declared in the `tsconfig.json`. Make sure that `baseUrl` is also set.

Here is an example `tsconfig.json` that works with Playwright Test:

```json
{
  "compilerOptions": {
    "baseUrl": ".", // This must be specified if "paths" is.
    "paths": {
      "@myhelper/*": ["packages/myhelper/*"] // This mapping is relative to "baseUrl".
    }
  }
}
```

You can now import using the mapped paths:

```js
// example.spec.ts
import { test, expect } from '@playwright/test';
import { username, password } from '@myhelper/credentials';

test('example', async ({ page }) => {
  await page.getByLabel('User Name').fill(username);
  await page.getByLabel('Password').fill(password);
});
```

## Manually compile tests with TypeScript

Sometimes, Playwright Test will not be able to transform your TypeScript code correctly, for example when you are using experimental or very recent features of TypeScript, usually configured in `tsconfig.json`.

In this case, you can perform your own TypeScript compilation before sending the tests to Playwright.

First add a `tsconfig.json` file inside the tests directory:

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "commonjs",
        "moduleResolution": "Node",
        "sourceMap": true,
        "outDir": "../tests-out",
    }
}
```

In `package.json`, add two scripts:

```json
{
  "scripts": {
    "pretest": "tsc --incremental -p tests/tsconfig.json",
    "test": "playwright test -c tests-out"
  }
}
```

The `pretest` script runs typescript on the tests. `test` will run the tests that have been generated to the `tests-out` directory. The `-c` argument configures the test runner to look for tests inside the `tests-out` directory.

Then `npm run test` will build the tests and run them.
