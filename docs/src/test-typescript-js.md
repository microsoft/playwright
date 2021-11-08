---
id: test-typescript
title: "Advanced: TypeScript"
---

## Manually compile tests with TypeScript

Playwright Test supports TypeScript out of the box. We automatically transform
TypeScript code to JavaScript to run it.

However, if you find that the TypeScript code is not being transpiled correctly,
you can perform your own TypeScript compilation before sending the tests to Playwright.

First I add a `tsconfig.json` file inside my tests directory.

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

In my `package.json`, I have two scripts:

```json
{
  "scripts": {
    "pretest": "tsc --incremental -p tests/tsconfig.json",
    "test": "playwright test -c tests-out"
  }
}
```

The `pretest` script runs TypeScript on the tests. `test` will run the tests that have been generated to the `tests-out` directory. The `-c` argument configures the test runner to look for tests inside the `tests-out` directory.

Then `npm run test` will build the tests and run them.
