---
id: test-typescript
title: "TypeScript"
---

## Introduction

Playwright supports TypeScript out of the box. You just write tests in TypeScript, and Playwright will read them, transform to JavaScript and run.

Note that Playwright does not check the types and will run tests even if there are non-critical TypeScript compilation errors. We recommend you run TypeScript compiler alongside Playwright. For example on GitHub actions:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    ...
    - name: Run type checks
      run: npx tsc -p tsconfig.json --noEmit
    - name: Run Playwright tests
      run: npx playwright test
```

For local development, you can run `tsc` in [watch](https://www.typescriptlang.org/docs/handbook/configuring-watch.html) mode like this:
```sh
npx tsc -p tsconfig.json --noEmit -w
```

## tsconfig.json

Playwright will pick up `tsconfig.json` and consult it for each source file it loads. Note that Playwright **only supports** the following tsconfig options: `allowJs`, `baseUrl`, `exclude`, `files`, `include`, `paths`, `references`.

We recommend to use the [`references` option](https://www.typescriptlang.org/tsconfig#references), so that you can configure TypeScript differently for source and test files.

Below is an example directory structure and `tsconfig` file templates.

```txt
src/
    source.ts

tests/
    example.spec.ts

tsconfig.json
tsconfig.app.json
tsconfig.test.json
playwright.config.ts
```

```json title="tsconfig.json"
// This file just references two other configs.
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.test.json" }
  ]
}
```

```json title="tsconfig.app.json"
{
  "include": ["./src"],
  "compilerOptions": {
    // Configure TypeScript for the app here.
  }
}
```

```json title="tsconfig.test.json"
{
  "include": ["./tests"],
  "compilerOptions": {
    // Configure TypeScript for tests here.
  }
}
```

Note that `include` should be configured in each config to only apply to respective files.

### tsconfig path mapping

Playwright supports [path mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping) declared in the `tsconfig.json`. Make sure that `baseUrl` is also set.

Here is an example `tsconfig.json` that works with Playwright:

```json title="tsconfig.test.json"
{
  "include": ["tests/**/*.ts"],
  "compilerOptions": {
    "baseUrl": ".", // This must be specified if "paths" is.
    "paths": {
      "@myhelper/*": ["packages/myhelper/*"] // This mapping is relative to "baseUrl".
    }
  }
}
```

You can now import using the mapped paths:

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';
import { username, password } from '@myhelper/credentials';

test('example', async ({ page }) => {
  await page.getByLabel('User Name').fill(username);
  await page.getByLabel('Password').fill(password);
});
```

### tsconfig resolution in Playwright

Before loading `playwright.config.ts`, Playwright will search for `tsconfig.json` file next to it and in parent directories up to the package root containing `package.json`. This `tsconfig.json` will be used to load `playwright.config.ts`.

Then, if you specify [`property: TestConfig.testDir`], and it contains a `tsconfig.json` file, Playwright will use it instead of the root `tsconfig.json`. This is **not recommended** and is left for backwards compatibility only. See above for the [recommended `references` setup](#tsconfigjson).

Playwright consults `include`, `exclude` and `files` properties of the `tsconfig.json` before loading any typescript file, either through `require` or `import`, to determine whether to apply `tsconfig` to this particular file.

## Manually compile tests with TypeScript

Sometimes, Playwright Test will not be able to transform your TypeScript code correctly, for example when you are using experimental or very recent features of TypeScript, usually configured in `tsconfig.json`.

In this case, you can perform your own TypeScript compilation before sending the tests to Playwright.

First configure `tsconfig.test.json` to compile your tests:

```json title="tsconfig.test.json"
{
  "include": ["tests/**/*.ts"],
  "compilerOptions": {
    "target": "ESNext",
    "module": "commonjs",
    "moduleResolution": "Node",
    "sourceMap": true,
    "outDir": "./tests-out",
  }
}
```

In `package.json`, add two scripts:

```json
{
  "scripts": {
    "pretest": "tsc --incremental -p tsconfig.test.json",
    "test": "playwright test -c tests-out"
  }
}
```

The `pretest` script runs typescript on the tests. `test` will run the tests that have been generated to the `tests-out` directory. The `-c` argument configures the test runner to look for tests inside the `tests-out` directory.

Then `npm run test` will build the tests and run them.

## Using `import` inside `evaluate()`

Using dynamic imports inside a function passed to various `evaluate()` methods is not supported. This is because Playwright uses `Function.prototype.toString()` to serialize functions, and transpiler will sometimes replace dynamic imports with `require()` calls, which are not valid inside the web page.

To work around this issue, use a string template instead of a function:

```js
await page.evaluate(`(async () => {
  const { value } = await import('some-module');
  console.log(value);
})()`);
```
