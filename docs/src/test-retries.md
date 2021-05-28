---
id: test-retries
title: "Test retry"
---

Playwright Test will retry tests if they failed. Pass the maximum number of retries when running the tests, or set them in the [configuration file](./test-configuration.md).

```sh
npx playwright test --retries=3
```

Failing tests will be retried multiple times until they pass, or until the maximum number of retries is reached. Playwright Test will report all tests that failed at least once:

```sh
Running 1 test using 1 worker
××±
1 flaky
  1) my.test.js:1:1
```
