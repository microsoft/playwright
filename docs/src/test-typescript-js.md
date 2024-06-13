---
id: test-typescript
title: "TypeScript"
---

## Introduction

Playwright supports TypeScript out of the box. You just write tests in TypeScript, and Playwright will read them, transform to JavaScript and run. Note that Playwright does not check the types and will run tests even if there are non-critical TypeScript compilation errors.

We recommend you run TypeScript compiler alongside Playwright. For example on GitHub actions:

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

Playwright will pick up `tsconfig.json` for each source file it loads. Note that Playwright **only supports** the following tsconfig options: `paths` and `baseUrl`.

We recommend setting up a separate `tsconfig.json` in the tests directory so that you can change some preferences specifically for the tests. Here is an example directory structure.

```txt
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

```js title="example.spec.ts"
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
