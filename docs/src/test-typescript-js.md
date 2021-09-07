---
id: test-typescript
title: "Advanced: TypeScript"
---

## Manually compile tests with TypeScript

Playwright Test supports TypeScript out the box. We automatically transform
TypeScript code to javascript to run it.

However if you find that the TypeScript code is not being transpiled correctly,
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

The `pretest` script runs typescript on the tests. `test` will run the tests that have been generated to the `tests-out` directory. The `-c` argument configures the test runner to look for tests inside the `tests-out` directory.

Then `npm run test` will build the tests and run them.

## Type checking

Although Playwright Test is supporting TypeScript out of the box, it's not running any type checks before executing tests *by design*.  
This allows faster development loops since you don't need to wait for type checking everytime you make some changes to your tests.

It certainly makes sense to add type checks on demand, for example in CI environments:

```bash
tsc --noEmit
```

Which requires at least following `tsconfig.json` to be present:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "moduleResolution": "Node"
  }
}
```
